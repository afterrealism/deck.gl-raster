# cog-colormap-sveltekit

End-to-end demo of the single-band colormap feature in
`@afterrealism/deck.gl-raster`. Renders a synthetic float32 Cloud-Optimized
GeoTIFF (DEM) with a user-selectable matplotlib-style color ramp and a
live-adjustable value range.

## What it verifies

- `SampleFormat=3` (float) single-band COGs auto-dispatch to
  `createFloatPipeline`.
- `Rescale [min, max]` normalizes raw elevation (meters) into `[0, 1]`
  for LUT indexing.
- `Colormap` shader module samples the 256-entry LUT texture.
- Runtime colormap / rescaleRange changes rebuild the pipeline **without
  re-fetching the COG** (`_rebuildPipeline` path in `COGLayer`).
- Previous LUT textures are destroyed on swap (no GPU memory leak).

## Data

`static/dem.tif` is a 512×512 float32 COG in EPSG:3857, pre-generated:

- Pattern: Gaussian peak (~3000 m) + rolling sine hills + 500 m base.
- Data range: ~3 m (minimum) to ~3568 m (peak).
- Centered near Sydney, AU for an easy-to-spot location on the basemap.
- 1.15 MB on disk (DEFLATE compression, 256-px blocks, one overview).

Regenerate with:

```bash
cd examples/cog-colormap-sveltekit
python3 scripts/generate-dem.py
```

Requires `rasterio`, `numpy`, and `gdal_translate` on `PATH`.

## Running

```bash
# From the repo root — build the library first so file:../.. resolves
pnpm install
pnpm build

# Start the example dev server
cd examples/cog-colormap-sveltekit
pnpm install
pnpm dev
```

Then open http://localhost:5173/ (or whichever port Vite picks).

## Controls

- **Colormap dropdown** — viridis / magma / plasma / turbo / terrain.
  Switching triggers a pipeline rebuild in `COGLayer.updateState` without
  re-fetching the COG.
- **Min / Max sliders** — adjust the `rescaleRange` live. The default
  `[0, 4000]` m range covers the full data span; clamping to e.g.
  `[1000, 3000]` shows how values outside the range are clipped.

## Code highlights

The whole feature surface is ~3 lines on `COGLayer`:

```ts
new COGLayer({
  geotiff: '/dem.tif',
  colormap: 'viridis',        // named ramp | Uint8Array | Texture
  rescaleRange: [0, 4000],    // required for float single-band data
});
```

See `src/routes/+page.svelte` for the reactive wiring.

## Notes

- The `[WebGL] byteLength not defined in tile data` warning in the console
  comes from deck.gl's `TileLayer` cache bookkeeping — it also affects the
  existing 8-bit palette path and is unrelated to this feature.
- Single-band rasters require WebGL2 with `r32float` or `r16float` format
  support. On hardware without `OES_texture_float_linear`, gradients may
  look stepped — see the caveat in the main README.
