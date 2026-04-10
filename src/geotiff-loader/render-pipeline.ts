import type { RasterModule } from "../gpu-modules/types.js";
import {
  CMYKToRGB,
  Colormap,
  createColormapTexture,
  CreateTexture,
  cieLabToRGB,
  FilterNoDataVal,
  Rescale,
  YCbCrToRGB,
} from "../gpu-modules/index.js";
import type { ColormapName } from "../gpu-modules/ramps.js";
import type { Device, SamplerProps, Texture } from "@luma.gl/core";
import type { GeoTIFFImage, TypedArrayWithDimensions } from "geotiff";
import type { COGLayerProps, GetTileDataOptions } from "../cog-layer";
import { addAlphaChannel, parseColormap, parseGDALNoData } from "./geotiff";
import { inferTextureFormat } from "./texture";
import type { ImageFileDirectory } from "./types";
import { PhotometricInterpretationT } from "./types";

/**
 * Options controlling how `inferRenderPipeline` builds a pipeline for
 * continuous single-band rasters. Ignored for palette, RGB, and other
 * already-colorized sources.
 */
export type RenderPipelineOptions = {
  /**
   * Named ramp (viridis/magma/plasma/turbo/terrain), a custom 256x4 RGBA8
   * `Uint8Array`, or a pre-built `Texture`.
   *
   * Defaults to `"viridis"` for float single-band data.
   */
  colormap?: ColormapName | Uint8Array | Texture;

  /**
   * Data range `[min, max]` for value normalization. Required for float
   * single-band data — raw values outside `[0, 1]` cannot index a LUT.
   *
   * Example: `[0, 4000]` meters for a DEM, `[-1, 1]` for NDVI.
   */
  rescaleRange?: [number, number];
};

/**
 * The shape returned by `inferRenderPipeline`. `ownedTextures` lists GPU
 * textures whose lifetime is tied to the caller — the caller must `destroy()`
 * them before discarding this pipeline to avoid GPU memory leaks.
 */
export type InferredRenderPipeline = {
  getTileData: COGLayerProps<TextureDataT>["getTileData"];
  renderTile: COGLayerProps<TextureDataT>["renderTile"];
  ownedTextures: Texture[];
};

export type TextureDataT = {
  height: number;
  width: number;
  texture: Texture;
};

/**
 * A raster module that can be "unresolved", meaning that its props may come
 * from the result of `getTileData`.
 *
 * In this case, one or more of the props may be a function that takes the
 * `getTileData` result and returns the actual prop value.
 */
// TODO: it would be nice to improve the generics here, to connect the type of
// the props allowed by the module to the return type of this function
type UnresolvedRasterModule<DataT> =
  | RasterModule
  | {
      module: RasterModule["module"];
      props?: Record<
        string,
        number | Texture | ((data: DataT) => number | Texture)
      >;
    };

export function inferRenderPipeline(
  // TODO: narrow type to only used fields
  ifd: ImageFileDirectory,
  device: Device,
  options: RenderPipelineOptions = {},
): InferredRenderPipeline {
  const { SampleFormat } = ifd;

  switch (SampleFormat[0]) {
    // Unsigned integers
    case 1:
      return createUnormPipeline(ifd, device);
    // Signed integers — not yet supported; see plan Step 3 follow-up.
    case 2:
      throw new Error(
        `Signed integer rasters (SampleFormat=2) are not yet supported. Convert to float or unsigned integer, or file an issue.`,
      );
    // IEEE floats
    case 3:
      return createFloatPipeline(ifd, device, options);
  }

  throw new Error(
    `Inferring render pipeline failed: unknown SampleFormat: ${SampleFormat}`,
  );
}

/**
 * Create pipeline for visualizing unsigned-integer data.
 */
