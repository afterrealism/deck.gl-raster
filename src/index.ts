// Core raster layer
export type { RasterModule } from "./gpu-modules/types.js";
export type { RasterLayerProps } from "./raster-layer.js";
export { RasterLayer } from "./raster-layer.js";
export { RasterTileset2D } from "./raster-tileset/index.js";
export type {
  TileMatrix,
  TileMatrixSet,
  TileMatrixSetBoundingBox,
} from "./raster-tileset/types.js";

// GeoTIFF/COG layers
export type { COGLayerProps } from "./cog-layer.js";
export { COGLayer } from "./cog-layer.js";
export { parseCOGTileMatrixSet } from "./cog-tile-matrix-set.js";
export { loadRgbImage, parseColormap } from "./geotiff-loader/geotiff.js";
export * as texture from "./geotiff-loader/texture.js";
export type { GeoTIFFLayerProps } from "./geotiff-layer.js";
export { GeoTIFFLayer } from "./geotiff-layer.js";
export {
  extractGeotiffReprojectors,
  fromGeoTransform,
} from "./geotiff-reprojection.js";
export * as proj from "./proj.js";

// Coordinate conversion utilities
export {
  webMercatorToWGS84,
  wgs84ToWebMercator,
  createConverter,
  EPSG_3857,
} from "./web-mercator.js";
export type {
  ProjectionDefinition,
  PROJJSONDefinition,
  Converter,
} from "./web-mercator.js";

// Reprojection
export type { ReprojectionFns } from "./reproject/delatin.js";
export { RasterReprojector } from "./reproject/delatin.js";

// Tile loading optimizations
export { LRUTileCache, calculateTextureSize } from "./tile-cache.js";
export type { CacheEntry, TileCacheStats } from "./tile-cache.js";
export { TileLoader, TileState } from "./tile-loader.js";
export type {
  TileData,
  TileLoaderConfig,
  ViewportBounds,
} from "./tile-loader.js";
export {
  tileKey,
  parseTileKey,
  getViewportCenterTile,
  getVisibleTiles,
  prioritizeTiles,
  prioritizeTilesBFS,
  getParentTile,
  getParentTiles,
  getChildTiles,
  getChildRegionInParent,
  lngLatToTile,
} from "./tile-prioritizer.js";
export type { TileCoord, PrioritizedTile } from "./tile-prioritizer.js";
