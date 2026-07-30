import { Component, ChangeDetectionStrategy } from '@angular/core';
import { SensorChart, SensorChartConfig } from '@components/charts/sensor-chart';

const GYRO_CONFIG: SensorChartConfig = {
  title: 'Giroscopio',
  unitLabel: '°/s',
  seriesColors: ['#ff0000', '#2bff00', '#0080ff'],
  seriesLabels: ['X', 'Y', 'Z'],
  minY: -100,
  maxY: 100,
  extractValues: (t) => [t.gyro_x, t.gyro_y, t.gyro_z],
};

@Component({
  selector: 'app-gyroscope-chart',
  imports: [SensorChart],
  templateUrl: './gyroscope-chart.html',
  styleUrl: './gyroscope-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GyroscopeChart {
  config = GYRO_CONFIG;
}
