import {
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
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SensorSocket } from '@core/services/sensor-socket';
import { getActionLabel } from '@core/models/glove-telemetry.model';
import { createSwapy } from 'swapy';
import type { Swapy } from 'swapy';

const STORAGE_KEY = 'gantia-sensor-layout';

@Component({
  selector: 'app-sensores',
  imports: [GyroscopeChart, AcelerometerChart, Flexion, DecimalPipe, Skeleton, Toast],
  templateUrl: './sensores.html',
  styleUrl: './sensores.scss',
  providers: [MessageService],
})
export default class Sensores implements OnDestroy {
  protected sensorSocket = inject(SensorSocket);
  private messageService = inject(MessageService);
  private swapyContainer = viewChild<ElementRef<HTMLElement>>('swapyContainer');
  private swapy: Swapy | null = null;
  protected isSwapping = signal(false);
  private lastActionIndex = 0;

  protected orientation = computed(() => {
    const t = this.sensorSocket.telemetry();
    if (!t) return null;
    const pitch = Math.atan2(t.accel_x, Math.sqrt(t.accel_y ** 2 + t.accel_z ** 2)) * (180 / Math.PI);
    const roll = Math.atan2(t.accel_y, t.accel_z) * (180 / Math.PI);
    return { pitch, roll };
  });

  protected mouseModeActive = computed(() => this.sensorSocket.mouseModeActive());

  protected recentActions = computed(() => this.sensorSocket.recentActions());

  protected hasTelemetry = computed(() => !!this.sensorSocket.telemetry());

  protected waitingForDevice = computed(() => this.sensorSocket.waitingForDevice());

  protected showDisconnectedOverlay = computed(
    () => this.sensorSocket.connectionStatus() === 'disconnected' && !!this.sensorSocket.telemetry(),
  );

  protected wsError = computed(
    () => this.sensorSocket.connectionStatus() === 'error' && !this.sensorSocket.telemetry(),
  );

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
      const actions = this.sensorSocket.recentActions();
      if (actions.length > this.lastActionIndex && actions.length > 0) {
        const latest = actions[0];
        if (latest.action !== 'mouse_mode') {
          const label = getActionLabel(latest.action);
          this.messageService.add({
            severity: 'info',
            summary: 'Gesto detectado',
            detail: label,
            life: 2000,
            icon: 'bx bx-flash',
            key: 'gesture-toast',
          });
        }
        this.lastActionIndex = actions.length;
      }
    });
  }

  protected getActionLabel = getActionLabel;

  ngOnDestroy() {
    this.swapy?.destroy();
  }
}
