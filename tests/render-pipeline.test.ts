import type { RasterModule } from "../src/gpu-modules/types";
import { globals } from "geotiff";
import { describe, expect, it } from "vitest";
import { createColormapTexture, RAMPS } from "../src/gpu-modules/ramps";
import type { ColormapName } from "../src/gpu-modules/ramps";
import { Rescale } from "../src/gpu-modules/rescale";
import { inferRenderPipeline } from "../src/geotiff-loader/render-pipeline";
import type { ImageFileDirectory } from "../src/geotiff-loader/types";

const MOCK_DEVICE = {
  createTexture: (x: any) => x,
};
const MOCK_RENDER_TILE_DATA = {
  texture: {},
};

// import {} from "@"
type RelevantImageFileDirectory = Pick<
  ImageFileDirectory,
  | "BitsPerSample"
  | "ColorMap"
  | "GDAL_NODATA"
  | "PhotometricInterpretation"
  | "SampleFormat"
  | "SamplesPerPixel"
>;

describe("land cover, single-band uint8", () => {
  const ifd: RelevantImageFileDirectory = {
    BitsPerSample: new Uint16Array([8]),
    ColorMap: new Uint16Array([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 17990, 53713, 0, 0, 0, 0, 0, 0, 0, 0,
      57054, 55769, 60395, 43947, 0, 0, 0, 0, 0, 0, 46003, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 26728, 7196, 46517, 0, 0, 0, 0, 0, 0, 0, 0, 52428, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 57311, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      56540, 43947, 0, 0, 0, 0, 0, 0, 0, 47288, 0, 0, 0, 0, 27756, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 27499, 57054, 0, 0, 0,
      0, 0, 0, 0, 0, 50629, 37522, 0, 0, 0, 0, 0, 0, 0, 0, 44204, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 43947, 24415, 50629, 0, 0, 0, 0, 0, 0, 0, 0, 47288, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 57311, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 55769, 27756, 0, 0, 0, 0, 0, 0, 0, 55769, 0, 0, 0, 0, 40863, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 40863, 63736, 0,
      0, 0, 0, 0, 0, 0, 0, 50629, 33410, 0, 0, 0, 0, 0, 0, 0, 0, 40863, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 24415, 11308, 36751, 0, 0, 0, 0, 0, 0, 0, 0, 31097, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 49858, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 14649, 10280, 0, 0, 0, 0, 0, 0, 0, 60395, 0, 0, 0, 0, 47288,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]),
    GDAL_NODATA: "250\u0000",
    PhotometricInterpretation: globals.photometricInterpretations.Palette,
    SampleFormat: new Uint16Array([1]),
    SamplesPerPixel: 1,
  };

  const { getTileData: _, renderTile } = inferRenderPipeline(
    ifd as ImageFileDirectory,
    MOCK_DEVICE as any,
  );
  const renderPipeline = renderTile(
    MOCK_RENDER_TILE_DATA as any,
  ) as RasterModule[];

  it("Test render pipeline inference", () => {
    expect(Array.isArray(renderPipeline)).toBeTruthy();
    expect(renderPipeline[0]?.module.name).toEqual("create-texture-unorm");

    expect(renderPipeline[1]?.module.name).toEqual("nodata");
    expect(renderPipeline[1]?.props?.value).toEqual(250 / 255.0);

    expect(renderPipeline[2]?.module.name).toEqual("colormap");
    expect(renderPipeline[2]?.props?.colormapTexture).toBeDefined();
  });
});

describe("Rescale shader module", () => {
  it("has the expected name", () => {
    expect(Rescale.name).toEqual("rescale");
  });

  it("declares f32 uniforms for rangeMin and rangeMax", () => {
    expect(Rescale.uniformTypes.rangeMin).toEqual("f32");
    expect(Rescale.uniformTypes.rangeMax).toEqual("f32");
  });

  it("returns uniforms from props", () => {
    const uniforms = Rescale.getUniforms({ rangeMin: 0, rangeMax: 4000 });
    expect(uniforms).toEqual({ rangeMin: 0, rangeMax: 4000 });
  });

  it("returns uniforms for negative ranges (e.g. NDVI [-1, 1])", () => {
    const uniforms = Rescale.getUniforms({ rangeMin: -1, rangeMax: 1 });
    expect(uniforms).toEqual({ rangeMin: -1, rangeMax: 1 });
  });

  it("injects into fs:DECKGL_FILTER_COLOR", () => {
    expect(Rescale.inject["fs:DECKGL_FILTER_COLOR"]).toBeDefined();
    expect(Rescale.inject["fs:DECKGL_FILTER_COLOR"]).toContain("clamp");
    expect(Rescale.inject["fs:DECKGL_FILTER_COLOR"]).toContain("rescale.rangeMin");
    expect(Rescale.inject["fs:DECKGL_FILTER_COLOR"]).toContain("rescale.rangeMax");
  });
});

