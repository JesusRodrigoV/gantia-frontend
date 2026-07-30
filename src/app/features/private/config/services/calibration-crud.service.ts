import { Injectable, inject, signal, DestroyRef, Injector, effect, runInInjectionContext, EffectRef } from '@angular/core';
import { CalibrationService } from '@core/services/calibration.service';
import { SensorSocket } from '@core/services/sensor-socket';
import { ToastService } from '@core/services/toast.service';
import { CalibrationEntry } from '@core/models/calibration.model';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Injectable({ providedIn: 'root' })
export class CalibrationCrudService {
  private readonly calibrationService = inject(CalibrationService);
  private readonly toast = inject(ToastService);
  private readonly sensorSocket = inject(SensorSocket);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private calibEffectCleanup: EffectRef | null = null;

  readonly calibration = signal<CalibrationEntry[]>([]);
  readonly calibrationLoading = signal(true);
  readonly calibrationError = signal(false);

  readonly calibWizardOpen = signal(false);
  readonly calibStep = signal<1 | 2 | 3>(1);
  readonly calibSensor = signal<'index_finger' | 'middle_finger'>('index_finger');
  readonly calibMinValue = signal<number | null>(null);
  readonly calibMaxValue = signal<number | null>(null);
  readonly calibLiveValue = signal(0);
  readonly calibSaving = signal(false);

  loadCalibration(): void {
    this.calibrationLoading.set(true);
    this.calibrationError.set(false);
    this.calibrationService.getAll().pipe(finalize(() => this.calibrationLoading.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => this.calibration.set(data),
      error: () => this.calibrationError.set(true),
    });
  }

  refreshCalibration(): void {
    this.loadCalibration();
  }

  openCalibWizard(sensorName: string): void {
    const status = this.sensorSocket.connectionStatus();
    if (status !== 'connected') {
      this.toast.warn('Guante no conectado', 'Conectá el guante antes de iniciar la calibración');
      return;
    }
    const sensor = (sensorName === 'index_finger' ? 'index_finger' : 'middle_finger') as 'index_finger' | 'middle_finger';
    this.calibSensor.set(sensor);
    this.calibStep.set(1);
    this.calibMinValue.set(null);
    this.calibMaxValue.set(null);
    this.calibWizardOpen.set(true);
    this.sensorSocket.connect();

    this.calibEffectCleanup?.destroy();
    this.calibEffectCleanup = runInInjectionContext(this.injector, () => effect(() => {
      if (!this.calibWizardOpen()) return;
      const t = this.sensorSocket.telemetry();
      if (!t) return;
      const s = this.calibSensor();
      this.calibLiveValue.set(s === 'index_finger' ? t.flex_index : t.flex_middle);
    }));
  }

  captureCalibMin(): void {
    this.calibMinValue.set(this.calibLiveValue());
    this.calibStep.set(2);
  }

  captureCalibMax(): void {
    this.calibMaxValue.set(this.calibLiveValue());
    this.calibStep.set(3);
  }

  saveCalibration(): void {
    const min = this.calibMinValue();
    const max = this.calibMaxValue();
    if (min === null || max === null) return;

    this.calibSaving.set(true);
    const sensorName = this.calibSensor();

    this.calibrationService.update(sensorName, { min_value: min, max_value: max })
      .pipe(finalize(() => this.calibSaving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.calibWizardOpen.set(false);
          this.calibEffectCleanup?.destroy();
          this.calibEffectCleanup = null;
          this.sensorSocket.disconnect();
          this.loadCalibration();
          this.toast.success('Calibración guardada', `${sensorName === 'index_finger' ? 'Índice' : 'Medio'} calibrado: ${min} – ${max}`);
        },
        error: (err) => {
          this.toast.httpError(err, 'Error', `No se pudo guardar la calibración de ${sensorName === 'index_finger' ? 'índice' : 'medio'}`);
        },
      });
  }

  closeCalibWizard(): void {
    this.calibWizardOpen.set(false);
    this.calibEffectCleanup?.destroy();
    this.calibEffectCleanup = null;
    this.sensorSocket.disconnect();
  }

  updateCalibration(sensorName: string, min: number, max: number): void {
    const key = `calib-${sensorName}`;
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(key, setTimeout(() => {
      this.debounceTimers.delete(key);
      if (min >= max) {
        this.toast.warn('Calibración inválida', 'El mínimo debe ser menor al máximo');
        return;
      }
      this.calibrationService.update(sensorName, { min_value: min, max_value: max })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loadCalibration();
            this.toast.success('Calibración actualizada', `${sensorName} → ${min} – ${max}`, 2000);
          },
          error: (err) => {
            this.toast.httpError(err, 'Error', 'No se pudo actualizar la calibración');
          },
        });
    }, 400));
  }

  destroyCleanup(): void {
    this.calibEffectCleanup?.destroy();
    this.debounceTimers.forEach(t => clearTimeout(t));
    this.debounceTimers.clear();
  }
}
