import uPlot, { AlignedData } from 'uplot';
import { HistoryReading } from '@core/models/reading-history.model';

export class HistoryChart {
  private plot: uPlot | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;

  init(container: HTMLDivElement): void {
    const opts: uPlot.Options = {
      width: container.clientWidth,
      height: 280,
      cursor: { points: { show: false } },
      scales: { x: { time: false } },
      axes: [
        { label: 'Índice', labelSize: 14, stroke: '#6366f1', font: '11px inherit' },
        { label: 'Valor', labelSize: 14, stroke: '#94a3b8', font: '11px inherit' },
      ],
      series: [
        {},
        { label: 'Serie 1', stroke: '#6366f1', width: 1.5, points: { show: false } },
        { label: 'Serie 2', stroke: '#8b5cf6', width: 1.5, points: { show: false } },
        { label: 'Serie 3', stroke: '#a78bfa', width: 1.5, points: { show: false } },
      ],
      legend: { show: true, live: false },
    };

    const data: AlignedData = [[], [], [], []];
    this.plot = new uPlot(opts, data, container);
  }

  update(data: HistoryReading[], chartType: 'accel' | 'gyro' | 'flex'): void {
    if (!this.plot || data.length === 0) return;

    const timestamps = new Float64Array(data.map((_, i) => i));

    let series1: Float64Array, series2: Float64Array, series3: Float64Array;
    let label1: string, label2: string, label3: string;
    let color1: string, color2: string, color3: string;

    if (chartType === 'accel') {
      series1 = new Float64Array(data.map(r => r.accel_x));
      series2 = new Float64Array(data.map(r => r.accel_y));
      series3 = new Float64Array(data.map(r => r.accel_z));
      label1 = 'Accel X'; label2 = 'Accel Y'; label3 = 'Accel Z';
      color1 = '#6366f1'; color2 = '#8b5cf6'; color3 = '#a78bfa';
    } else if (chartType === 'gyro') {
      series1 = new Float64Array(data.map(r => r.gyro_x));
      series2 = new Float64Array(data.map(r => r.gyro_y));
      series3 = new Float64Array(data.map(r => r.gyro_z));
      label1 = 'Gyro X'; label2 = 'Gyro Y'; label3 = 'Gyro Z';
      color1 = '#f59e0b'; color2 = '#f97316'; color3 = '#ef4444';
    } else {
      series1 = new Float64Array(data.map(r => r.flex_index));
      series2 = new Float64Array(data.map(r => r.flex_middle));
      series3 = new Float64Array(data.map(() => 0));
      label1 = 'Flex Índice'; label2 = 'Flex Medio'; label3 = '';
      color1 = '#10b981'; color2 = '#06b6d4'; color3 = 'transparent';
    }

    const chartData: AlignedData = [timestamps, series1, series2, series3];
    this.plot.setData(chartData);

    const s = this.plot.series;
    if (s[1]) { s[1].label = label1; s[1].stroke = color1; }
    if (s[2]) { s[2].label = label2; s[2].stroke = color2; }
    if (s[3]) { s[3].label = label3; s[3].stroke = color3; }

    this.plot.redraw();
  }

  onResize(container: HTMLDivElement | null): void {
    if (this.resizeTimer !== null) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      if (this.plot && container) {
        this.plot.setSize({ width: container.clientWidth, height: 280 });
      }
    }, 100);
  }

  destroy(): void {
    if (this.resizeTimer !== null) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
    if (this.plot) {
      this.plot.destroy();
      this.plot = null;
    }
  }
}
