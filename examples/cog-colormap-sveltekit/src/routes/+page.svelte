<script lang="ts">
    import { onMount } from "svelte";
    import { Deck } from "@deck.gl/core";
    import { TileLayer } from "@deck.gl/geo-layers";
    import { BitmapLayer } from "@deck.gl/layers";
    import { COGLayer } from "@afterrealism/deck.gl-raster";
    import type { ColormapName } from "@afterrealism/deck.gl-raster/gpu-modules";

    let deckContainer: HTMLDivElement;
    let deck: Deck | null = null;

    // Synthetic float32 DEM served from /static — see scripts/generate-dem.py
    // Data range: ~3 to ~3568 meters.
    const COG_URL = "/dem.tif";
    const RAMPS: ColormapName[] = [
        "viridis",
        "magma",
        "plasma",
        "turbo",
        "terrain",
    ];

    let colormap = $state<ColormapName>("viridis");
    let rangeMin = $state(0);
    let rangeMax = $state(4000);
    let status = $state("initializing…");
    let loadError = $state<string | null>(null);

    function createBaseTileLayer() {
        return new TileLayer({
            id: "osm-tiles",
            data: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
            maxZoom: 19,
            tileSize: 256,
            renderSubLayers: (props) => {
                if (!props.data) return null;
                const {
                    boundingBox: [
                        [west, south],
                        [east, north],
                    ],
                } = props.tile;
                return new BitmapLayer(props, {
                    data: undefined,
                    image: props.data,
                    bounds: [west, south, east, north],
                });
            },
        });
    }

    function createCOGLayer() {
        return new COGLayer({
            id: "cog-layer",
            geotiff: COG_URL,
            colormap,
            rescaleRange: [rangeMin, rangeMax],
            maxConcurrentRequests: 20,
            maxRequestsPerFrame: 10,
            maxCacheSize: 500,
            maxCacheByteSize: 500 * 1024 * 1024,
            onGeoTIFFLoad: (_tiff, options) => {
                const { west, south, east, north } = options.geographicBounds;
                status = `loaded · bbox ${west.toFixed(3)}, ${south.toFixed(3)} → ${east.toFixed(3)}, ${north.toFixed(3)}`;
                deck?.setProps({
                    initialViewState: {
                        longitude: (west + east) / 2,
                        latitude: (south + north) / 2,
                        zoom: 11,
                        pitch: 0,
                        bearing: 0,
                    },
                });
            },
        });
    }

    function updateLayers() {
        if (!deck) return;
        try {
            deck.setProps({
                layers: [createBaseTileLayer(), createCOGLayer()],
            });
            loadError = null;
        } catch (err) {
            loadError = err instanceof Error ? err.message : String(err);
            console.error("Layer update failed:", err);
        }
    }

    // React to colormap/range changes — verifies the runtime pipeline rebuild
    // path (no COG re-fetch, old LUT texture destroyed).
    $effect(() => {
        colormap;
        rangeMin;
        rangeMax;
        updateLayers();
    });

    onMount(() => {
        try {
            deck = new Deck({
                parent: deckContainer,
                initialViewState: {
                    longitude: 151.21,
                    latitude: -33.87,
                    zoom: 10,
                    pitch: 0,
                    bearing: 0,
                },
                controller: true,
                layers: [createBaseTileLayer(), createCOGLayer()],
                onError: (err) => {
                    loadError = err.message;
                    console.error("Deck error:", err);
                },
            });
            status = "deck mounted · loading COG…";
        } catch (err) {
            loadError = err instanceof Error ? err.message : String(err);
            console.error("Deck mount failed:", err);
        }

        return () => {
            deck?.finalize();
        };
    });
</script>

<div class="container">
    <div class="deck" bind:this={deckContainer}></div>

    <div class="ui-overlay">
        <div class="panel">
            <h3 class="title">Single-Band Colormap Demo</h3>
            <p class="subtitle">
                Synthetic float32 DEM · EPSG:3857 · rendered via new colormap
                pipeline
            </p>

            <div class="section">
                <label class="field">
                    <span class="label">Colormap</span>
                    <select bind:value={colormap}>
                        {#each RAMPS as ramp}
                            <option value={ramp}>{ramp}</option>
                        {/each}
                    </select>
                </label>
            </div>

            <div class="section">
                <label class="field">
                    <span class="label">Min: {rangeMin} m</span>
                    <input
                        type="range"
                        min="-500"
                        max="2000"
                        step="50"
                        bind:value={rangeMin}
                    />
                </label>
                <label class="field">
                    <span class="label">Max: {rangeMax} m</span>
                    <input
                        type="range"
                        min="1000"
                        max="5000"
                        step="50"
                        bind:value={rangeMax}
                    />
                </label>
            </div>

            <div class="status" data-error={loadError !== null}>
                {loadError ?? status}
            </div>

            <div class="hint">
                Switch the colormap dropdown — the layer should rebuild its
                pipeline without re-fetching the COG.
            </div>
        </div>
    </div>
</div>

<style>
    .container {
        position: relative;
        width: 100vw;
        height: 100vh;
    }

    .deck {
        width: 100%;
        height: 100%;
    }

    .ui-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1000;
    }

    .panel {
        position: absolute;
        top: 20px;
        left: 20px;
        background: white;
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        max-width: 320px;
        pointer-events: auto;
        font-family:
            -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .title {
        margin: 0 0 4px 0;
        font-size: 16px;
    }

    .subtitle {
        margin: 0 0 12px 0;
        font-size: 11px;
        color: #666;
    }

    .section {
        padding: 12px 0;
        border-top: 1px solid #eee;
    }

    .field {
        display: block;
        font-size: 13px;
        margin-bottom: 8px;
    }

    .field:last-child {
        margin-bottom: 0;
    }

    .label {
        display: block;
        color: #444;
        margin-bottom: 4px;
    }

    .field select,
    .field input[type="range"] {
        width: 100%;
        cursor: pointer;
    }

    .field select {
        padding: 4px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
    }

    .status {
        padding: 8px 10px;
        border-top: 1px solid #eee;
        margin-top: 12px;
        font-size: 11px;
        color: #666;
        font-family: monospace;
        word-break: break-all;
    }

    .status[data-error="true"] {
        color: #c00;
        background: #fee;
        border-radius: 4px;
    }

    .hint {
        margin-top: 8px;
        font-size: 11px;
        color: #888;
        font-style: italic;
    }
</style>
