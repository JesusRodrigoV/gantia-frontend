import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  viewChild,
  ElementRef,
  afterNextRender,
  OnDestroy,
  signal,
  effect,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AcelerometerChart } from '@components/acelerometer-chart';
import { Flexion } from '@components/flexion';
import { GyroscopeChart } from '@components/gyroscope-chart';
import { Skeleton } from 'primeng/skeleton';
import { SensorSocket } from '@core/services/sensor-socket';
import { FLEX_STATE_LABELS, getActionLabel } from '@core/models/glove-telemetry.model';
import { createSwapy } from 'swapy';
import type { Swapy } from 'swapy';

const STORAGE_KEY = 'gantia-sensor-layout';

@Component({
  selector: 'app-sensores',
  imports: [GyroscopeChart, AcelerometerChart, Flexion, DecimalPipe, Skeleton],
  templateUrl: './sensores.html',
  styleUrl: './sensores.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Sensores implements OnDestroy {
  protected sensorSocket = inject(SensorSocket);
  protected FLEX_STATE_LABELS = FLEX_STATE_LABELS;
  private swapyContainer = viewChild<ElementRef<HTMLElement>>('swapyContainer');
  private swapy: Swapy | null = null;
  protected isSwapping = signal(false);

  protected orientation = computed(() => {
    const t = this.sensorSocket.telemetry();
    if (!t) return null;
    const pitch = Math.atan2(t.accel_x, Math.sqrt(t.accel_y ** 2 + t.accel_z ** 2)) * (180 / Math.PI);
    const roll = Math.atan2(t.accel_y, t.accel_z) * (180 / Math.PI);
    return { pitch, roll };
  });

  protected mouseModeActive = computed(() => this.sensorSocket.mouseModeActive());

  protected hasTelemetry = computed(() => !!this.sensorSocket.telemetry());

  protected dataStale = computed(() => {
    const t = this.sensorSocket.telemetry();
    const f = this.sensorSocket.dataFlowing();
    return !!t && !f;
  });

  protected waitingForDevice = computed(() => this.sensorSocket.waitingForDevice());

  protected showDisconnectedOverlay = computed(
    () => this.sensorSocket.connectionStatus() === 'disconnected' && !!this.sensorSocket.telemetry(),
  );

  protected wsError = computed(
    () => this.sensorSocket.connectionStatus() === 'error' && !this.sensorSocket.telemetry(),
  );

  protected gestureFlash = signal<{ gesture: string; action: string } | null>(null);
  private gestureTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => {
      const container = this.swapyContainer()?.nativeElement;
      if (!container) return;

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const map: Array<{ slot: string; item: string }> = JSON.parse(saved);
          for (const { slot: slotId, item: itemId } of map) {
            const slot = container.querySelector<HTMLElement>(`[data-swapy-slot="${slotId}"]`);
            const item = container.querySelector<HTMLElement>(`[data-swapy-item="${itemId}"]`);
            if (slot && item) {
              slot.appendChild(item);
            }
          }
        } catch {}
      }

      this.swapy = createSwapy(container, {
        animation: 'dynamic',
        swapMode: 'hover',
        dragAxis: 'both',
      });

      this.swapy.onSwapStart(() => {
        this.isSwapping.set(true);
      });

      this.swapy.onSwapEnd(({ slotItemMap, hasChanged }) => {
        this.isSwapping.set(false);
        if (hasChanged) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(slotItemMap.asArray));
        }
      });
    });

    effect(() => {
      const g = this.sensorSocket.gestureDetected();
      if (!g) return;
      this.gestureFlash.set({ gesture: g.gesture, action: getActionLabel(g.action) });
      if (this.gestureTimer) clearTimeout(this.gestureTimer);
      this.gestureTimer = setTimeout(() => this.gestureFlash.set(null), 2000);
    });
  }

  ngOnDestroy() {
    this.swapy?.destroy();
    if (this.gestureTimer) clearTimeout(this.gestureTimer);
  }
}