function createUnormPipeline(
  ifd: ImageFileDirectory,
  device: Device,
): InferredRenderPipeline {
  const {
    BitsPerSample,
    ColorMap,
    GDAL_NODATA,
    PhotometricInterpretation,
    SampleFormat,
    SamplesPerPixel,
  } = ifd;
  const ownedTextures: Texture[] = [];

  const renderPipeline: UnresolvedRasterModule<TextureDataT>[] = [
    {
      module: CreateTexture,
      props: {
        textureName: (data: TextureDataT) => data.texture,
      },
    },
  ];

  // Add NoData filtering if GDAL_NODATA is defined.
  // Unorm textures sample in [0, 1], so the raw nodata value must be scaled
  // by the maximum representable value for the bit width.
  const noDataVal = parseGDALNoData(GDAL_NODATA);
  if (noDataVal !== null) {
    const bitWidth = BitsPerSample[0]!;
    const noDataScaled =
      bitWidth === 8
        ? noDataVal / 255
        : bitWidth === 16
          ? noDataVal / 65535
          : // 32-bit unorm is not present in FORMAT_TABLE; this branch is
            // unreachable today but keeps the scaling explicit.
            noDataVal;

    renderPipeline.push({
      module: FilterNoDataVal,
      props: { value: noDataScaled },
    });
  }

  const toRGBModule = photometricInterpretationToRGB(
    PhotometricInterpretation,
    device,
    ColorMap,
  );
  if (toRGBModule) {
    renderPipeline.push(toRGBModule);
    // The palette path owns a colormap texture that must be destroyed on
    // pipeline disposal. Capture it for the caller.
    if (
      PhotometricInterpretation === PhotometricInterpretationT.Palette &&
      toRGBModule.props &&
      "colormapTexture" in toRGBModule.props &&
      toRGBModule.props.colormapTexture
    ) {
      ownedTextures.push(toRGBModule.props.colormapTexture as Texture);
    }
  }

  // For palette images, use nearest-neighbor sampling
  const samplerOptions: SamplerProps =
    PhotometricInterpretation === PhotometricInterpretationT.Palette
      ? {
          magFilter: "nearest",
          minFilter: "nearest",
        }
      : {
          magFilter: "linear",
          minFilter: "linear",
        };

  const getTileData: COGLayerProps<TextureDataT>["getTileData"] = async (
    image: GeoTIFFImage,
    options: GetTileDataOptions,
  ) => {
    const { device } = options;
    const mergedOptions = {
      ...options,
      interleave: true,
    };

    let data: TypedArrayWithDimensions | ImageData = (await image.readRasters(
      mergedOptions,
    )) as TypedArrayWithDimensions;
    let numSamples = SamplesPerPixel;

    if (SamplesPerPixel === 3) {
      // WebGL2 doesn't have an RGB-only texture format; it requires RGBA.
      data = addAlphaChannel(data);
      numSamples = 4;
    }

    const textureFormat = inferTextureFormat(
      // Add one sample for added alpha channel
      numSamples,
      BitsPerSample,
      SampleFormat,
    );
    const texture = device.createTexture({
      data,
      format: textureFormat,
      width: data.width,
      height: data.height,
      sampler: samplerOptions,
    });

    return {
      texture,
      height: data.height,
      width: data.width,
    };
  };
  const renderTile: COGLayerProps<TextureDataT>["renderTile"] = (
    tileData: TextureDataT,
  ): RasterModule[] => {
    return renderPipeline.map((m, _i) => resolveModule(m, tileData));
  };

  return { getTileData, renderTile, ownedTextures };
}

/**
 * Create pipeline for visualizing continuous single-band float data.
 *
 * Requires `options.rescaleRange` — raw float values (elevation, NDVI,
 * temperature, etc.) have no inherent [0, 1] range, so the caller must
 * specify the data range for LUT indexing.
 */
function createFloatPipeline(
  ifd: ImageFileDirectory,
  device: Device,
  options: RenderPipelineOptions,
): InferredRenderPipeline {
  const { BitsPerSample, GDAL_NODATA, SampleFormat, SamplesPerPixel } = ifd;

  if (SamplesPerPixel !== 1) {
    throw new Error(
      `Float rasters with SamplesPerPixel > 1 are not yet supported. Got SamplesPerPixel=${SamplesPerPixel}.`,
    );
  }

  if (!options.rescaleRange) {
    throw new Error(
      `Float single-band rasters require rescaleRange: [min, max] for colormap rendering. ` +
        `Example: { rescaleRange: [0, 4000] } for a DEM in meters, or [-1, 1] for NDVI.`,
    );
  }

  const ownedTextures: Texture[] = [];
  const [rangeMin, rangeMax] = options.rescaleRange;

  const renderPipeline: UnresolvedRasterModule<TextureDataT>[] = [
    {
      module: CreateTexture,
      props: {
        textureName: (data: TextureDataT) => data.texture,
      },
    },
  ];

  // NoData filtering for floats: compare the raw float value directly,
  // not a unorm-scaled version.
  const noDataVal = parseGDALNoData(GDAL_NODATA);
  if (noDataVal !== null) {
    renderPipeline.push({
      module: FilterNoDataVal,
      props: { value: noDataVal },
    });
  }

  // Normalize raw data range to [0, 1] so Colormap can index the LUT.
  renderPipeline.push({
    module: Rescale,
    props: { rangeMin, rangeMax },
  });

  // Resolve the colormap into a GPU texture. Default to viridis.
  const colormapArg = options.colormap ?? "viridis";
  const colormapTexture = resolveColormapTexture(colormapArg, device);
  // Only track the texture for destroy() if we created it ourselves —
  // a user-supplied Texture is owned by the user.
  if (!(typeof colormapArg === "object" && !(colormapArg instanceof Uint8Array))) {
    ownedTextures.push(colormapTexture);
  }

  renderPipeline.push({
    module: Colormap,
    props: { colormapTexture },
  });

  // Infer the GPU texture format from IFD metadata. `FORMAT_TABLE` already
  // maps single-band floats to r32float/r16float.
  const textureFormat = inferTextureFormat(
    SamplesPerPixel,
    BitsPerSample,
    SampleFormat,
  );

  // Caveat: isTextureFormatSupported only verifies format existence, not
  // linear-filtering support. Many WebGL2 devices expose r32float but lack
  // OES_texture_float_linear, which can silently break the sampler. If
  // gradient smoothness breaks on target hardware, switch to "nearest"
  // sampling. TODO: add a runtime probe.
  if (!device.isTextureFormatSupported(textureFormat)) {
    throw new Error(
      `Texture format ${textureFormat} is not supported on this device. ` +
        `For r32float, consider converting your COG to float16 or uint16.`,
    );
  }

  const samplerOptions: SamplerProps = {
    magFilter: "linear",
    minFilter: "linear",
  };

  const getTileData: COGLayerProps<TextureDataT>["getTileData"] = async (
    image: GeoTIFFImage,
    opts: GetTileDataOptions,
  ) => {
    const { device: tileDevice } = opts;
    const mergedOptions = {
      ...opts,
      interleave: true,
    };

    const data = (await image.readRasters(
      mergedOptions,
    )) as TypedArrayWithDimensions;

    const texture = tileDevice.createTexture({
      data,
      format: textureFormat,
      width: data.width,
      height: data.height,
      sampler: samplerOptions,
    });

    return {
      texture,
      height: data.height,
      width: data.width,
    };
  };

  const renderTile: COGLayerProps<TextureDataT>["renderTile"] = (
    tileData: TextureDataT,
  ): RasterModule[] => {
    return renderPipeline.map((m, _i) => resolveModule(m, tileData));
  };

  return { getTileData, renderTile, ownedTextures };
}

