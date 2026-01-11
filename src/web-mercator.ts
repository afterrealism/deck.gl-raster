/**
 * Web Mercator (EPSG:3857) ↔ WGS84 (EPSG:4326) conversion utilities
 * Replaces proj4 for the specific use case where all inputs are EPSG:3857
 */

// Constants
const EARTH_RADIUS = 6378137; // WGS84 semi-major axis in meters
const ORIGIN_SHIFT = Math.PI * EARTH_RADIUS; // 20037508.34 meters

// Type definitions (replace proj4 imports)
export interface ProjectionDefinition {
  projName: string;
  units: string;
  a: number;
  b: number;
  lat_ts?: number;
  lon_0?: number;
  x_0?: number;
  y_0?: number;
  k?: number;
  [key: string]: any;
}

export interface PROJJSONDefinition {
  type?: string;
  name?: string;
  [key: string]: any;
}

export interface Converter {
  forward<T extends [number, number]>(coords: T, enforceAxis?: boolean): T;
  inverse<T extends [number, number]>(coords: T, enforceAxis?: boolean): T;
}

/**
 * Convert Web Mercator (EPSG:3857) coordinates to WGS84 (EPSG:4326)
 */
export function webMercatorToWGS84(x: number, y: number): [number, number] {
  const lng = (x / ORIGIN_SHIFT) * 180;
  const lat =
    (Math.atan(Math.exp((y / ORIGIN_SHIFT) * Math.PI)) * 360) / Math.PI - 90;
  return [lng, lat];
}

/**
 * Convert WGS84 (EPSG:4326) coordinates to Web Mercator (EPSG:3857)
 */
export function wgs84ToWebMercator(lng: number, lat: number): [number, number] {
  const x = (lng * ORIGIN_SHIFT) / 180;
  const y =
    ((Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) *
      ORIGIN_SHIFT) /
    180;
  return [x, y];
}

/**
 * Create a converter compatible with proj4 API
 * Only supports EPSG:3857 ↔ EPSG:4326
 */
export function createConverter(source: string, target: string): Converter {
  const src = normalizeEPSG(source);
  const tgt = normalizeEPSG(target);

  if (src === "3857" && tgt === "4326") {
    return {
      forward: (coords) => webMercatorToWGS84(coords[0], coords[1]) as any,
      inverse: (coords) => wgs84ToWebMercator(coords[0], coords[1]) as any,
    };
  }

  if (src === "4326" && tgt === "3857") {
    return {
      forward: (coords) => wgs84ToWebMercator(coords[0], coords[1]) as any,
      inverse: (coords) => webMercatorToWGS84(coords[0], coords[1]) as any,
    };
  }

  if (src === tgt) {
    // Identity transform
    return {
      forward: (coords) => coords,
      inverse: (coords) => coords,
    };
  }

  throw new Error(
    `Unsupported projection conversion: ${source} → ${target}. Only EPSG:3857 ↔ EPSG:4326 supported.`,
  );
}

/**
 * Normalize EPSG code to just the number
 */
function normalizeEPSG(epsg: string): string {
  const match = epsg.match(/(\d+)/);
  return match?.[1] ?? epsg;
}

/**
 * Hardcoded EPSG:3857 projection definition
 */
export const EPSG_3857: ProjectionDefinition = {
  projName: "merc",
  units: "meter",
  a: EARTH_RADIUS,
  b: EARTH_RADIUS,
  lat_ts: 0,
  lon_0: 0,
  x_0: 0,
  y_0: 0,
  k: 1,
};
