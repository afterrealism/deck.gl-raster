/**
 * LRU Tile Cache with size limits
 *
 * Inspired by gis-workbench tile_cache.rs
 * Implements memory-based eviction instead of count-based
 */

export interface CacheEntry<T> {
  key: string;
  value: T;
  size: number;
  lastAccess: number;
  generation: number; // Load generation when cached
}

export interface TileCacheStats {
  entries: number;
  totalSize: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
}

export class LRUTileCache<T> {
  private entries: Map<string, CacheEntry<T>>;
  private accessCounter: number;
  private totalSize: number;
  private readonly maxSize: number;
  private stats: TileCacheStats;

  constructor(maxSizeMB: number = 50) {
    this.entries = new Map();
    this.accessCounter = 0;
    this.totalSize = 0;
    this.maxSize = maxSizeMB * 1024 * 1024; // Convert MB to bytes
    this.stats = {
      entries: 0,
      totalSize: 0,
      maxSize: this.maxSize,
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Get a tile from the cache
   */
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (entry) {
      entry.lastAccess = ++this.accessCounter;
      this.stats.hits++;
      return entry.value;
    }
    this.stats.misses++;
    return undefined;
  }

  /**
   * Put a tile into the cache
   * @param key - Tile identifier
   * @param value - Tile data
   * @param size - Size in bytes (e.g., texture.byteLength)
   * @param generation - Current load generation
   */
  set(key: string, value: T, size: number, generation: number): void {
    // If key exists, remove old entry first
    if (this.entries.has(key)) {
      const old = this.entries.get(key)!;
      this.totalSize -= old.size;
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      size,
      lastAccess: ++this.accessCounter,
      generation,
    };

    this.entries.set(key, entry);
    this.totalSize += size;

    // Evict LRU entries if over limit
    while (this.totalSize > this.maxSize && this.entries.size > 1) {
      this.evictLRU();
    }

    this.updateStats();
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    return this.entries.has(key);
  }

  /**
   * Delete a specific entry
   */
  delete(key: string): boolean {
    const entry = this.entries.get(key);
    if (entry) {
      this.totalSize -= entry.size;
      this.entries.delete(key);
      this.updateStats();
      return true;
    }
    return false;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
    this.totalSize = 0;
    this.accessCounter = 0;
    this.updateStats();
  }

  /**
   * Invalidate entries from old generations
   * @param currentGeneration - Current load generation
   */
  invalidateOldGenerations(currentGeneration: number): void {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.entries) {
      if (entry.generation < currentGeneration) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): TileCacheStats {
    return { ...this.stats };
  }

  /**
   * Get current size in MB
   */
  getSizeMB(): number {
    return this.totalSize / (1024 * 1024);
  }

  /**
   * Get number of entries
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Get all keys (for debugging)
   */
  keys(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let minAccess = Infinity;

    for (const [key, entry] of this.entries) {
      if (entry.lastAccess < minAccess) {
        minAccess = entry.lastAccess;
        lruKey = key;
      }
    }

    if (lruKey) {
      const entry = this.entries.get(lruKey)!;
      this.totalSize -= entry.size;
      this.entries.delete(lruKey);
      this.stats.evictions++;
    }
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.entries = this.entries.size;
    this.stats.totalSize = this.totalSize;
  }
}

/**
 * Calculate size of texture data in bytes
 */
export function calculateTextureSize(width: number, height: number, bytesPerPixel: number = 4): number {
  return width * height * bytesPerPixel;
}
