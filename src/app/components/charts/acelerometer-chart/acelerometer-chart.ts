import { Component, ChangeDetectionStrategy } from '@angular/core';
import { SensorChart, SensorChartConfig } from '@components/charts/sensor-chart';

const ACCEL_CONFIG: SensorChartConfig = {
  title: 'Acelerómetro',
  unitLabel: 'G',
  seriesColors: ['#dc3545', '#28a745', '#0f4d92'],
  seriesLabels: ['X', 'Y', 'Z'],
  extractValues: (t) => [t.accel_x, t.accel_y, t.accel_z],
};

@Component({
  selector: 'app-acelerometer-chart',
  imports: [SensorChart],
  templateUrl: './acelerometer-chart.html',
  styleUrl: './acelerometer-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcelerometerChart {
  config = ACCEL_CONFIG;
}
