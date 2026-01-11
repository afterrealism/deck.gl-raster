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
