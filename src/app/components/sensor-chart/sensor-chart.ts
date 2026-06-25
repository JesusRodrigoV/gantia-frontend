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
import { GloveTelemetry } from '@core/models/glove-telemetry.model';

export interface SensorChartConfig {
  title: string;
  unitLabel: string;
  seriesColors: [string, string, string];
  seriesLabels?: [string, string, string];
  extractValues: (telemetry: GloveTelemetry) => [number, number, number];
}

const SYNC_KEY = 'gantia-sensors';

@Component({
  selector: 'app-sensor-chart',
  imports: [NgClass, DecimalPipe],
  template: `
    <button
      class="pause-btn"
      [ngClass]="{ paused: paused() }"
      (click)="togglePause()"
      [title]="paused() ? 'Reanudar' : 'Pausar'"
    >
      <i [class]="paused() ? 'bx bx-play' : 'bx bx-pause'" aria-hidden="true"></i>
    </button>

    @if (!lastValues()) {
      <div class="empty-state">
        <i class="bx bx-line-chart" aria-hidden="true"></i>
        <span>Esperando datos...</span>
      </div>
    }

    @if (lastValues(); as v) {
      <div class="last-values">
        <span class="lv-item" [style.color]="config().seriesColors[0]">{{ seriesLabels()[0] }}: {{ v[0] | number:'1.1' }}</span>
        <span class="lv-item" [style.color]="config().seriesColors[1]">{{ seriesLabels()[1] }}: {{ v[1] | number:'1.1' }}</span>
        <span class="lv-item" [style.color]="config().seriesColors[2]">{{ seriesLabels()[2] }}: {{ v[2] | number:'1.1' }}</span>
      </div>
    }

    <div #chartContainer class="uplot-container"></div>
  `,
  styleUrl: '../chart.styles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:resize)': 'onResize()',
  },
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

  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
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

  private scheduleDisplayUpdate(values: [number, number, number]): void {
    const now = performance.now();
    if (now - this.lastDisplayUpdate >= 100) {
      this.lastValues.set(values);
      this.lastDisplayUpdate = now;
    }
  }

  protected togglePause(): void {
    this.paused.update((v) => !v);
  }

  onResize(): void {
    if (this.resizeTimer !== null) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      if (this.uplotInstance) {
        const container = this.uplotContainer().nativeElement;
        this.uplotInstance.setSize({
          width: container.offsetWidth,
          height: container.offsetHeight,
        });
      }
    }, 100);
  }

  private initializeChart(): void {
    const container = this.uplotContainer().nativeElement;
    const cfg = this.config();
    const labels = cfg.seriesLabels ?? ['X', 'Y', 'Z'];
    this.seriesLabels.set(labels);

    const opts: uPlot.Options = {
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
        x: { time: true },
        y: { auto: true },
      },
      axes: [
        {
          space: 80,
          stroke: 'var(--p-surface-400)',
          grid: { stroke: 'color-mix(in srgb, var(--p-surface-900) 6%, transparent)' },
        },
        {
          label: cfg.unitLabel,
          stroke: 'var(--p-surface-400)',
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

    this.uplotInstance = new uPlot(opts, this.plotData, container);
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
    if (this.resizeTimer !== null) {
      clearTimeout(this.resizeTimer);
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    if (this.uplotInstance) {
      this.uplotInstance.destroy();
    }
  }
}
