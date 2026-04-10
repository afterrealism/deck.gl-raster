#!/usr/bin/env python3
"""
Generate the synthetic float32 Cloud-Optimized GeoTIFF used by this example.

The demo ships a pre-generated ``static/dem.tif``; run this script to
reproduce it (or to experiment with different data patterns / ranges).

Requirements:
    pip install rasterio numpy
    # plus gdal_translate on PATH for the COG translate step

Output:
    examples/cog-colormap-sveltekit/static/dem.tif
    - 512x512 float32 single-band
    - EPSG:3857 (Web Mercator) — the library is Web Mercator only
    - Centered near Sydney, AU
    - Elevation pattern: radial peak (~3000m) + sinusoidal hills + base
    - DEFLATE compression, 256px block size, one AVERAGE-resampled overview
"""

import os
import subprocess
import sys

import numpy as np
import rasterio
from rasterio.transform import from_origin

WIDTH = 512
HEIGHT = 512
PIXEL_SIZE = 100.0  # meters per pixel

# Sydney in EPSG:3857 (roughly)
CENTER_X = 16832000
CENTER_Y = -4009000

# Upper-left corner in EPSG:3857
UL_X = CENTER_X - (WIDTH * PIXEL_SIZE / 2)
UL_Y = CENTER_Y + (HEIGHT * PIXEL_SIZE / 2)

OUT_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..",
    "static",
    "dem.tif",
)
TMP_PATH = "/tmp/dem_synthetic_intermediate.tif"


def build_elevation() -> np.ndarray:
    """Synthetic elevation: radial peak + rolling sine hills + base."""
    y_coords, x_coords = np.mgrid[0:HEIGHT, 0:WIDTH]
    cy, cx = HEIGHT / 2, WIDTH / 2
    r = np.sqrt((x_coords - cx) ** 2 + (y_coords - cy) ** 2)

    # Gaussian peak at center ~ 3000m tall
    peak = 3000.0 * np.exp(-((r / 120.0) ** 2))
    # Rolling hills so the colormap shows texture
    waves = 500.0 * np.sin(x_coords / 40.0) * np.cos(y_coords / 50.0)
    base = 500.0

    return (base + peak + waves).astype(np.float32)


def write_intermediate(elevation: np.ndarray) -> None:
    transform = from_origin(UL_X, UL_Y, PIXEL_SIZE, PIXEL_SIZE)
    with rasterio.open(
        TMP_PATH,
        "w",
        driver="GTiff",
        height=HEIGHT,
        width=WIDTH,
        count=1,
        dtype="float32",
        crs="EPSG:3857",
        transform=transform,
        compress="deflate",
    ) as dst:
        dst.write(elevation, 1)


def translate_to_cog() -> None:
    result = subprocess.run(
        [
            "gdal_translate",
            "-of",
            "COG",
            "-co",
            "COMPRESS=DEFLATE",
            "-co",
            "BLOCKSIZE=256",
            "-co",
            "RESAMPLING=AVERAGE",
            TMP_PATH,
            OUT_PATH,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stdout)
        sys.stderr.write(result.stderr)
        raise SystemExit(f"gdal_translate failed with code {result.returncode}")


def verify() -> None:
    with rasterio.open(OUT_PATH) as src:
        data = src.read(1)
        print(f"Wrote {OUT_PATH}")
        print(f"  CRS:       {src.crs}")
        print(f"  Dtype:     {src.dtypes}")
        print(f"  Shape:     {src.width}x{src.height}")
        print(f"  Bounds:    {src.bounds}")
        print(f"  Min/Max:   {data.min():.1f} / {data.max():.1f}")
        print(f"  Overviews: {src.overviews(1)}")
        print(f"  File size: {os.path.getsize(OUT_PATH):,} bytes")


def main() -> None:
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    elevation = build_elevation()
    write_intermediate(elevation)
    translate_to_cog()
    verify()


if __name__ == "__main__":
    main()
