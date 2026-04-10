import type { ShaderModule } from "@luma.gl/shadertools";

// Props expected by the Rescale shader module
export type RescaleProps = {
  /** Lower bound of the input data range. Mapped to 0.0 in the output. */
  rangeMin: number;
  /** Upper bound of the input data range. Mapped to 1.0 in the output. */
  rangeMax: number;
};

const MODULE_NAME = "rescale";

const uniformBlock = `\
uniform ${MODULE_NAME}Uniforms {
  float rangeMin;
  float rangeMax;
} ${MODULE_NAME};
`;

/**
 * A shader module that normalizes `color.r` from an arbitrary `[rangeMin,
 * rangeMax]` range into `[0, 1]`, so downstream `Colormap` can index the LUT
 * correctly for continuous float rasters (DEM, NDVI, temperature, etc.).
 *
 * Values outside the range are clamped. If `rangeMax <= rangeMin`, `color.r`
 * is set to 0 to avoid division by zero or negative ranges.
 *
 * Run this **before** `Colormap` in the pipeline.
 */
export const Rescale = {
  name: MODULE_NAME,
  fs: uniformBlock,
  inject: {
    "fs:DECKGL_FILTER_COLOR": /* glsl */ `
    float rescale_span = rescale.rangeMax - rescale.rangeMin;
    color.r = rescale_span > 0.0
      ? clamp((color.r - rescale.rangeMin) / rescale_span, 0.0, 1.0)
      : 0.0;
    `,
  },
  uniformTypes: {
    rangeMin: "f32",
    rangeMax: "f32",
  },
  getUniforms: (props: Partial<RescaleProps>) => {
    return {
      rangeMin: props.rangeMin,
      rangeMax: props.rangeMax,
    };
  },
} as const satisfies ShaderModule<RescaleProps>;
