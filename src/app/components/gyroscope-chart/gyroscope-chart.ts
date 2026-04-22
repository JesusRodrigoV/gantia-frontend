import {
  afterNextRender,
  Component,
  DOCUMENT,
  effect,
  ElementRef,
  HostListener,
  inject,
  viewChild,
  OnDestroy,
} from '@angular/core';
import uPlot from 'uplot';
import { SensorSocket } from '@core/services/sensor-socket';

@Component({
  selector: 'app-gyroscope-chart',
  imports: [],
  templateUrl: './gyroscope-chart.html',
  styleUrl: '../chart.styles.scss',
})
export class GyroscopeChart implements OnDestroy {
  protected readonly uplotContainer =
    viewChild.required<ElementRef<HTMLDivElement>>('chartContainer');

  private readonly sensorSocket = inject(SensorSocket);
  private readonly document = inject(DOCUMENT);

  private uplotInstance: uPlot | undefined;
  private readonly maxWindow = 1000;
  private plotData: [number[], number[], number[], number[]] = [[], [], [], []];

  constructor() {
    afterNextRender(() => {
      this.initializeChart();
    });

    effect(() => {
      const telemetry = this.sensorSocket.telemetry();
      if (telemetry) {
        const globalWindow = this.document.defaultView;
        if (globalWindow) {
          const timestamp = globalWindow.Date.now() / 1000;
          this.ingestSocketData(timestamp, telemetry.gyro_x, telemetry.gyro_y, telemetry.gyro_z);
        }
      }
    });
  }

@HostListener('window:resize')
  onResize(): void {
    if (this.uplotInstance) {
      const container = this.uplotContainer().nativeElement;
      this.uplotInstance.setSize({
        width: container.offsetWidth,
        height: container.offsetHeight
      });
    }
  }

  private initializeChart(): void {
    const container = this.uplotContainer().nativeElement;

    const opts: uPlot.Options = {
      width: container.offsetWidth,
      height: container.offsetHeight,
      title: 'Velocidad Angular',
      scales: {
        x: { time: true },
        y: { auto: true },
      },
      axes: [{ space: 80 }, { label: '°/s' }],
      series: [
        {
          value: (u, v) => {
            if (v === null) return '--';
            const d = new Date(v * 1000);
            return (
              d.toLocaleTimeString('es-BO', { hour12: false }) +
              '.' +
              d.getMilliseconds().toString().padStart(3, '0')
            );
          },
        },
        { label: 'X', stroke: '#ff0000', width: 2 },
        { label: 'Y', stroke: '#2bff00', width: 2 },
        { label: 'Z', stroke: '#0080ff', width: 2 },
      ],
    };

    this.uplotInstance = new uPlot(opts, this.plotData, container);
  }

  private ingestSocketData(timestamp: number, gx: number, gy: number, gz: number): void {
    this.plotData[0].push(timestamp);
    this.plotData[1].push(gx);
    this.plotData[2].push(gy);
    this.plotData[3].push(gz);

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
