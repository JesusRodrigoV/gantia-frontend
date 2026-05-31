import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { gsap } from 'gsap';
import { SensorSocket } from '@core/services/sensor-socket';

const MIN_CHANGE = 2;
const GLOW_MS = 300;
const ANIM_SEC = 0.2;

@Component({
  selector: 'app-flexion',
  imports: [],
  templateUrl: './flexion.html',
  styleUrl: './flexion.scss',
})
export class Flexion {
  protected readonly sensorSocket = inject(SensorSocket);
  private readonly destroyRef = inject(DestroyRef);
  protected glowingIndex = signal(false);
  protected glowingMiddle = signal(false);
  protected displayIndex = signal(0);
  protected displayMiddle = signal(0);
  private prevIndex = 0;
  private prevMiddle = 0;
  private lastIndexChange = 0;
  private lastMiddleChange = 0;
  private glowRaf: number | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cancelGlowRaf();
    });

    effect(() => {
      const t = this.sensorSocket.telemetry();
      if (!t) return;

      if (t.flex_index !== this.prevIndex) {
        const rawValue = t.flex_index;
        const diff = Math.abs(rawValue - this.prevIndex);
        this.prevIndex = rawValue;

        this.lastIndexChange = performance.now();
        this.glowingIndex.set(true);
        this.scheduleGlowCheck();

        if (diff >= MIN_CHANGE) {
          const from = this.displayIndex();
          const proxy = { val: from };
          gsap.killTweensOf(proxy);
          gsap.to(proxy, {
            val: rawValue,
            duration: ANIM_SEC,
            ease: 'power2.out',
            onUpdate: () => {
              this.displayIndex.set(Math.round(proxy.val));
            },
          });
        } else {
          this.displayIndex.set(rawValue);
        }
      }

      if (t.flex_middle !== this.prevMiddle) {
        const rawValue = t.flex_middle;
        const diff = Math.abs(rawValue - this.prevMiddle);
        this.prevMiddle = rawValue;

        this.lastMiddleChange = performance.now();
        this.glowingMiddle.set(true);
        this.scheduleGlowCheck();

        if (diff >= MIN_CHANGE) {
          const from = this.displayMiddle();
          const proxy = { val: from };
          gsap.killTweensOf(proxy);
          gsap.to(proxy, {
            val: rawValue,
            duration: ANIM_SEC,
            ease: 'power2.out',
            onUpdate: () => {
              this.displayMiddle.set(Math.round(proxy.val));
            },
          });
        } else {
          this.displayMiddle.set(rawValue);
        }
      }
    });
  }

  private scheduleGlowCheck(): void {
    if (this.glowRaf !== null) return;
    this.glowRaf = requestAnimationFrame(() => {
      this.glowRaf = null;
      const now = performance.now();
      if (now - this.lastIndexChange >= GLOW_MS) {
        this.glowingIndex.set(false);
      }
      if (now - this.lastMiddleChange >= GLOW_MS) {
        this.glowingMiddle.set(false);
      }
      if (this.glowingIndex() || this.glowingMiddle()) {
        this.scheduleGlowCheck();
      }
    });
  }

  private cancelGlowRaf(): void {
    if (this.glowRaf !== null) {
      cancelAnimationFrame(this.glowRaf);
      this.glowRaf = null;
    }
  }
}
