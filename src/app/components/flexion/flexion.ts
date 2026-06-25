import { Component, ChangeDetectionStrategy, DestroyRef, effect, inject, signal } from '@angular/core';
import { SensorSocket } from '@core/services/sensor-socket';
import { FLEX_STATE_LABELS } from '@core/models/glove-telemetry.model';

const GLOW_MS = 300;

@Component({
  selector: 'app-flexion',
  imports: [],
  templateUrl: './flexion.html',
  styleUrl: './flexion.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  protected readonly FLEX_STATE_LABELS = FLEX_STATE_LABELS;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cancelGlowRaf();
    });

    effect(() => {
      const t = this.sensorSocket.telemetry();
      if (!t) return;

      if (t.index_state !== this.prevIndex) {
        this.prevIndex = t.index_state;
        this.lastIndexChange = performance.now();
        this.glowingIndex.set(true);
        this.displayIndex.set(t.index_state);
        this.scheduleGlowCheck();
      }

      if (t.middle_state !== this.prevMiddle) {
        this.prevMiddle = t.middle_state;
        this.lastMiddleChange = performance.now();
        this.glowingMiddle.set(true);
        this.displayMiddle.set(t.middle_state);
        this.scheduleGlowCheck();
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