/**
 * Turn a user-supplied colormap prop into a GPU `Texture`.
 *
 * - `ColormapName` (string): look up in bundled RAMPS
 * - `Uint8Array`: wrap as a custom LUT texture
 * - existing `Texture`: passthrough (user owns the lifetime)
 */
function resolveColormapTexture(
  arg: ColormapName | Uint8Array | Texture,
  device: Device,
): Texture {
  if (typeof arg === "string" || arg instanceof Uint8Array) {
    return createColormapTexture(device, arg);
  }
  return arg;
}

function photometricInterpretationToRGB(
  PhotometricInterpretation: number,
  device: Device,
  ColorMap?: Uint16Array,
): RasterModule | null {
  switch (PhotometricInterpretation) {
    case PhotometricInterpretationT.RGB:
      return null;
    // Single-channel grayscale: no color transform needed. The shader reads
    // color.r directly from the unorm texture. Users who want a colormap
    // should use the float pipeline or a custom renderTile.
    //
    // Note: WhiteIsZero is intentionally NOT handled here — its value
    // semantics require an inversion (color.r = 1.0 - color.r) which is
    // not yet implemented. TransparencyMask is also more nuanced than a
    // simple no-op, so leave it unhandled for now.
    case PhotometricInterpretationT.BlackIsZero:
      return null;
    case PhotometricInterpretationT.Palette: {
      if (!ColorMap) {
        throw new Error(
          "ColorMap is required for PhotometricInterpretation Palette",
        );
      }
      const { data, width, height } = parseColormap(ColorMap);
      const cmapTexture = device.createTexture({
        data,
        format: "rgba8unorm",
        width,
        height,
        sampler: {
          minFilter: "nearest",
          magFilter: "nearest",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge",
        },
      });
      return {
        module: Colormap,
        props: {
          colormapTexture: cmapTexture,
        },
      };
    }

    case PhotometricInterpretationT.CMYK:
      return {
        module: CMYKToRGB,
      };
    case PhotometricInterpretationT.YCbCr:
      return {
        module: YCbCrToRGB,
      };
    case PhotometricInterpretationT.CIELab:
      return {
        module: cieLabToRGB,
      };
    default:
      throw new Error(
        `Unsupported PhotometricInterpretation ${PhotometricInterpretation}`,
      );
  }
}

/**
 * If any prop of any module is a function, replace that prop value with the
 * result of that function
 */
function resolveModule<T>(m: UnresolvedRasterModule<T>, data: T): RasterModule {
  const { module, props } = m;

  if (!props) {
    return { module };
  }

  const resolvedProps: Record<string, number | Texture> = {};
  for (const [key, value] of Object.entries(props)) {
    const newValue = typeof value === "function" ? value(data) : value;
    if (newValue !== undefined) {
      resolvedProps[key] = newValue;
    }
  }

  return { module, props: resolvedProps };
}
