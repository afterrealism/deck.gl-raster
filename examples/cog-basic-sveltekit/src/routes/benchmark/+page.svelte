<script lang="ts">
    import { onMount } from "svelte";
    import { Deck } from "@deck.gl/core";
    import { TileLayer } from "@deck.gl/geo-layers";
    import { BitmapLayer } from "@deck.gl/layers";
    import { COGLayer } from "@afterrealism/deck.gl-raster";

    let deckContainer: HTMLDivElement;
    let deck: Deck | null = null;

    interface BenchmarkResult {
        operation: string;
        duration: number;
        timestamp: number;
        details?: string;
    }

    let benchmarkResults = $state<BenchmarkResult[]>([]);
    let isRunning = $state(false);
    let currentTest = $state("");

    const COG_URL =
        "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/18/T/WL/2026/1/S2B_18TWL_20260101_0_L2A/TCI.tif";

    function addResult(operation: string, duration: number, details?: string) {
        benchmarkResults.push({
            operation,
            duration,
            timestamp: Date.now(),
            details,
        });
    }

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
        const layerCreateStart = performance.now();

        const layer = new COGLayer({
            id: "cog-layer",
            geotiff: COG_URL,
            onGeoTIFFLoad: (tiff, options) => {
                const loadTime = performance.now() - layerCreateStart;
                addResult(
                    "Total GeoTIFF load time",
                    loadTime,
                    `Bounds: ${JSON.stringify(options.geographicBounds)}`,
                );

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
            onTileLoad: (tile) => {
                // Tile-level benchmarking happens in instrumented version
            },
        });

        const layerCreateTime = performance.now() - layerCreateStart;
        addResult("COGLayer instantiation", layerCreateTime);

        return layer;
    }

    async function runBenchmark() {
        isRunning = true;
        benchmarkResults = [];
        currentTest = "Starting benchmark...";

        try {
            // 1. Test fetch performance
            currentTest = "Testing GeoTIFF fetch...";
            const fetchStart = performance.now();
            const response = await fetch(COG_URL, { method: "HEAD" });
            const fetchTime = performance.now() - fetchStart;
            addResult(
                "HTTP HEAD request",
                fetchTime,
                `Status: ${response.status}, Size: ${response.headers.get("content-length")}`,
            );

            // 2. Test full GeoTIFF download
            currentTest = "Downloading GeoTIFF metadata...";
            const downloadStart = performance.now();
            const fullResponse = await fetch(COG_URL);
            const blob = await fullResponse.blob();
            const downloadTime = performance.now() - downloadStart;
            addResult(
                "Full GeoTIFF download",
                downloadTime,
                `Size: ${blob.size} bytes`,
            );

            // 3. Test geotiff.js parsing
            currentTest = "Parsing GeoTIFF...";
            const { fromBlob } = await import("geotiff");
            const parseStart = performance.now();
            const tiff = await fromBlob(blob);
            const parseTime = performance.now() - parseStart;
            addResult("GeoTIFF parsing (fromBlob)", parseTime);

            // 4. Test image metadata extraction
            currentTest = "Extracting image metadata...";
            const metadataStart = performance.now();
            const image = await tiff.getImage();
            const metadataTime = performance.now() - metadataStart;
            addResult("Get first image", metadataTime);

            const width = image.getWidth();
            const height = image.getHeight();
            const tileWidth = image.getTileWidth();
            const tileHeight = image.getTileHeight();
            addResult(
                "Image dimensions",
                0,
                `${width}x${height}, tiles: ${tileWidth}x${tileHeight}`,
            );

            // 5. Test GeoKeys extraction
            currentTest = "Reading GeoKeys...";
            const geoKeysStart = performance.now();
            const geoKeys = image.getGeoKeys();
            const geoKeysTime = performance.now() - geoKeysStart;
            addResult(
                "GeoKeys extraction",
                geoKeysTime,
                `Keys: ${Object.keys(geoKeys).length}`,
            );

            // 6. Test tile data reading
            currentTest = "Reading tile data...";
            const tileReadStart = performance.now();
            const tileData = await image.readRasters({
                window: [0, 0, tileWidth, tileHeight],
            });
            const tileReadTime = performance.now() - tileReadStart;
            addResult(
                "First tile read",
                tileReadTime,
                `Bands: ${tileData.length}, Size: ${tileData[0].length} pixels`,
            );

            // 7. Test RGB reading
            currentTest = "Reading RGB data...";
            const rgbStart = performance.now();
            const rgbData = await image.readRGB({
                window: [0, 0, Math.min(512, width), Math.min(512, height)],
            });
            const rgbTime = performance.now() - rgbStart;
            addResult(
                "RGB read (512x512 subset)",
                rgbTime,
                `Data size: ${rgbData.length} bytes`,
            );

            // 8. Update deck to trigger rendering benchmarks
            currentTest = "Rendering with deck.gl...";
            if (deck) {
                const renderStart = performance.now();
                deck.setProps({
                    layers: [createBaseTileLayer(), createCOGLayer()],
                });

                // Wait for render
                await new Promise((resolve) => setTimeout(resolve, 100));
                const renderTime = performance.now() - renderStart;
                addResult("Deck.gl layer update + render", renderTime);
            }
        } catch (error) {
            addResult("ERROR", 0, String(error));
            console.error("Benchmark error:", error);
        } finally {
            isRunning = false;
            currentTest = "Benchmark complete!";
        }
    }

    function exportResults() {
        const csv = [
            "Operation,Duration (ms),Details,Timestamp",
            ...benchmarkResults.map(
                (r) =>
                    `"${r.operation}",${r.duration.toFixed(4)},"${r.details || ""}",${r.timestamp}`,
            ),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `benchmark-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function getSummary() {
        if (benchmarkResults.length === 0) return null;

        const total = benchmarkResults.reduce((sum, r) => sum + r.duration, 0);
        const geotiffOps = benchmarkResults.filter((r) =>
            r.operation.toLowerCase().includes("geotiff"),
        );
        const proj4Ops = benchmarkResults.filter((r) =>
            r.operation.toLowerCase().includes("proj"),
        );
        const renderOps = benchmarkResults.filter((r) =>
            r.operation.toLowerCase().includes("render"),
        );

        return {
            total,
            geotiffTime: geotiffOps.reduce((sum, r) => sum + r.duration, 0),
            proj4Time: proj4Ops.reduce((sum, r) => sum + r.duration, 0),
            renderTime: renderOps.reduce((sum, r) => sum + r.duration, 0),
        };
    }

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
            layers: [createBaseTileLayer()],
        });

        return () => {
            deck?.finalize();
        };
    });

    $: summary = getSummary();
</script>

<div class="container">
    <div class="deck" bind:this={deckContainer}></div>

    <div class="ui-overlay">
        <div class="panel">
            <h2>Performance Benchmark</h2>

            <div class="controls">
                <button onclick={runBenchmark} disabled={isRunning}>
                    {isRunning ? "Running..." : "Run Benchmark"}
                </button>
                {#if benchmarkResults.length > 0}
                    <button onclick={exportResults}>Export CSV</button>
                {/if}
            </div>

            {#if isRunning}
                <div class="status">
                    <strong>Status:</strong>
                    {currentTest}
                </div>
            {/if}

            {#if summary}
                <div class="summary">
                    <h3>Summary</h3>
                    <table>
                        <tr>
                            <td>Total Time:</td>
                            <td
                                ><strong>{summary.total.toFixed(2)}ms</strong
                                ></td
                            >
                        </tr>
                        <tr>
                            <td>GeoTIFF Ops:</td>
                            <td>{summary.geotiffTime.toFixed(2)}ms</td>
                        </tr>
                        <tr>
                            <td>Proj4 Ops:</td>
                            <td>{summary.proj4Time.toFixed(2)}ms</td>
                        </tr>
                        <tr>
                            <td>Render Ops:</td>
                            <td>{summary.renderTime.toFixed(2)}ms</td>
                        </tr>
                    </table>
                </div>
            {/if}

            <div class="results">
                <h3>Results ({benchmarkResults.length})</h3>
                <div class="results-table">
                    {#each benchmarkResults as result}
                        <div class="result-row">
                            <div class="result-op">{result.operation}</div>
                            <div class="result-time">
                                {result.duration.toFixed(2)}ms
                            </div>
                            {#if result.details}
                                <div class="result-details">
                                    {result.details}
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
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
        right: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1000;
    }

    .panel {
        position: absolute;
        top: 20px;
        right: 20px;
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        max-width: 500px;
        max-height: calc(100vh - 40px);
        overflow-y: auto;
        pointer-events: auto;
    }

    h2 {
        margin: 0 0 16px 0;
        font-size: 18px;
    }

    h3 {
        margin: 16px 0 8px 0;
        font-size: 14px;
        font-weight: 600;
    }

    .controls {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
    }

    button {
        padding: 8px 16px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    }

    button:hover:not(:disabled) {
        background: #0056b3;
    }

    button:disabled {
        background: #ccc;
        cursor: not-allowed;
    }

    .status {
        padding: 12px;
        background: #e7f3ff;
        border-radius: 4px;
        font-size: 14px;
        margin-bottom: 16px;
    }

    .summary {
        padding: 12px;
        background: #f8f9fa;
        border-radius: 4px;
        margin-bottom: 16px;
    }

    .summary table {
        width: 100%;
        font-size: 13px;
    }

    .summary td {
        padding: 4px 0;
    }

    .summary td:last-child {
        text-align: right;
    }

    .results {
        border-top: 1px solid #e0e0e0;
        padding-top: 12px;
    }

    .results-table {
        max-height: 400px;
        overflow-y: auto;
    }

    .result-row {
        padding: 8px;
        border-bottom: 1px solid #f0f0f0;
        font-size: 13px;
    }

    .result-row:hover {
        background: #f8f9fa;
    }

    .result-op {
        font-weight: 600;
        margin-bottom: 2px;
    }

    .result-time {
        color: #007bff;
        font-weight: 500;
    }

    .result-details {
        color: #666;
        font-size: 12px;
        margin-top: 4px;
    }
</style>
