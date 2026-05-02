import { Component, effect, inject, signal } from '@angular/core';
import { SensorSocket } from '@core/services/sensor-socket';

@Component({
  selector: 'app-flexion',
  imports: [],
  templateUrl: './flexion.html',
  styleUrl: './flexion.scss',
})
export class Flexion {
  private readonly sensorSocket = inject(SensorSocket);

  isActive = signal<boolean>(false);
  flexIndex = signal<number>(0);
  flexMiddle = signal<number>(0);

  constructor() {
    effect(() => {
      const telemetry = this.sensorSocket.telemetry();
      if (telemetry) {
        this.isActive.set(telemetry.is_active);
        this.flexIndex.set(telemetry.flex_index);
        this.flexMiddle.set(telemetry.flex_middle);
      }
    });
  }
}