describe("colormap ramps", () => {
  const ALL_NAMES: ColormapName[] = [
    "viridis",
    "magma",
    "plasma",
    "turbo",
    "terrain",
  ];

  it("exposes all 5 named ramps as Uint8Array(256 * 4)", () => {
    for (const name of ALL_NAMES) {
      const ramp = RAMPS[name];
      expect(ramp).toBeInstanceOf(Uint8Array);
      expect(ramp.length).toEqual(256 * 4);
    }
  });

  it("has opaque alpha on every entry (alpha byte = 255)", () => {
    for (const name of ALL_NAMES) {
      const ramp = RAMPS[name];
      // Spot-check: first and last entries
      expect(ramp[3]).toEqual(255);
      expect(ramp[ramp.length - 1]).toEqual(255);
      // Exhaustive alpha check on viridis (one ramp is enough to catch generation bugs)
      if (name === "viridis") {
        for (let i = 3; i < ramp.length; i += 4) {
          expect(ramp[i]).toEqual(255);
        }
      }
    }
  });

  it("createColormapTexture returns a config with correct shape for each named ramp", () => {
    for (const name of ALL_NAMES) {
      const tex = createColormapTexture(MOCK_DEVICE as any, name) as any;
      expect(tex.format).toEqual("rgba8unorm");
      expect(tex.width).toEqual(256);
      expect(tex.height).toEqual(1);
      expect(tex.data).toBeInstanceOf(Uint8Array);
      expect((tex.data as Uint8Array).length).toEqual(256 * 4);
      expect(tex.sampler?.minFilter).toEqual("linear");
      expect(tex.sampler?.magFilter).toEqual("linear");
      expect(tex.sampler?.addressModeU).toEqual("clamp-to-edge");
    }
  });

  it("createColormapTexture throws for unknown names", () => {
    expect(() =>
      createColormapTexture(MOCK_DEVICE as any, "nonexistent" as any),
    ).toThrow(/Unknown colormap/);
  });

  it("createColormapTexture accepts a custom 256*4-byte Uint8Array", () => {
    const custom = new Uint8Array(256 * 4);
    custom.fill(128);
    const tex = createColormapTexture(MOCK_DEVICE as any, custom) as any;
    expect(tex.data).toBe(custom);
    expect(tex.format).toEqual("rgba8unorm");
  });

  it("createColormapTexture rejects wrong-length custom arrays", () => {
    expect(() =>
      createColormapTexture(MOCK_DEVICE as any, new Uint8Array(100)),
    ).toThrow(/exactly 1024 bytes/);
    expect(() =>
      createColormapTexture(MOCK_DEVICE as any, new Uint8Array(2000)),
    ).toThrow(/exactly 1024 bytes/);
  });
});

