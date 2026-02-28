<template>
  <ClientOnly>
    <div class="demo-container">
      <div ref="mapContainer" class="demo-map-compact"></div>
      <div class="demo-hint">
        Click the <strong>draw</strong> button (pencil icon) in the toolbar, then click on the map to add vertices. Double-click to finish.
      </div>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const mapContainer = ref<HTMLDivElement | null>(null);

let drawInstance: any = null;
let mapInstance: any = null;

onMounted(async () => {
  if (!mapContainer.value) return;

  const maplibregl = await import('maplibre-gl');
  await import('maplibre-gl/dist/maplibre-gl.css');
  const { LibreDraw } = await import('libre-draw');

  const map = new maplibregl.Map({
    container: mapContainer.value,
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    center: [139.6917, 35.6895],
    zoom: 13,
  });

  mapInstance = map;

  const draw = new LibreDraw(map, {
    toolbar: {
      position: 'top-right',
      controls: {
        draw: true,
        select: true,
        delete: true,
        undo: true,
        redo: true,
      },
    },
  });

  drawInstance = draw;
});

onUnmounted(() => {
  if (drawInstance) drawInstance.destroy();
  if (mapInstance) mapInstance.remove();
});
</script>
