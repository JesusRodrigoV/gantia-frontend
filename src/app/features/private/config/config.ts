import { Component, ChangeDetectionStrategy, inject, OnInit, signal, computed, DestroyRef, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Toast } from 'primeng/toast';
import { ConfigService } from '@core/services/config.service';
import { SensorSocket } from '@core/services/sensor-socket';
import { CONTEXTS, MOVEMENTS, ORIENTATIONS, FLEX_STATES, ACTIONS } from '@core/models/gesture-config.model';
import { SoundService } from '@core/services/sound.service';
import { ToastService } from '@core/services/toast.service';
import { env } from '../../../../environments/environment';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbsolutePointerCalibration } from './absolute-pointer-calibration';
import { TestMode } from './test-mode/test-mode';
import { GestureList } from './gesture-list/gesture-list';
import { GestureFormDialog } from './gesture-form-dialog/gesture-form-dialog';
import { LearningWizard } from './learning-wizard/learning-wizard';
import { CalibrationPanel } from './calibration-panel/calibration-panel';
import { GestureCrudService } from './services/gesture-crud.service';
import { CalibrationCrudService } from './services/calibration-crud.service';
import { AbsCalibrationData } from './models/config.model';
import { RoundedButton } from '@shared/components/ui/rounded-button';

@Component({
  selector: 'app-config',
  imports: [Toast, AbsolutePointerCalibration, TestMode, GestureList, GestureFormDialog, LearningWizard, CalibrationPanel, RoundedButton],
  templateUrl: './config.html',
  styleUrl: './config.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Config implements OnInit {
  protected readonly gestureCrud = inject(GestureCrudService);
  protected readonly calibrationCrud = inject(CalibrationCrudService);
  private readonly configService = inject(ConfigService);
  private readonly toast = inject(ToastService);
  private readonly http = inject(HttpClient);
  private readonly sensorSocket = inject(SensorSocket);
  private readonly soundService = inject(SoundService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly learnWizard = viewChild.required(LearningWizard);

  protected syncing = signal(false);
  protected resettando = signal(false);

  protected readonly absPointerEnabled = computed(() => this.sensorSocket.absolutePointerEnabled());
  protected absCalibrationData = signal<AbsCalibrationData | null>(null);
  protected absCalibrationExists = computed(() => this.absCalibrationData() !== null);
  protected absCalibrationIsDraft = computed(() => this.absCalibrationData()?.status === 'draft');
  protected absCalibrationCorners = computed(() => {
    const data = this.absCalibrationData();
    if (!data?.corners) return 0;
    return Object.keys(data.corners).length;
  });
  protected absCalibWizardOpen = signal(false);
  protected absCalibLoading = signal(false);

  protected readonly contexts = CONTEXTS;
  protected readonly movements = MOVEMENTS;
  protected readonly orientations = ORIENTATIONS;
  protected readonly flexStates = FLEX_STATES;
  protected readonly actions: string[] = [...ACTIONS];

  ngOnInit(): void {
    this.gestureCrud.loadGestureConfigs();
    this.calibrationCrud.loadCalibration();
    this.checkAbsCalibration();
  }

  protected onToggleAbsPointer(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.sensorSocket.sendToggleAbsolutePointer(target.checked);
  }

  protected openAbsCalibWizard(): void {
    this.absCalibWizardOpen.set(true);
  }

  protected onAbsCalibSaved(): void {
    this.absCalibWizardOpen.set(false);
    this.checkAbsCalibration();
    this.toast.success('Calibración guardada', 'El puntero absoluto ya está calibrado');
  }

  protected closeAbsCalibWizard(): void {
    this.absCalibWizardOpen.set(false);
  }

  protected openLearnWizard(): void {
    this.learnWizard().open();
  }

  protected onLearnSaved(): void {
    this.gestureCrud.loadGestureConfigs();
  }

  private checkAbsCalibration(): void {
    this.absCalibLoading.set(true);
    this.http.get(`${env.apiUrl}/config/absolute-pointer/calibration`).pipe(finalize(() => this.absCalibLoading.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data: AbsCalibrationData) => this.absCalibrationData.set(data),
      error: () => {
        this.absCalibrationData.set(null);
      },
    });
  }

  protected syncFromSupabase(): void {
    this.syncing.set(true);
    this.configService.refreshFromSupabase().pipe(finalize(() => this.syncing.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.gestureCrud.loadGestureConfigs();
        this.calibrationCrud.loadCalibration();
        this.soundService.play('success');
      },
      error: (err) => {
        this.soundService.play('droplet');
        this.toast.httpError(err, 'Error', 'No se pudo sincronizar con Supabase');
      },
    });
  }

  protected resetToDefaults(): void {
    this.resettando.set(true);
    this.configService.resetToDefaults().pipe(finalize(() => this.resettando.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.gestureCrud.loadGestureConfigs();
        this.calibrationCrud.loadCalibration();
        this.toast.success('Reset completo', 'Todas las configuraciones volvieron a sus valores por defecto');
      },
      error: (err) => {
        this.toast.httpError(err, 'Error', 'No se pudieron resetear las configuraciones');
      },
    });
  }
}
