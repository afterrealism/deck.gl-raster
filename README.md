# deck.gl-raster

> **Note:** This is an experimental fork that only accepts data in Web Mercator (EPSG:3857) and aggressively loads tiles. For the original library with full projection support, use [developmentseed/deck.gl-raster](https://github.com/developmentseed/deck.gl-raster).

GPU-accelerated [Cloud-Optimized GeoTIFF][cogeo] (COG) visualization in [deck.gl].

[cogeo]: https://cogeo.org/
[deck.gl]: https://deck.gl/

## Installation

```bash
npm install @afterrealism/deck.gl-raster
```

## Quick Start

```typescript
import { Deck } from '@deck.gl/core';
import { COGLayer } from '@afterrealism/deck.gl-raster';

new Deck({
  initialViewState: {
    longitude: 0,
    latitude: 0,
    zoom: 2
  },
  controller: true,
  layers: [
    new COGLayer({
      id: 'cog-layer',
      geotiff: 'https://example.com/my-cog.tif'
    })
  ]
});
```

## Single-band colormap

For continuous single-band float rasters (DEM, NDVI, temperature, SAR backscatter), pass a named ramp and a data range:

```typescript
new COGLayer({
  id: 'dem',
  geotiff: 'https://example.com/dem.tif',    // float32 single-band
  colormap: 'viridis',                        // or 'magma' | 'plasma' | 'turbo' | 'terrain'
  rescaleRange: [0, 4000],                    // meters; use [-1, 1] for NDVI
});
```

`colormap` also accepts a custom 256-entry RGBA8 `Uint8Array`, or a pre-built luma.gl `Texture` for fully custom LUTs:

```typescript
import { createColormapTexture } from '@afterrealism/deck.gl-raster/gpu-modules';

// Custom LUT: 256 * 4 bytes, RGBA8
const customLut = new Uint8Array(256 * 4);
// ... fill with your colors ...

new COGLayer({
  geotiff: 'https://example.com/ndvi.tif',
  colormap: customLut,
  rescaleRange: [-1, 1],
});
```

Runtime colormap changes rebuild the render pipeline without re-fetching the COG. Previous LUT textures are destroyed automatically on swap and on layer teardown.

**Caveats:**
- 8-bit paletted COGs use the embedded palette — `colormap` is ignored.
- Multi-band float and signed-integer rasters are not yet supported.
- `GeoTIFFLayer` (non-tiled) does not yet support these props.
- Float pipelines require `rescaleRange`; missing it throws at parse time.

## Examples

SvelteKit examples are included:

| Example | Description |
| ------- | ----------- |
| `cog-basic-sveltekit` | Basic COG visualization |
| `land-cover-sveltekit` | Land cover COG with colormap |
| `drone-sveltekit` | Drone orthophoto visualization |

### Running Examples

```bash
# Install and build
pnpm install
pnpm build

# Run an example
cd examples/cog-basic-sveltekit
pnpm dev
```

Dev server starts at `http://localhost:5173`.

## Development

```bash
pnpm install      # Install dependencies
pnpm build        # Build
pnpm build:watch  # Watch mode
pnpm test         # Run tests
pnpm check:fix    # Lint and format
```

## License

MIT
