import { Component, inject } from '@angular/core';
import { AcelerometerChart } from '@components/acelerometer-chart/acelerometer-chart';
import { Flexion } from '@components/flexion';
import { GyroscopeChart } from '@components/gyroscope-chart';
import { SensorSocket } from '@core/services/sensor-socket';

@Component({
  selector: 'app-sensores',
  imports: [GyroscopeChart, AcelerometerChart, Flexion],
  templateUrl: './sensores.html',
  styleUrl: './sensores.scss',
})
export default class Sensores {
  protected sensorSocket = inject(SensorSocket);
}
