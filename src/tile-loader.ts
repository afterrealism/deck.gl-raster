/**
 * Tile Loading Manager with debouncing, generation tracking, and prioritization
 *
 * Inspired by gis-workbench parallel_tile_loader.gd and mvt_layer.gd
 */

import { LRUTileCache } from "./tile-cache.js";
import type { TileCoord } from "./tile-prioritizer.js";
import {
  getViewportCenterTile,
  getVisibleTiles,
  prioritizeTiles,
  tileKey,
  getParentTile,
} from "./tile-prioritizer.js";

export enum TileState {
  PENDING = "pending",
  LOADING = "loading",
  LOADED = "loaded",
  ERROR = "error",
}

export interface TileData<T> {
  coord: TileCoord;
  key: string;
  state: TileState;
  data?: T;
  error?: Error;
  loadTime?: number;
  generation: number;
}

export interface TileLoaderConfig {
  maxConcurrentLoads: number; // 4-6 recommended
  maxStartsPerFrame: number; // 2-4 recommended
  panDebounceMs: number; // 50ms recommended
  zoomDebounceMs: number; // 150-300ms recommended
  cacheSizeMB: number; // 50MB default
  fadeDurationMs: number; // 200-300ms recommended
}

export interface ViewportBounds {
  west: number;
  east: number;
  north: number;
  south: number;
}

const DEFAULT_CONFIG: TileLoaderConfig = {
  maxConcurrentLoads: 4,
  maxStartsPerFrame: 2,
  panDebounceMs: 50,
  zoomDebounceMs: 150,
  cacheSizeMB: 50,
  fadeDurationMs: 250,
};

export class TileLoader<T> {
  private config: TileLoaderConfig;
  private cache: LRUTileCache<T>;
  private tiles: Map<string, TileData<T>>;
  private loadQueue: string[];
  private loadingTiles: Set<string>;
  private loadGeneration: number;
  private lastZoom: number;
  private panDebounceTimer: ReturnType<typeof setTimeout> | null;
  private zoomDebounceTimer: ReturnType<typeof setTimeout> | null;
  private isZooming: boolean;
  private loadTileCallback: (
    coord: TileCoord,
    generation: number,
  ) => Promise<T>;

  constructor(
    loadTileCallback: (coord: TileCoord, generation: number) => Promise<T>,
    config: Partial<TileLoaderConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new LRUTileCache(this.config.cacheSizeMB);
    this.tiles = new Map();
    this.loadQueue = [];
    this.loadingTiles = new Set();
    this.loadGeneration = 0;
    this.lastZoom = -1;
    this.panDebounceTimer = null;
    this.zoomDebounceTimer = null;
    this.isZooming = false;
    this.loadTileCallback = loadTileCallback;
  }

  /**
   * Update viewport (called on pan/zoom)
   */
  updateViewport(bounds: ViewportBounds, zoom: number): void {
    const zoomChanged = zoom !== this.lastZoom;

    if (zoomChanged) {
      this.handleZoomChange(zoom);
    }

    // Clear existing debounce timers
    if (this.panDebounceTimer) {
      clearTimeout(this.panDebounceTimer);
    }
    if (this.zoomDebounceTimer && !zoomChanged) {
      clearTimeout(this.zoomDebounceTimer);
    }

    // Debounce based on change type
    if (zoomChanged) {
      this.isZooming = true;
      this.zoomDebounceTimer = setTimeout(() => {
        this.isZooming = false;
        this.processViewChange(bounds, zoom);
      }, this.config.zoomDebounceMs);
    } else {
      this.panDebounceTimer = setTimeout(() => {
        this.processViewChange(bounds, zoom);
      }, this.config.panDebounceMs);
    }
  }

  /**
   * Handle zoom level change (invalidate old generation)
   */
  private handleZoomChange(newZoom: number): void {
    this.loadGeneration++;
    this.lastZoom = newZoom;

    // Cancel all pending loads
    this.loadQueue = [];

    // Invalidate cache entries from old generations
    this.cache.invalidateOldGenerations(this.loadGeneration);

    // Mark loading tiles as cancelled
    for (const key of this.loadingTiles) {
      const tile = this.tiles.get(key);
      if (tile && tile.generation < this.loadGeneration) {
        tile.state = TileState.PENDING;
        this.loadingTiles.delete(key);
      }
    }
  }

