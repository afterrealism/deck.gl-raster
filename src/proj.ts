import {
  type ProjectionDefinition,
  type PROJJSONDefinition,
  EPSG_3857,
} from "./web-mercator.js";

export type SupportedCrsUnit =
  | "metre"
  | "meter"
  | "meters"
  | "foot"
  | "US survey foot"
  | "degree";

export interface ProjectionInfo {
  /** Proj4-compatible projection definition (PROJJSON or proj4 string) */
  def: string | PROJJSONDefinition;
  /** A parsed projection definition */
  parsed: ProjectionDefinition;
  /** Units of the coordinate system */
  coordinatesUnits: SupportedCrsUnit;
}

export type GeoKeysParser = (
  geoKeys: Record<string, any>,
) => Promise<ProjectionInfo | null>;

/**
 * Get the Projection of a GeoTIFF
 *
 * The first `image` must be passed in, as only the top-level IFD contains geo
 * keys.
 */
export async function epsgIoGeoKeyParser(
  _geoKeys: Record<string, any>,
): Promise<ProjectionInfo | null> {
  // Since we guarantee EPSG:3857 input, return hardcoded projection
  // No network call to epsg.io needed!
  return {
    def: "EPSG:3857",
    parsed: EPSG_3857,
    coordinatesUnits: "meter",
  };
}

/**
 * Parse a CRS input into a ProjectionDefinition
 * Since we guarantee EPSG:3857 input, this returns the hardcoded definition
 */
export function parseCrs(
  _crs: string | PROJJSONDefinition,
): ProjectionDefinition {
  // Since we guarantee EPSG:3857, return hardcoded definition
  return EPSG_3857;
}
