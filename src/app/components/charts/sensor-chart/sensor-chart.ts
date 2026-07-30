import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
  OnDestroy,
  signal,
} from '@angular/core';
import { DecimalPipe, NgClass } from '@angular/common';
import uPlot from 'uplot';
import { SensorSocket } from '@core/services/sensor-socket';
import { SensorChartConfig } from './sensor-chart.model';
import { buildChartOptions } from './sensor-chart-options';

export type { SensorChartConfig };

@Component({
  selector: 'app-sensor-chart',
  imports: [NgClass, DecimalPipe],
  templateUrl: './sensor-chart.html',
  styleUrl: '../chart.styles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SensorChart implements OnDestroy {
  config = input.required<SensorChartConfig>();

  protected readonly uplotContainer =
    viewChild.required<ElementRef<HTMLDivElement>>('chartContainer');

  private readonly sensorSocket = inject(SensorSocket);
  protected readonly seriesLabels = signal(['X', 'Y', 'Z']);
  protected lastValues = signal<[number, number, number] | null>(null);

  private uplotInstance: uPlot | undefined;
  private readonly maxWindow = 300;
  private plotData: [number[], number[], number[], number[]] = [[], [], [], []];
  private pendingData: [number[], number[], number[], number[]] = [[], [], [], []];
  private rafId: number | null = null;
  protected paused = signal(false);

  private resizeObserver: ResizeObserver | null = null;
  private lastDisplayUpdate = 0;

  constructor() {
    afterNextRender(() => {
      this.initializeChart();
    });

    effect(() => {
      const telemetry = this.sensorSocket.telemetry();
      if (telemetry && !this.paused()) {
        const timestamp = Date.now() / 1000;
        const values = this.config().extractValues(telemetry);
        this.scheduleDisplayUpdate(values);
        this.ingestSocketData(timestamp, values[0], values[1], values[2]);
      }
    });
  }

  private readonly DISPLAY_THROTTLE_MS = 100;

  private scheduleDisplayUpdate(values: [number, number, number]): void {
    const now = performance.now();
    if (now - this.lastDisplayUpdate >= this.DISPLAY_THROTTLE_MS) {
      this.lastValues.set(values);
      this.lastDisplayUpdate = now;
    }
  }

  protected togglePause(): void {
    this.paused.update((v) => !v);
  }

  private initializeChart(): void {
    const container = this.uplotContainer().nativeElement;
    const cfg = this.config();
    const labels = cfg.seriesLabels ?? ['X', 'Y', 'Z'];
    this.seriesLabels.set(labels);

    const opts = buildChartOptions(container, cfg);
    this.uplotInstance = new uPlot(opts, this.plotData, container);

    this.resizeObserver = new ResizeObserver(() => {
      if (!this.uplotInstance) return;
      this.uplotInstance.setSize({
        width: container.offsetWidth,
        height: container.offsetHeight,
      });
    });
    this.resizeObserver.observe(container);
  }

  private ingestSocketData(timestamp: number, x: number, y: number, z: number): void {
    this.pendingData[0].push(timestamp);
    this.pendingData[1].push(x);
    this.pendingData[2].push(y);
    this.pendingData[3].push(z);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => this.flushPending());
  }

  private flushPending(): void {
    this.rafId = null;

    const n = this.pendingData[0].length;
    if (n === 0) return;

    for (let i = 0; i <= 3; i++) {
      for (let j = 0; j < n; j++) {
        this.plotData[i].push(this.pendingData[i][j]);
      }
      this.pendingData[i].length = 0;
    }

    if (this.plotData[0].length > this.maxWindow) {
      const excess = this.plotData[0].length - this.maxWindow;
      for (let i = 0; i <= 3; i++) {
        this.plotData[i].splice(0, excess);
      }
    }

    if (this.uplotInstance) {
      this.uplotInstance.setData(this.plotData);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    if (this.uplotInstance) {
      this.uplotInstance.destroy();
    }
  }
}
