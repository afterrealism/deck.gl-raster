<script lang="ts">
  import HelpIcon from "./HelpIcon.svelte";
  import Legend from "./Legend.svelte";

  let { debug = $bindable(), debugOpacity = $bindable() }: { debug: boolean; debugOpacity: number } = $props();

  const helpIconTooltip = `Red squares depict the underlying COG tile structure.

Triangles depict the GPU-based reprojection. Instead of per-pixel reprojection, we generate an adaptive triangular mesh. Each triangle locally approximates the non-linear reprojection function, ensuring minimal distortion.`;
</script>

<div class="panel">
  <h3 class="title">NLCD Land Cover Classification</h3>

  <p class="description">
    A <b>1.3GB</b>
    <a href="https://cogeo.org/" target="_blank" rel="noopener noreferrer">
      Cloud-Optimized GeoTIFF
    </a>
    rendered in the browser with <b>no server</b> using
    <a
      href="https://github.com/developmentseed/deck.gl-raster"
      target="_blank"
      rel="noopener noreferrer"
      class="mono"
    >
      @afterrealism/deck.gl-raster </a>.
  </p>

  <Legend />

  <div class="debug-section">
    <div class="debug-row">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={debug} />
        <span>Show Debug Overlay</span>
      </label>
      <HelpIcon tooltip={helpIconTooltip} />
    </div>

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

<style>
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
    padding-bottom: 8px;
    border-bottom: 1px solid #eee;
  }

  .description {
    margin: 8px 0;
    font-size: 14px;
    color: #666;
  }

  .description a {
    color: #0066cc;
    text-decoration: none;
  }

  .description a:hover {
    text-decoration: underline;
  }

  .mono {
    font-family: monospace;
  }

  .debug-section {
    padding: 12px 0;
    border-top: 1px solid #eee;
    margin-top: 12px;
  }

  .debug-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    cursor: pointer;
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
