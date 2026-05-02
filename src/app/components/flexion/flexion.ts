import { Component, inject } from '@angular/core';
import { SensorSocket } from '@core/services/sensor-socket';

@Component({
  selector: 'app-flexion',
  imports: [],
  templateUrl: './flexion.html',
  styleUrl: './flexion.scss',
})
export class Flexion {
  protected readonly sensorSocket = inject(SensorSocket);
}
