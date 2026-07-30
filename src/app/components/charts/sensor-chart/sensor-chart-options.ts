import uPlot from 'uplot';
import { SensorChartConfig } from './sensor-chart.model';

const SYNC_KEY = 'gantia-sensors';
const WINDOW_SECS = 10;

export function buildChartOptions(
  container: HTMLElement,
  cfg: SensorChartConfig,
): uPlot.Options {
  const labels = cfg.seriesLabels ?? ['X', 'Y', 'Z'];

  return {
    width: container.offsetWidth,
    height: container.offsetHeight,
    title: cfg.title,
    cursor: {
      show: true,
      x: true,
      y: true,
      drag: { x: false, y: false },
      sync: { key: SYNC_KEY },
    },
    scales: {
      x: {
        time: true,
        range: (u: uPlot) => {
          const data = u.data[0];
          if (data.length < 2) return [0, WINDOW_SECS];
          const max = data[data.length - 1];
          const min = max - WINDOW_SECS;
          return [min, max];
        },
      },
      y: { range: [cfg.minY, cfg.maxY] },
    },
    axes: [
      {
        space: 80,
        stroke: 'var(--p-surface-600)',
        grid: { stroke: 'color-mix(in srgb, var(--p-surface-900) 6%, transparent)' },
      },
      {
        label: cfg.unitLabel,
        stroke: 'var(--p-surface-600)',
        grid: { stroke: 'color-mix(in srgb, var(--p-surface-900) 6%, transparent)' },
      },
    ],
    series: [
      {
        value: (_, v) => {
          if (v === null) return '--';
          const d = new Date(v * 1000);
          return (
            d.toLocaleTimeString('es-BO', { hour12: false }) +
            '.' +
            d.getMilliseconds().toString().padStart(3, '0')
          );
        },
      },
      {
        label: labels[0],
        stroke: cfg.seriesColors[0],
        width: 2,
        fill: cfg.seriesColors[0] + '15',
        points: { show: false },
      },
      {
        label: labels[1],
        stroke: cfg.seriesColors[1],
        width: 2,
        fill: cfg.seriesColors[1] + '15',
        points: { show: false },
      },
      {
        label: labels[2],
        stroke: cfg.seriesColors[2],
        width: 2,
        fill: cfg.seriesColors[2] + '15',
        points: { show: false },
      },
    ],
  };
}
