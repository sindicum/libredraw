<template>
  <ClientOnly>
    <div class="demo-container">
      <div
        ref="mapContainer"
        :class="fullsize ? 'demo-map-fullsize' : 'demo-map'"
      ></div>
      <div class="demo-log" ref="logContainer">
        <p v-if="logs.length === 0" class="demo-log-empty">
          Draw a polygon to see events here...
        </p>
        <p
          v-for="(log, index) in logs"
          :key="index"
          class="demo-log-entry"
        >
          <span class="log-type">[{{ log.type }}]</span> {{ log.message }}
        </p>
      </div>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, type PropType } from 'vue';

defineProps({
  fullsize: {
    type: Boolean as PropType<boolean>,
    default: false,
  },
});

interface LogEntry {
  type: string;
  message: string;
}

const mapContainer = ref<HTMLDivElement | null>(null);
const logContainer = ref<HTMLDivElement | null>(null);
const logs = ref<LogEntry[]>([]);

let drawInstance: unknown = null;
let mapInstance: unknown = null;

function addLog(type: string, message: string) {
  logs.value.push({ type, message });
  if (logs.value.length > 50) {
    logs.value.shift();
  }
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
}

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
      layers: [
        {
          id: 'osm',
          type: 'raster',
          source: 'osm',
        },
      ],
    },
    center: [139.6917, 35.6895],
    zoom: 12,
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

  draw.on('create', (e) => {
    addLog(
      'create',
      `Polygon created (${e.feature.geometry.coordinates[0].length - 1} vertices)`,
    );
  });

  draw.on('update', (e) => {
    addLog(
      'update',
      `Polygon updated (${e.feature.geometry.coordinates[0].length - 1} vertices)`,
    );
  });

  draw.on('delete', (e) => {
    addLog('delete', `Polygon deleted: ${e.feature.id.slice(0, 8)}...`);
  });

  draw.on('selectionchange', (e) => {
    if (e.selectedIds.length > 0) {
      addLog(
        'selectionchange',
        `Selected: ${e.selectedIds.map((id) => id.slice(0, 8) + '...').join(', ')}`,
      );
    } else {
      addLog('selectionchange', 'Selection cleared');
    }
  });

  draw.on('modechange', (e) => {
    addLog('modechange', `${e.previousMode} → ${e.mode}`);
  });
});

onUnmounted(() => {
  if (drawInstance && typeof (drawInstance as any).destroy === 'function') {
    (drawInstance as any).destroy();
  }
  if (mapInstance && typeof (mapInstance as any).remove === 'function') {
    (mapInstance as any).remove();
  }
});
</script>
