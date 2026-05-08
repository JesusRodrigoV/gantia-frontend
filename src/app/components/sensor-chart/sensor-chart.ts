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
import { NgClass } from '@angular/common';
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

@Component({
  selector: 'app-sensor-chart',
  imports: [NgClass],
  template: `
    <button
      class="pause-btn"
      [ngClass]="{ paused: paused() }"
      (click)="togglePause()"
      [title]="paused() ? 'Reanudar' : 'Pausar'"
    >
      <i [class]="paused() ? 'bx bx-play' : 'bx bx-pause'"></i>
    </button>
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
          const [x, y, z] = this.config().extractValues(telemetry);
          this.ingestSocketData(timestamp, x, y, z);
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
    const seriesLabels = cfg.seriesLabels ?? ['X', 'Y', 'Z'];

    const opts: uPlot.Options = {
      width: container.offsetWidth,
      height: container.offsetHeight,
      title: cfg.title,
      scales: {
        x: { time: true },
        y: { auto: true },
      },
      axes: [{ space: 80 }, { label: cfg.unitLabel }],
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
        { label: seriesLabels[0], stroke: cfg.seriesColors[0], width: 2 },
        { label: seriesLabels[1], stroke: cfg.seriesColors[1], width: 2 },
        { label: seriesLabels[2], stroke: cfg.seriesColors[2], width: 2 },
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