describe("single-band float32 elevation pipeline", () => {
  const FLOAT_DEVICE = {
    createTexture: (x: any) => x,
    isTextureFormatSupported: () => true,
  };

  const ifd: Pick<
    ImageFileDirectory,
    | "BitsPerSample"
    | "GDAL_NODATA"
    | "PhotometricInterpretation"
    | "SampleFormat"
    | "SamplesPerPixel"
  > = {
    BitsPerSample: new Uint16Array([32]),
    GDAL_NODATA: "-9999\u0000",
    // Float single-band rasters typically have no meaningful photometric
    // interpretation; use BlackIsZero as a placeholder so the test fixture
    // is well-formed.
    PhotometricInterpretation:
      globals.photometricInterpretations.BlackIsZero ?? 1,
    SampleFormat: new Uint16Array([3]),
    SamplesPerPixel: 1,
  };

  it("builds CreateTexture → FilterNoDataVal → Rescale → Colormap", () => {
    const { getTileData: _, renderTile, ownedTextures } = inferRenderPipeline(
      ifd as ImageFileDirectory,
      FLOAT_DEVICE as any,
      { rescaleRange: [0, 4000], colormap: "viridis" },
    );
    const pipeline = renderTile({ texture: {} } as any) as RasterModule[];

    expect(pipeline).toHaveLength(4);
    expect(pipeline[0]?.module.name).toEqual("create-texture-unorm");
    expect(pipeline[1]?.module.name).toEqual("nodata");
    expect(pipeline[2]?.module.name).toEqual("rescale");
    expect(pipeline[3]?.module.name).toEqual("colormap");

    // NoData is the raw float, NOT scaled by 255 or 65535.
    expect(pipeline[1]?.props?.value).toEqual(-9999);

    // Rescale is parameterized directly from options.
    expect(pipeline[2]?.props?.rangeMin).toEqual(0);
    expect(pipeline[2]?.props?.rangeMax).toEqual(4000);

    // Colormap texture is populated.
    expect(pipeline[3]?.props?.colormapTexture).toBeDefined();

    // Caller owns exactly one texture (the viridis LUT).
    expect(ownedTextures).toHaveLength(1);
  });

  it("defaults to viridis when colormap is omitted", () => {
    const { renderTile } = inferRenderPipeline(
      ifd as ImageFileDirectory,
      FLOAT_DEVICE as any,
      { rescaleRange: [-1, 1] },
    );
    const pipeline = renderTile({ texture: {} } as any) as RasterModule[];
    expect(pipeline[3]?.module.name).toEqual("colormap");
    const cmapTex = pipeline[3]?.props?.colormapTexture as any;
    expect(cmapTex?.format).toEqual("rgba8unorm");
    expect(cmapTex?.width).toEqual(256);
  });

  it("supports negative rescaleRange for NDVI [-1, 1]", () => {
    const { renderTile } = inferRenderPipeline(
      ifd as ImageFileDirectory,
      FLOAT_DEVICE as any,
      { rescaleRange: [-1, 1] },
    );
    const pipeline = renderTile({ texture: {} } as any) as RasterModule[];
    expect(pipeline[2]?.props?.rangeMin).toEqual(-1);
    expect(pipeline[2]?.props?.rangeMax).toEqual(1);
  });

  it("throws if rescaleRange is missing", () => {
    expect(() =>
      inferRenderPipeline(ifd as ImageFileDirectory, FLOAT_DEVICE as any, {}),
    ).toThrow(/rescaleRange/);
  });

  it("throws for multi-band float rasters", () => {
    const multiBand = { ...ifd, SamplesPerPixel: 3 } as ImageFileDirectory;
    expect(() =>
      inferRenderPipeline(multiBand, FLOAT_DEVICE as any, {
        rescaleRange: [0, 1],
      }),
    ).toThrow(/SamplesPerPixel > 1/);
  });

  it("throws when the device does not support the required texture format", () => {
    const weakDevice = {
      createTexture: (x: any) => x,
      isTextureFormatSupported: () => false,
    };
    expect(() =>
      inferRenderPipeline(ifd as ImageFileDirectory, weakDevice as any, {
        rescaleRange: [0, 4000],
      }),
    ).toThrow(/not supported on this device/);
  });

  it("does not own a user-supplied Texture", () => {
    // A user-built Texture looks like a plain object (not a string, not a
    // Uint8Array). We simulate one here; the mock device's `createTexture`
    // passthrough would also return a plain object, so the discriminator is
    // "string or Uint8Array" ⇒ we created it.
    const userTexture = { _userOwned: true } as any;
    const { ownedTextures } = inferRenderPipeline(
      ifd as ImageFileDirectory,
      FLOAT_DEVICE as any,
      { rescaleRange: [0, 1], colormap: userTexture },
    );
    expect(ownedTextures).toHaveLength(0);
  });

  it("rejects signed-integer rasters with a clear message", () => {
    const sintIfd = {
      ...ifd,
      SampleFormat: new Uint16Array([2]),
    } as ImageFileDirectory;
    expect(() =>
      inferRenderPipeline(sintIfd, FLOAT_DEVICE as any, {
        rescaleRange: [0, 1],
      }),
    ).toThrow(/Signed integer/);
  });
});

describe("16-bit unorm nodata scaling (regression)", () => {
  const ifd: Pick<
    ImageFileDirectory,
    | "BitsPerSample"
    | "GDAL_NODATA"
    | "PhotometricInterpretation"
    | "SampleFormat"
    | "SamplesPerPixel"
  > = {
    BitsPerSample: new Uint16Array([16]),
    GDAL_NODATA: "500\u0000",
    PhotometricInterpretation:
      globals.photometricInterpretations.BlackIsZero ?? 1,
    SampleFormat: new Uint16Array([1]),
    SamplesPerPixel: 1,
  };

  it("scales nodata by 65535, not 255, for 16-bit unorm", () => {
    const { renderTile } = inferRenderPipeline(
      ifd as ImageFileDirectory,
      MOCK_DEVICE as any,
    );
    const pipeline = renderTile(MOCK_RENDER_TILE_DATA as any) as RasterModule[];
    const nodata = pipeline.find((m) => m.module.name === "nodata");
    expect(nodata).toBeDefined();
    expect(nodata?.props?.value).toEqual(500 / 65535);
  });
});
