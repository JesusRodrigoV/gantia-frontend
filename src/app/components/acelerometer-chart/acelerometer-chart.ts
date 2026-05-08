import { Component } from '@angular/core';
import { SensorChart, SensorChartConfig } from '@components/sensor-chart';

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
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
})
export class AcelerometerChart {
  config = ACCEL_CONFIG;
}
