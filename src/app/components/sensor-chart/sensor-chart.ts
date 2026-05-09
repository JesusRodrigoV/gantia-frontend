import {
  afterNextRender,
  Component,
  DOCUMENT,
  effect,
  ElementRef,
  HostListener,
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
      <i [class]="paused() ? 'bx bx-play' : 'bx bx-pause'"></i>
    </button>

    @if (lastValues(); as v) {
      <div class="last-values">
        <span class="lv-item" [style.color]="config().seriesColors[0]">{{ seriesLabels()[0] }}: {{ v[0] | number:'1.1f' }}</span>
        <span class="lv-item" [style.color]="config().seriesColors[1]">{{ seriesLabels()[1] }}: {{ v[1] | number:'1.1f' }}</span>
        <span class="lv-item" [style.color]="config().seriesColors[2]">{{ seriesLabels()[2] }}: {{ v[2] | number:'1.1f' }}</span>
      </div>
    }

    <div #chartContainer class="uplot-container"></div>
  `,
  styleUrl: '../chart.styles.scss',
})
export class SensorChart implements OnDestroy {
  config = input.required<SensorChartConfig>();

  protected readonly uplotContainer =
    viewChild.required<ElementRef<HTMLDivElement>>('chartContainer');

  private readonly sensorSocket = inject(SensorSocket);
  private readonly document = inject(DOCUMENT);
  protected readonly seriesLabels = signal(['X', 'Y', 'Z']);
  protected lastValues = signal<[number, number, number] | null>(null);

  private uplotInstance: uPlot | undefined;
  private readonly maxWindow = 1000;
  private plotData: [number[], number[], number[], number[]] = [[], [], [], []];
  protected paused = signal(false);

  constructor() {
    afterNextRender(() => {
      this.initializeChart();
    });

    effect(() => {
      const telemetry = this.sensorSocket.telemetry();
      if (telemetry && !this.paused()) {
        const win = this.document.defaultView;
        if (win) {
          const timestamp = win.Date.now() / 1000;
          const values = this.config().extractValues(telemetry);
          this.lastValues.set(values);
          this.ingestSocketData(timestamp, values[0], values[1], values[2]);
        }
      }
    });
  }

  protected togglePause(): void {
    this.paused.update((v) => !v);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.uplotInstance) {
      const container = this.uplotContainer().nativeElement;
      this.uplotInstance.setSize({
        width: container.offsetWidth,
        height: container.offsetHeight,
      });
    }
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
    this.plotData[0].push(timestamp);
    this.plotData[1].push(x);
    this.plotData[2].push(y);
    this.plotData[3].push(z);

    if (this.plotData[0].length > this.maxWindow) {
      this.plotData[0].shift();
      this.plotData[1].shift();
      this.plotData[2].shift();
      this.plotData[3].shift();
    }

    if (this.uplotInstance) {
      this.uplotInstance.setData(this.plotData);
    }
  }

  ngOnDestroy(): void {
    if (this.uplotInstance) {
      this.uplotInstance.destroy();
    }
  }
}
