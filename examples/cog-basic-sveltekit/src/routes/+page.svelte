<script lang="ts">
    import { onMount } from "svelte";
    import { Deck } from "@deck.gl/core";
    import { TileLayer } from "@deck.gl/geo-layers";
    import { BitmapLayer } from "@deck.gl/layers";
    import { COGLayer } from "@afterrealism/deck.gl-raster";

    let deckContainer: HTMLDivElement;
    let deck: Deck | null = null;

    let debug = $state(false);
    let debugOpacity = $state(0.25);

    const COG_URL =
        "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/18/T/WL/2026/1/S2B_18TWL_20260101_0_L2A/TCI.tif";

    function createBaseTileLayer() {
        return new TileLayer({
            id: "osm-tiles",
            data: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
            maxZoom: 19,
            tileSize: 256,
            renderSubLayers: (props) => {
                if (!props.data) return null;
                const {
                    boundingBox: [[west, south], [east, north]],
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
            debug,
            debugOpacity,
            maxConcurrentRequests: 20, // Max parallel tile downloads
            maxRequestsPerFrame: 10, // Max new requests per frame
            maxCacheSize: 500, // Large cache prevents tiles disappearing during zoom
            maxCacheByteSize: 500 * 1024 * 1024, // 500MB keeps tiles across zoom levels
            onGeoTIFFLoad: (_tiff, options) => {
                const { west, south, east, north } = options.geographicBounds;
                deck?.setProps({
                    initialViewState: {
                        longitude: (west + east) / 2,
                        latitude: (south + north) / 2,
                        zoom: 10,
                        pitch: 0,
                        bearing: 0,
                    },
                });
            },
        });
    }

    function updateLayers() {
        if (deck) {
            deck.setProps({
                layers: [createBaseTileLayer(), createCOGLayer()],
            });
        }
    }

    // Update deck layers when debug settings change
    $effect(() => {
        debug;
        debugOpacity;
        updateLayers();
    });

    onMount(() => {
        deck = new Deck({
            parent: deckContainer,
            initialViewState: {
                longitude: 0,
                latitude: 0,
                zoom: 3,
                pitch: 0,
                bearing: 0,
            },
            controller: true,
            layers: [createBaseTileLayer(), createCOGLayer()],
        });

        return () => {
            deck?.finalize();
        };
    });
</script>

<div class="container">
    <div class="deck" bind:this={deckContainer}></div>

    <div class="ui-overlay">
        <div class="panel">
            <h3 class="title">COGLayer Example</h3>

            <div class="debug-section">
                <label class="checkbox-label">
                    <input type="checkbox" bind:checked={debug} />
                    <span>Show Debug Mesh</span>
                </label>

                {#if debug}
                    <div class="opacity-control">
                        <label class="opacity-label">
                            Debug Opacity: {debugOpacity.toFixed(2)}
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                bind:value={debugOpacity}
                            />
                        </label>
                    </div>
                {/if}
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
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        max-width: 300px;
        pointer-events: auto;
    }

    .title {
        margin: 0 0 8px 0;
        font-size: 16px;
    }

    .debug-section {
        padding: 12px 0;
        border-top: 1px solid #eee;
        margin-top: 12px;
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        cursor: pointer;
        margin-bottom: 12px;
    }

    .checkbox-label input {
        cursor: pointer;
    }

    .opacity-control {
        margin-top: 8px;
    }

    .opacity-label {
        display: block;
        font-size: 12px;
        color: #666;
        margin-bottom: 4px;
    }

    .opacity-label input {
        width: 100%;
        cursor: pointer;
    }
</style>
