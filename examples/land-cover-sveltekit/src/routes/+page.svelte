<script lang="ts">
    import { onMount } from "svelte";
    import { Deck } from "@deck.gl/core";
    import { TileLayer } from "@deck.gl/geo-layers";
    import { BitmapLayer } from "@deck.gl/layers";
    import { COGLayer } from "@afterrealism/deck.gl-raster";
    import InfoPanel from "$lib/InfoPanel.svelte";

    let deckContainer: HTMLDivElement;
    let deck: Deck | null = null;

    let debug = $state(false);
    let debugOpacity = $state(0.25);

    const COG_URL =
        "https://s3.us-east-1.amazonaws.com/ds-deck.gl-raster-public/cog/Annual_NLCD_LndCov_2024_CU_C1V1.tif";

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
            onGeoTIFFLoad: (_tiff, options) => {
                const { west, south, east, north } = options.geographicBounds;
                deck?.setProps({
                    initialViewState: {
                        longitude: (west + east) / 2,
                        latitude: (south + north) / 2,
                        zoom: 4,
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
                longitude: -95,
                latitude: 40,
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
        <InfoPanel bind:debug bind:debugOpacity />
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
</style>
