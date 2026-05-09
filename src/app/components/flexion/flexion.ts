import { Component, effect, inject, signal } from '@angular/core';
import { gsap } from 'gsap';
import { SensorSocket } from '@core/services/sensor-socket';

@Component({
  selector: 'app-flexion',
  imports: [],
  templateUrl: './flexion.html',
  styleUrl: './flexion.scss',
})
export class Flexion {
  protected readonly sensorSocket = inject(SensorSocket);
  protected glowingIndex = signal(false);
  protected glowingMiddle = signal(false);
  protected displayIndex = signal(0);
  protected displayMiddle = signal(0);
  private prevIndex = 0;
  private prevMiddle = 0;

  constructor() {
    effect(() => {
      const t = this.sensorSocket.telemetry();
      if (!t) return;

      if (t.flex_index !== this.prevIndex) {
        const from = this.displayIndex();
        this.prevIndex = t.flex_index;
        this.glowingIndex.set(true);
        setTimeout(() => this.glowingIndex.set(false), 300);
        const proxy = { val: from };
        gsap.to(proxy, {
          val: t.flex_index,
          duration: 0.2,
          ease: 'power2.out',
          onUpdate: () => {
            this.displayIndex.set(Math.round(proxy.val));
          },
        });
      }

      if (t.flex_middle !== this.prevMiddle) {
        const from = this.displayMiddle();
        this.prevMiddle = t.flex_middle;
        this.glowingMiddle.set(true);
        setTimeout(() => this.glowingMiddle.set(false), 300);
        const proxy = { val: from };
        gsap.to(proxy, {
          val: t.flex_middle,
          duration: 0.2,
          ease: 'power2.out',
          onUpdate: () => {
            this.displayMiddle.set(Math.round(proxy.val));
          },
        });
      }
    });
  }
}
