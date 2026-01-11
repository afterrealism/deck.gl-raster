<script lang="ts">
    import { onMount } from "svelte";
    import { Deck } from "@deck.gl/core";
    import { TileLayer } from "@deck.gl/geo-layers";
    import { BitmapLayer } from "@deck.gl/layers";
    import { COGLayer } from "@afterrealism/deck.gl-raster";
    import { profiler } from "$lib/profiler.js";

    let deckContainer: HTMLDivElement;
    let deck: Deck | null = null;

    let isRunning = $state(false);
    let benchmarkComplete = $state(false);
    let summary = $state<any>(null);

    // Test different COG URLs to compare
    const TEST_COGS = [
        {
            name: "Sentinel-2 RGB (Compressed)",
            url: "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/18/T/WL/2026/1/S2B_18TWL_20260101_0_L2A/TCI.tif",
        },
        {
            name: "Landsat-8 (Different projection)",
            url: "https://landsat-pds.s3.amazonaws.com/c1/L8/153/075/LC08_L1TP_153075_20170822_20170912_01_T1/LC08_L1TP_153075_20170822_20170912_01_T1_B4.TIF",
        },
    ];

    let selectedCOG = $state(TEST_COGS[0]);

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
            geotiff: selectedCOG.url,
            onGeoTIFFLoad: (tiff, options) => {
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

    async function runBenchmark() {
        isRunning = true;
        benchmarkComplete = false;
        profiler.clear();
        profiler.setEnabled(true);

        try {
            await profiler.measure("Full Benchmark", async () => {
                // Test 1: Network performance
                await profiler.measure("Network Tests", async () => {
                    await profiler.measure(
                        "HTTP HEAD request",
                        async () => {
                            const response = await fetch(selectedCOG.url, {
                                method: "HEAD",
                            });
                            return response;
                        },
                        { url: selectedCOG.url },
                    );
                });

                // Test 2: GeoTIFF parsing
                const { fromUrl } = await import("geotiff");
                const tiff = await profiler.measure(
                    "GeoTIFF fromUrl",
                    async () => fromUrl(selectedCOG.url),
                );

                const image = await profiler.measure(
                    "Get first image",
                    async () => tiff.getImage(),
                );

                const width = image.getWidth();
                const height = image.getHeight();
                const tileWidth = image.getTileWidth();
                const tileHeight = image.getTileHeight();

                // Test 3: Metadata extraction
                await profiler.measure(
                    "Extract GeoKeys",
                    async () => {
                        const geoKeys = image.getGeoKeys();
                        return geoKeys;
                    },
                    { width, height, tileWidth, tileHeight },
                );

                // Test 4: Tile data reading (multiple tiles)
                await profiler.measure("Read 5 tiles", async () => {
                    for (let i = 0; i < 5; i++) {
                        await profiler.measure(
                            `Read tile ${i}`,
                            async () => {
                                return await image.readRasters({
                                    window: [
                                        i * tileWidth,
                                        0,
                                        (i + 1) * tileWidth,
                                        tileHeight,
                                    ],
                                });
                            },
                            { tileIndex: i },
                        );
                    }
                });

                // Test 5: RGB reading
                await profiler.measure(
                    "RGB read (1024x1024)",
                    async () => {
                        return await image.readRGB({
                            window: [
                                0,
                                0,
                                Math.min(1024, width),
                                Math.min(1024, height),
                            ],
                        });
                    },
                    {
                        width: Math.min(1024, width),
                        height: Math.min(1024, height),
                    },
                );

                // Test 6: Render with deck.gl
                if (deck) {
                    await profiler.measure(
                        "Create and render COGLayer",
                        async () => {
                            deck.setProps({
                                layers: [
                                    createBaseTileLayer(),
                                    createCOGLayer(),
                                ],
                            });
                            // Wait for initial render
                            await new Promise((resolve) =>
                                setTimeout(resolve, 500),
                            );
                        },
                    );
                }
            });

            summary = profiler.getSummary();
            profiler.printSummary();
            benchmarkComplete = true;
        } catch (error) {
            console.error("Benchmark error:", error);
        } finally {
            isRunning = false;
        }
    }

    function downloadResults() {
        const data = profiler.exportToJSON();
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `benchmark-${selectedCOG.name}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function downloadCSV() {
        if (!summary) return;

        const rows = [
            ["Operation", "Total Time (ms)", "Count", "Avg Time (ms)"],
            ...Object.entries(
                summary.operationTimes as Record<string, number>,
            ).map(([name, time]) => [
                name,
                time.toFixed(4),
                summary.operationCounts[name],
                (time / summary.operationCounts[name]).toFixed(4),
            ]),
        ];

        const csv = rows.map((row) => row.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `benchmark-summary-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
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
</script>

<div class="container">
    <div class="deck" bind:this={deckContainer}></div>

    <div class="ui-overlay">
        <div class="panel">
            <h2>Detailed Performance Benchmark</h2>

            <div class="cog-selector">
                <label>
                    Test COG:
                    <select bind:value={selectedCOG}>
                        {#each TEST_COGS as cog}
                            <option value={cog}>{cog.name}</option>
                        {/each}
                    </select>
                </label>
            </div>

            <div class="controls">
                <button onclick={runBenchmark} disabled={isRunning}>
                    {isRunning ? "Running..." : "Run Benchmark"}
                </button>
                {#if benchmarkComplete}
                    <button onclick={downloadResults}>Download JSON</button>
                    <button onclick={downloadCSV}>Download CSV</button>
                {/if}
            </div>

            {#if summary}
                <div class="summary">
                    <h3>Summary</h3>
                    <div class="total-time">
                        Total Time: <strong
                            >{summary.totalTime.toFixed(2)}ms</strong
                        >
                    </div>

                    <h4>Top Time Consumers</h4>
                    <div class="top-operations">
                        {#each Object.entries(summary.operationTimes as Record<string, number>)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 10) as [name, time]}
                            {@const count = summary.operationCounts[name]}
                            {@const avg = time / count}
                            <div class="operation-row">
                                <div class="op-name">{name}</div>
                                <div class="op-stats">
                                    <span class="total"
                                        >{time.toFixed(2)}ms</span
                                    >
                                    <span class="count">{count}x</span>
                                    <span class="avg"
                                        >avg: {avg.toFixed(2)}ms</span
                                    >
                                </div>
                                <div class="op-bar">
                                    <div
                                        class="bar-fill"
                                        style="width: {(time /
                                            summary.totalTime) *
                                            100}%"
                                    ></div>
                                </div>
                            </div>
                        {/each}
                    </div>

                    <h4>Slowest Individual Operations</h4>
                    <div class="slowest-ops">
                        {#each summary.slowestOperations.slice(0, 10) as op, i}
                            <div class="slow-op">
                                <span class="rank">{i + 1}.</span>
                                <span class="op-name">{op.name}</span>
                                <span class="op-time"
                                    >{op.duration.toFixed(2)}ms</span
                                >
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
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
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
        max-width: 600px;
        max-height: calc(100vh - 40px);
        overflow-y: auto;
        pointer-events: auto;
    }

    h2 {
        margin: 0 0 16px 0;
        font-size: 20px;
        font-weight: 600;
    }

    h3 {
        margin: 16px 0 12px 0;
        font-size: 16px;
        font-weight: 600;
    }

    h4 {
        margin: 16px 0 8px 0;
        font-size: 14px;
        font-weight: 600;
        color: #666;
    }

    .cog-selector {
        margin-bottom: 16px;
    }

    .cog-selector label {
        display: block;
        font-size: 14px;
        margin-bottom: 8px;
    }

    .cog-selector select {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
    }

    .controls {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
    }

    button {
        padding: 10px 16px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
    }

    button:hover:not(:disabled) {
        background: #0056b3;
    }

    button:disabled {
        background: #ccc;
        cursor: not-allowed;
    }

    .summary {
        border-top: 2px solid #e0e0e0;
        padding-top: 16px;
    }

    .total-time {
        padding: 12px;
        background: #f0f7ff;
        border-radius: 4px;
        font-size: 16px;
        margin-bottom: 16px;
    }

    .top-operations {
        margin-bottom: 20px;
    }

    .operation-row {
        margin-bottom: 12px;
        padding: 8px;
        background: #f8f9fa;
        border-radius: 4px;
    }

    .op-name {
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 4px;
    }

    .op-stats {
        display: flex;
        gap: 12px;
        font-size: 12px;
        color: #666;
        margin-bottom: 6px;
    }

    .op-stats .total {
        font-weight: 600;
        color: #007bff;
    }

    .op-bar {
        height: 4px;
        background: #e0e0e0;
        border-radius: 2px;
        overflow: hidden;
    }

    .bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #007bff, #0056b3);
        transition: width 0.3s ease;
    }

    .slowest-ops {
        font-size: 13px;
    }

    .slow-op {
        display: flex;
        gap: 8px;
        padding: 6px 8px;
        border-bottom: 1px solid #f0f0f0;
    }

    .slow-op:hover {
        background: #f8f9fa;
    }

    .slow-op .rank {
        color: #999;
        font-weight: 500;
        min-width: 20px;
    }

    .slow-op .op-name {
        flex: 1;
    }

    .slow-op .op-time {
        font-weight: 600;
        color: #dc3545;
    }
</style>
