<script lang="ts">
  interface LegendItem {
    value: number;
    color: [number, number, number];
    label: string;
    description: string;
  }

  interface LegendCategory {
    heading: string;
    items: LegendItem[];
  }

  // From https://www.mrlc.gov/data/legends/national-land-cover-database-class-legend-and-description
  // RGB values taken directly from GeoTIFF ColorMap tag
  const LEGEND_DATA: LegendCategory[] = [
    {
      heading: "Water",
      items: [
        {
          value: 11,
          color: [70, 107, 159],
          label: "Open Water",
          description:
            "Areas of open water, generally with less than 25% cover of vegetation or soil.",
        },
        {
          value: 12,
          color: [209, 222, 248],
          label: "Perennial Ice/Snow",
          description:
            "Areas characterized by a perennial cover of ice and/or snow, generally greater than 25% of total cover.",
        },
      ],
    },
    {
      heading: "Developed",
      items: [
        {
          value: 21,
          color: [222, 197, 197],
          label: "Developed, Open Space",
          description:
            "Areas with a mixture of some constructed materials, but mostly vegetation in the form of lawn grasses. Impervious surfaces account for less than 20% of total cover.",
        },
        {
          value: 22,
          color: [217, 146, 130],
          label: "Developed, Low Intensity",
          description:
            "Areas with a mixture of constructed materials and vegetation. Impervious surfaces account for 20% to 49% percent of total cover.",
        },
        {
          value: 23,
          color: [235, 0, 0],
          label: "Developed, Medium Intensity",
          description:
            "Areas with a mixture of constructed materials and vegetation. Impervious surfaces account for 50% to 79% of the total cover.",
        },
        {
          value: 24,
          color: [171, 0, 0],
          label: "Developed High Intensity",
          description:
            "Highly developed areas where people reside or work in high numbers. Impervious surfaces account for 80% to 100% of the total cover.",
        },
      ],
    },
    {
      heading: "Barren",
      items: [
        {
          value: 31,
          color: [179, 172, 159],
          label: "Barren Land",
          description:
            "Areas of bedrock, desert pavement, scarps, talus, slides, volcanic material, glacial debris, sand dunes, strip mines, gravel pits and other accumulations of earthen material.",
        },
      ],
    },
    {
      heading: "Forest",
      items: [
        {
          value: 41,
          color: [104, 171, 95],
          label: "Deciduous Forest",
          description:
            "Areas dominated by trees generally greater than 5 meters tall, and greater than 20% of total vegetation cover. More than 75% of the tree species shed foliage simultaneously.",
        },
        {
          value: 42,
          color: [28, 95, 44],
          label: "Evergreen Forest",
          description:
            "Areas dominated by trees generally greater than 5 meters tall, and greater than 20% of total vegetation cover. More than 75% of the tree species maintain their leaves all year.",
        },
        {
          value: 43,
          color: [181, 197, 143],
          label: "Mixed Forest",
          description:
            "Areas dominated by trees generally greater than 5 meters tall, and greater than 20% of total vegetation cover. Neither deciduous nor evergreen species are greater than 75% of total tree cover.",
        },
      ],
    },
    {
      heading: "Shrubland",
      items: [
        {
          value: 52,
          color: [204, 184, 121],
          label: "Shrub/Scrub",
          description:
            "Areas dominated by shrubs; less than 5 meters tall with shrub canopy typically greater than 20% of total vegetation.",
        },
      ],
    },
    {
      heading: "Herbaceous",
      items: [
        {
          value: 71,
          color: [223, 223, 194],
          label: "Grassland/Herbaceous",
          description:
            "Areas dominated by gramanoid or herbaceous vegetation, generally greater than 80% of total vegetation.",
        },
      ],
    },
    {
      heading: "Planted/Cultivated",
      items: [
        {
          value: 81,
          color: [220, 217, 57],
          label: "Pasture/Hay",
          description:
            "Areas of grasses, legumes, or grass-legume mixtures planted for livestock grazing or the production of seed or hay crops.",
        },
        {
          value: 82,
          color: [171, 108, 40],
          label: "Cultivated Crops",
          description:
            "Areas used for the production of annual crops, such as corn, soybeans, vegetables, tobacco, and cotton, and also perennial woody crops such as orchards and vineyards.",
        },
      ],
    },
    {
      heading: "Wetlands",
      items: [
        {
          value: 90,
          color: [184, 217, 235],
          label: "Woody Wetlands",
          description:
            "Areas where forest or shrubland vegetation accounts for greater than 20% of vegetative cover and the soil or substrate is periodically saturated with or covered with water.",
        },
        {
          value: 95,
          color: [108, 159, 184],
          label: "Emergent Herbaceous Wetlands",
          description:
            "Areas where perennial herbaceous vegetation accounts for greater than 80% of vegetative cover and the soil or substrate is periodically saturated with or covered with water.",
        },
      ],
    },
  ];

  let isExpanded = $state(false);
</script>

<div class="legend">
  <button
    type="button"
    class="toggle-button"
    onclick={() => (isExpanded = !isExpanded)}
  >
    <span>Legend</span>
    <span class="arrow" class:expanded={isExpanded}>▼</span>
  </button>

  {#if isExpanded}
    <div class="legend-content">
      {#each LEGEND_DATA as category}
        <div class="category">
          <div class="category-heading">{category.heading}</div>
          {#each category.items as item}
            <div class="legend-item">
              <div
                class="color-swatch"
                style="background-color: rgb({item.color[0]}, {item.color[1]}, {item.color[2]})"
              ></div>
              <div class="item-content">
                <div class="item-label">{item.label}</div>
                <div class="item-description">{item.description}</div>
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
    <div class="reference">
      <a
        href="https://www.mrlc.gov/data/legends/national-land-cover-database-class-legend-and-description"
        target="_blank"
        rel="noopener noreferrer"
      >
        Classification Reference
      </a>
    </div>
  {/if}
</div>

<style>
  .legend {
    border-top: 1px solid #eee;
    margin-top: 12px;
  }

  .toggle-button {
    width: 100%;
    padding: 12px 0;
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 14px;
    font-weight: 500;
  }

  .arrow {
    transition: transform 0.2s;
  }

  .arrow.expanded {
    transform: rotate(180deg);
  }

  .legend-content {
    max-height: 400px;
    overflow-y: auto;
    padding-bottom: 8px;
  }

  .category {
    margin-bottom: 12px;
  }

  .category-heading {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 6px;
    color: #333;
  }

  .legend-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 12px;
  }

  .color-swatch {
    width: 16px;
    height: 16px;
    border-radius: 2px;
    flex-shrink: 0;
    margin-top: 2px;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }

  .item-content {
    flex: 1;
  }

  .item-label {
    font-weight: 500;
    margin-bottom: 2px;
  }

  .item-description {
    color: #666;
    line-height: 1.3;
  }

  .reference {
    margin-top: 12px;
    font-size: 12px;
  }

  .reference a {
    color: #0066cc;
    text-decoration: none;
  }

  .reference a:hover {
    text-decoration: underline;
  }
</style>