  /**
   * Process view change after debounce
   */
  private processViewChange(bounds: ViewportBounds, zoom: number): void {
    // Calculate visible tiles
    const visibleTiles = getVisibleTiles(bounds, zoom);
    const centerTile = getViewportCenterTile(bounds, zoom);

    // Prioritize tiles (center-out)
    const prioritized = prioritizeTiles(visibleTiles, centerTile);

    // Queue tiles for loading
    for (const { key, coord } of prioritized) {
      // Skip if already loaded or in cache
      if (this.cache.has(key)) {
        continue;
      }

      // Skip if already queued or loading
      if (this.loadQueue.includes(key) || this.loadingTiles.has(key)) {
        continue;
      }

      // Add to queue
      this.loadQueue.push(key);

      // Create tile entry
      if (!this.tiles.has(key)) {
        this.tiles.set(key, {
          coord,
          key,
          state: TileState.PENDING,
          generation: this.loadGeneration,
        });
      }
    }
  }

  /**
   * Process load queue (call this in animation frame)
   */
  processQueue(): void {
    if (this.isZooming) {
      // Don't start new loads during zoom
      return;
    }

    let startsThisFrame = 0;

    while (
      this.loadingTiles.size < this.config.maxConcurrentLoads &&
      this.loadQueue.length > 0 &&
      startsThisFrame < this.config.maxStartsPerFrame
    ) {
      const key = this.loadQueue.shift()!;
      const tile = this.tiles.get(key);

      if (!tile || tile.generation < this.loadGeneration) {
        // Stale tile, skip
        continue;
      }

      this.startTileLoad(tile);
      startsThisFrame++;
    }
  }

  /**
   * Start loading a tile
   */
  private async startTileLoad(tile: TileData<T>): Promise<void> {
    tile.state = TileState.LOADING;
    this.loadingTiles.add(tile.key);

    const loadGeneration = tile.generation;

    try {
      const data = await this.loadTileCallback(tile.coord, loadGeneration);

      // Check if generation is still valid
      if (loadGeneration !== this.loadGeneration) {
        // Stale load, discard
        this.loadingTiles.delete(tile.key);
        return;
      }

      tile.data = data;
      tile.state = TileState.LOADED;
      tile.loadTime = Date.now();

      // Add to cache (calculate size - override in subclass if needed)
      const size = this.estimateTileSize(data);
      this.cache.set(tile.key, data, size, loadGeneration);
    } catch (error) {
      if (loadGeneration !== this.loadGeneration) {
        // Stale load, discard error
        this.loadingTiles.delete(tile.key);
        return;
      }

      tile.state = TileState.ERROR;
      tile.error = error as Error;
    } finally {
      this.loadingTiles.delete(tile.key);
    }
  }

  /**
   * Get tile data (from cache or tiles map)
   */
  getTile(key: string): TileData<T> | undefined {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached) {
      const tile = this.tiles.get(key);
      if (tile) {
        tile.data = cached;
        tile.state = TileState.LOADED;
        return tile;
      }
    }

    return this.tiles.get(key);
  }

  /**
   * Get all loaded tiles
   */
  getLoadedTiles(): TileData<T>[] {
    const loaded: TileData<T>[] = [];

    for (const tile of this.tiles.values()) {
      if (tile.state === TileState.LOADED && tile.data) {
        loaded.push(tile);
      }
    }

    return loaded;
  }

  /**
   * Find loaded parent tile (for fallback rendering)
   */
  findLoadedParent(coord: TileCoord): TileData<T> | null {
    let parent = getParentTile(coord);

    while (parent) {
      const key = tileKey(parent.x, parent.y, parent.z);
      const tile = this.getTile(key);

      if (tile && tile.state === TileState.LOADED && tile.data) {
        return tile;
      }

      parent = getParentTile(parent);
    }

    return null;
  }

  /**
   * Get fade alpha for a tile (based on load time)
   */
  getTileFadeAlpha(tile: TileData<T>): number {
    if (!tile.loadTime) return 1.0;

    const elapsed = Date.now() - tile.loadTime;
    return Math.min(elapsed / this.config.fadeDurationMs, 1.0);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Get loading statistics
   */
  getLoadingStats() {
    return {
      tilesInCache: this.cache.size(),
      tilesInMemory: this.tiles.size,
      tilesLoading: this.loadingTiles.size,
      tilesQueued: this.loadQueue.length,
      loadGeneration: this.loadGeneration,
      isZooming: this.isZooming,
    };
  }

  /**
   * Clear all tiles and cache
   */
  clear(): void {
    this.tiles.clear();
    this.loadQueue = [];
    this.loadingTiles.clear();
    this.cache.clear();
    this.loadGeneration = 0;
  }

  /**
   * Estimate tile size in bytes (override in subclass for accurate sizing)
   */
  protected estimateTileSize(_data: T): number {
    // Default: assume 1MB per tile (override for accuracy)
    return 1024 * 1024;
  }
}
