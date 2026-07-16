import { Component, ChangeDetectionStrategy, inject, Injector, signal, computed, effect, runInInjectionContext, output, EffectRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SensorSocket } from '@core/services/sensor-socket';
import { env } from '../../../../environments/environment';
import { finalize } from 'rxjs';

type CornerName = 'tl' | 'tr' | 'bl' | 'br';

interface CornerStep {
  key: CornerName;
  label: string;
  description: string;
  icon: string;
}

const CORNER_STEPS: CornerStep[] = [
  { key: 'tl', label: 'Esquina Superior Izquierda', description: 'Incliná la mano hacia arriba-izquierda', icon: 'bx bx-arrow-to-top-left' },
  { key: 'tr', label: 'Esquina Superior Derecha', description: 'Incliná la mano hacia arriba-derecha', icon: 'bx bx-arrow-to-top-right' },
  { key: 'bl', label: 'Esquina Inferior Izquierda', description: 'Incliná la mano hacia abajo-izquierda', icon: 'bx bx-arrow-to-bottom-left' },
  { key: 'br', label: 'Esquina Inferior Derecha', description: 'Incliná la mano hacia abajo-derecha', icon: 'bx bx-arrow-to-bottom-right' },
];

@Component({
  selector: 'app-absolute-pointer-calibration',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './absolute-pointer-calibration.html',
  styleUrl: './absolute-pointer-calibration.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AbsolutePointerCalibration {
  private readonly sensorSocket = inject(SensorSocket);
  private readonly http = inject(HttpClient);
  private readonly injector = inject(Injector);

  readonly close = output<void>();
  readonly saved = output<void>();

  protected readonly step = signal(0); // 0-4 (0=start, 4=done)
  protected readonly corners = signal<Record<CornerName, { pitch: number; roll: number } | null>>({
    tl: null, tr: null, bl: null, br: null,
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly screenWidth = signal(1920);
  protected readonly screenHeight = signal(1080);
  protected readonly currentPitch = signal(0);
  protected readonly currentRoll = signal(0);
  protected readonly hasGloveData = signal(false);

  protected readonly cornersList = CORNER_STEPS;

  protected readonly currentCorner = computed(() => {
    const s = this.step();
    if (s >= 1 && s <= 4) return CORNER_STEPS[s - 1];
    return null;
  });

  protected readonly completedCorners = computed(() => {
    const c = this.corners();
    return (['tl', 'tr', 'bl', 'br'] as CornerName[]).filter(k => c[k] !== null).length;
  });

  protected readonly allCornersDone = computed(() => this.completedCorners() === 4);

  private liveEffectCleanup: EffectRef | null = null;

  start(): void {
    this.step.set(1);
    this.sensorSocket.connect();

    this.liveEffectCleanup = runInInjectionContext(this.injector, () => {
      return effect(() => {
        const t = this.sensorSocket.telemetry();
        if (t) {
          // Compute normalized pitch/roll from accel data
          const g = Math.sqrt(t.accel_x ** 2 + t.accel_y ** 2 + t.accel_z ** 2);
          if (g > 0.1) {
            this.currentPitch.set(-t.accel_x / g);
            this.currentRoll.set(t.accel_y / g);
            this.hasGloveData.set(true);
          }
        }
      });
    });
  }

  captureCorner(): void {
    const s = this.step();
    if (s < 1 || s > 4) return;

    const corner = CORNER_STEPS[s - 1].key;
    this.corners.update(c => ({
      ...c,
      [corner]: { pitch: this.currentPitch(), roll: this.currentRoll() },
    }));

    if (s >= 4) {
      this.step.set(0); // Show review
    } else {
      this.step.set(s + 1);
    }
  }

  redoCorner(corner: CornerName): void {
    const idx = CORNER_STEPS.findIndex(c => c.key === corner);
    if (idx !== -1) {
      this.corners.update(c => ({ ...c, [corner]: null }));
      this.step.set(idx + 1);
    }
  }

  save(): void {
    this.saving.set(true);
    this.error.set(null);

    const c = this.corners();
    const payload = {
      corners: Object.fromEntries(
        (['tl', 'tr', 'bl', 'br'] as CornerName[]).map(k => [
          k,
          c[k] ?? { pitch: 0, roll: 0 },
        ]),
      ),
      screen_width: this.screenWidth(),
      screen_height: this.screenHeight(),
    };

    this.http.put(`${env.apiUrl}/config/absolute-pointer/calibration`, payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.cleanup();
          this.saved.emit();
        },
        error: (err) => {
          this.error.set(err?.error?.detail || 'Error al guardar la calibración');
        },
      });
  }

  cancel(): void {
    const completed = this.completedCorners();
    if (completed > 0) {
      // Fire-and-forget: save partial data as draft before closing (Spec R1)
      const c = this.corners();
      const payload = {
        corners: Object.fromEntries(
          (['tl', 'tr', 'bl', 'br'] as CornerName[]).map(k => [
            k,
            c[k] ?? null,
          ]),
        ) as Record<CornerName, { pitch: number; roll: number } | null>,
        screen_width: this.screenWidth(),
        screen_height: this.screenHeight(),
        status: 'draft' as const,
      };
      this.http.put(`${env.apiUrl}/config/absolute-pointer/calibration`, payload).subscribe({
        error: () => console.warn('Failed to save draft calibration'),
      });
    }
    this.cleanup();
    this.close.emit();
  }

  private cleanup(): void {
    this.liveEffectCleanup?.destroy();
    this.liveEffectCleanup = null;
    this.sensorSocket.disconnect();
  }
}
