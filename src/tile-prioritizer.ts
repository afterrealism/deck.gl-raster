/**
 * Tile Prioritization - Center-out ordering
 *
 * Inspired by gis-workbench tile_prioritizer.rs
 * Orders tiles by distance from viewport center
 */

export interface TileCoord {
  x: number;
  y: number;
  z: number;
}

export interface PrioritizedTile {
  coord: TileCoord;
  key: string;
  distance: number;
}

/**
 * Calculate tile key from coordinates
 */
export function tileKey(x: number, y: number, z: number): string {
  return `${z}/${x}/${y}`;
}

/**
 * Parse tile key into coordinates
 */
export function parseTileKey(key: string): TileCoord | null {
  const parts = key.split("/");
  if (parts.length !== 3) return null;

  const z = parts[0];
  const x = parts[1];
  const y = parts[2];

  if (!z || !x || !y) return null;

  return {
    z: parseInt(z, 10),
    x: parseInt(x, 10),
    y: parseInt(y, 10),
  };
}

/**
 * Calculate viewport center in tile coordinates
 */
export function getViewportCenterTile(
  bounds: { west: number; east: number; north: number; south: number },
  zoom: number,
): TileCoord {
  const centerLng = (bounds.west + bounds.east) / 2;
  const centerLat = (bounds.north + bounds.south) / 2;

  return lngLatToTile(centerLng, centerLat, zoom);
}

/**
 * Convert lng/lat to tile coordinates
 */
export function lngLatToTile(
  lng: number,
  lat: number,
  zoom: number,
): TileCoord {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);

  return { x, y, z: zoom };
}

/**
 * Calculate visible tiles for a viewport
 */
export function getVisibleTiles(
  bounds: { west: number; east: number; north: number; south: number },
  zoom: number,
): TileCoord[] {
  const nw = lngLatToTile(bounds.west, bounds.north, zoom);
  const se = lngLatToTile(bounds.east, bounds.south, zoom);

  const tiles: TileCoord[] = [];

  for (let x = Math.min(nw.x, se.x); x <= Math.max(nw.x, se.x); x++) {
    for (let y = Math.min(nw.y, se.y); y <= Math.max(nw.y, se.y); y++) {
      tiles.push({ x, y, z: zoom });
    }
  }

  return tiles;
}

/**
 * Prioritize tiles by distance from center (simple sort approach)
 * Best for <50 tiles
 */
export function prioritizeTiles(
  tiles: TileCoord[],
  centerTile: TileCoord,
): PrioritizedTile[] {
  const prioritized = tiles.map((tile) => {
    const dx = tile.x - centerTile.x;
    const dy = tile.y - centerTile.y;
    const distance = dx * dx + dy * dy; // Squared distance (no need for sqrt)

    return {
      coord: tile,
      key: tileKey(tile.x, tile.y, tile.z),
      distance,
    };
  });

  // Sort by distance (closest first)
  prioritized.sort((a, b) => a.distance - b.distance);

  return prioritized;
}

/**
 * BFS-based tile prioritization (efficient for large viewports)
 * Best for >50 tiles or animated pans
 */
export function prioritizeTilesBFS(
  tiles: TileCoord[],
  centerTile: TileCoord,
): PrioritizedTile[] {
  const tileSet = new Set(tiles.map((t) => tileKey(t.x, t.y, t.z)));
  const visited = new Set<string>();
  const result: PrioritizedTile[] = [];
  const queue: TileCoord[] = [centerTile];

  let distance = 0;

  while (queue.length > 0) {
    const levelSize = queue.length;

    for (let i = 0; i < levelSize; i++) {
      const tile = queue.shift()!;
      const key = tileKey(tile.x, tile.y, tile.z);

      if (visited.has(key)) continue;
      visited.add(key);

      if (tileSet.has(key)) {
        result.push({
          coord: tile,
          key,
          distance,
        });
      }

      // Add neighbors (4-connected)
      const neighbors = [
        { x: tile.x - 1, y: tile.y, z: tile.z },
        { x: tile.x + 1, y: tile.y, z: tile.z },
        { x: tile.x, y: tile.y - 1, z: tile.z },
        { x: tile.x, y: tile.y + 1, z: tile.z },
      ];

      for (const neighbor of neighbors) {
        const neighborKey = tileKey(neighbor.x, neighbor.y, neighbor.z);
        if (!visited.has(neighborKey) && tileSet.has(neighborKey)) {
          queue.push(neighbor);
        }
      }
    }

    distance++;
  }

  return result;
}

/**
 * Get parent tile coordinate (one zoom level up)
 */
export function getParentTile(tile: TileCoord): TileCoord | null {
  if (tile.z === 0) return null;

  return {
    x: Math.floor(tile.x / 2),
    y: Math.floor(tile.y / 2),
    z: tile.z - 1,
  };
}

/**
 * Get all parent tiles up to a certain zoom level
 */
export function getParentTiles(
  tile: TileCoord,
  minZoom: number = 0,
): TileCoord[] {
  const parents: TileCoord[] = [];
  let current = tile;

  while (current.z > minZoom) {
    const parent = getParentTile(current);
    if (!parent) break;
    parents.push(parent);
    current = parent;
  }

  return parents;
}

/**
 * Get child tiles (one zoom level down)
 */
export function getChildTiles(tile: TileCoord): TileCoord[] {
  return [
    { x: tile.x * 2, y: tile.y * 2, z: tile.z + 1 },
    { x: tile.x * 2 + 1, y: tile.y * 2, z: tile.z + 1 },
    { x: tile.x * 2, y: tile.y * 2 + 1, z: tile.z + 1 },
    { x: tile.x * 2 + 1, y: tile.y * 2 + 1, z: tile.z + 1 },
  ];
}

/**
 * Calculate which portion of parent tile covers a child tile
 * Used for fallback rendering
 */
export function getChildRegionInParent(
  child: TileCoord,
  parent: TileCoord,
): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  // Calculate zoom difference
  const zoomDiff = child.z - parent.z;
  if (zoomDiff < 0) return null;

  const scale = 2 ** zoomDiff;
  const tileSize = 1 / scale; // Fraction of parent tile

  // Calculate child position within parent
  const parentX = child.x / scale;
  const parentY = child.y / scale;

  const offsetX = parentX - parent.x;
  const offsetY = parentY - parent.y;

  return {
    x: offsetX,
    y: offsetY,
    width: tileSize,
    height: tileSize,
  };
}
