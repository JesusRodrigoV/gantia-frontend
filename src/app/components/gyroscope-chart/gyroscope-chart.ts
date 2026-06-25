import { Component, ChangeDetectionStrategy } from '@angular/core';
import { SensorChart, SensorChartConfig } from '@components/sensor-chart';

const GYRO_CONFIG: SensorChartConfig = {
  title: 'Giroscopio',
  unitLabel: '°/s',
  seriesColors: ['#ff0000', '#2bff00', '#0080ff'],
  seriesLabels: ['X', 'Y', 'Z'],
  extractValues: (t) => [t.gyro_x, t.gyro_y, t.gyro_z],
};

@Component({
  selector: 'app-gyroscope-chart',
  imports: [SensorChart],
  templateUrl: './gyroscope-chart.html',
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GyroscopeChart {
  config = GYRO_CONFIG;
}
