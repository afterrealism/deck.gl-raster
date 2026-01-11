<script lang="ts">
  let { tooltip }: { tooltip: string } = $props();

  let isHovered = $state(false);
</script>

<div class="container">
  <button
    type="button"
    class="help-button"
    onmouseenter={() => (isHovered = true)}
    onmouseleave={() => (isHovered = false)}
    aria-label="Show debug overlay help"
  >
    ?
  </button>
  {#if isHovered}
    <div class="tooltip">
      {tooltip.trim()}
    </div>
  {/if}
</div>

<style>
  .container {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .help-button {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1.5px solid #666;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: bold;
    color: #666;
    cursor: help;
    background: transparent;
    padding: 0;
  }

  .tooltip {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background-color: #333;
    color: white;
    padding: 12px;
    border-radius: 4px;
    font-size: 12px;
    white-space: pre-line;
    width: 300px;
    max-width: 600px;
    z-index: 1000;
    line-height: 1.5;
  }
</style>
