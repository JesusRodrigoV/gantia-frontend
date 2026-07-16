import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy, signal, computed, DestroyRef, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ConfigService } from '@core/services/config.service';
import { SensorSocket } from '@core/services/sensor-socket';
import { CONTEXTS, MOVEMENTS, ORIENTATIONS, FLEX_STATES, ACTIONS } from '@core/models/gesture-config.model';
import { SoundService } from '@core/services/sound.service';
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

@Component({
  selector: 'app-config',
  imports: [Toast, AbsolutePointerCalibration, TestMode, GestureList, GestureFormDialog, LearningWizard, CalibrationPanel],
  providers: [MessageService],
  templateUrl: './config.html',
  styleUrl: './config.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Config implements OnInit, OnDestroy {
  protected readonly gestureCrud = inject(GestureCrudService);
  protected readonly calibrationCrud = inject(CalibrationCrudService);
  private readonly configService = inject(ConfigService);
  private readonly messageService = inject(MessageService);
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

  ngOnDestroy(): void {
    // handled by child components
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
    this.messageService.add({
      severity: 'success',
      summary: 'Calibración guardada',
      detail: 'El puntero absoluto ya está calibrado',
      life: 3000,
    });
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
      error: () => this.absCalibrationData.set(null),
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
      error: () => {
        this.soundService.play('droplet');
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo sincronizar con Supabase',
          life: 4000,
        });
      },
    });
  }

  protected resetToDefaults(): void {
    this.resettando.set(true);
    this.configService.resetToDefaults().pipe(finalize(() => this.resettando.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.gestureCrud.loadGestureConfigs();
        this.calibrationCrud.loadCalibration();
        this.messageService.add({
          severity: 'success',
          summary: 'Reset completo',
          detail: 'Todas las configuraciones volvieron a sus valores por defecto',
          life: 4000,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron resetear las configuraciones',
          life: 4000,
        });
      },
    });
  }
}
