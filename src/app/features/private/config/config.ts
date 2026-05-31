import { Component, inject, OnInit, signal, computed, effect, OnDestroy, EffectRef } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Skeleton } from 'primeng/skeleton';
import { Toast } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { GestureConfigService } from '@core/services/gesture-config.service';
import { CalibrationService } from '@core/services/calibration.service';
import { ConfigService } from '@core/services/config.service';
import { SensorSocket } from '@core/services/sensor-socket';
import { LearningService, LearnAnalysis } from '@core/services/learning.service';
import {
  GestureConfig, GestureConfigForm, CONTEXTS, MOVEMENTS, ORIENTATIONS, FLEX_STATES, ACTIONS,
  getMovementLabel, getOrientationLabel, getFlexStateLabel, getContextLabel,
} from '@core/models/gesture-config.model';
import { getActionLabel } from '@core/models/glove-telemetry.model';
import { CalibrationEntry } from '@core/models/calibration.model';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-config',
  imports: [FormsModule, Skeleton, Toast, DecimalPipe, PercentPipe],
  providers: [MessageService],
  templateUrl: './config.html',
  styleUrl: './config.scss',
})
export default class Config implements OnInit, OnDestroy {
  private readonly gestureService = inject(GestureConfigService);
  private readonly calibrationService = inject(CalibrationService);
  private readonly configService = inject(ConfigService);
  private readonly learningService = inject(LearningService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly sensorSocket = inject(SensorSocket);
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  protected gestureConfigs = signal<GestureConfig[]>([]);
  protected gestureLoading = signal(true);
  protected gestureError = signal(false);

  protected calibration = signal<CalibrationEntry[]>([]);
  protected calibrationLoading = signal(true);
  protected calibrationError = signal(false);

  protected dialogOpen = signal(false);
  protected editingId = signal<string | null>(null);
  protected form = signal<GestureConfigForm>({
    movement: 'NONE',
    orientation: 'ANY',
    index_state: 0,
    middle_state: 0,
    action_key: 'play_pause',
    context: 'GLOBAL',
  });
  protected saving = signal(false);
  protected syncing = signal(false);

  protected testMode = signal(false);
  protected testActions = signal<Array<{ id: string; action: string; time: string }>>([]);
  protected testTelemetry = signal<any>(null);

  protected calibWizardOpen = signal(false);
  protected calibStep = signal<1 | 2 | 3>(1);
  protected calibSensor = signal<'index_finger' | 'middle_finger'>('index_finger');
  protected calibMinValue = signal<number | null>(null);
  protected calibMaxValue = signal<number | null>(null);
  protected calibLiveValue = signal(0);
  protected calibSaving = signal(false);

  protected readonly contexts = CONTEXTS;
  protected readonly movements = MOVEMENTS;
  protected readonly orientations = ORIENTATIONS;
  protected readonly flexStates = FLEX_STATES;
  protected readonly actions = ACTIONS;
  protected readonly getMovementLabel = getMovementLabel;
  protected readonly getOrientationLabel = getOrientationLabel;
  protected readonly getFlexStateLabel = getFlexStateLabel;
  protected readonly getContextLabel = getContextLabel;
  protected readonly getActionLabel = getActionLabel;

  protected activeContextTab = signal<string>('ALL');
  protected filteredConfigs = computed(() => {
    const tab = this.activeContextTab();
    if (tab === 'ALL') return this.gestureConfigs();
    return this.gestureConfigs().filter(c => c.context === tab);
  });
  protected readonly isConnected = computed(() => this.sensorSocket.connectionStatus() === 'connected');
  protected resettando = signal(false);

  protected learnOpen = signal(false);
  protected learnStep = signal(1);
  protected learnSamplesCollected = signal(0);
  protected learnAnalysis = signal<LearnAnalysis | null>(null);
  protected learnSaving = signal(false);
  protected learnActionKey = signal('play_pause');
  protected learnLiveFlexIndex = signal(0);
  protected learnLiveFlexMiddle = signal(0);

  private testActionIndex = 0;
  private testEffectCleanup: EffectRef | null = null;
  private calibEffectCleanup: EffectRef | null = null;
  private learnEffectCleanup: EffectRef | null = null;

  ngOnInit(): void {
    this.loadGestureConfigs();
    this.loadCalibration();
  }

  ngOnDestroy(): void {
    if (this.testMode()) {
      this.stopTestMode();
    }
    if (this.calibWizardOpen()) {
      this.closeCalibWizard();
    }
    if (this.learnOpen()) {
      this.closeLearnWizard();
    }
    this.testEffectCleanup?.destroy();
    this.calibEffectCleanup?.destroy();
    this.learnEffectCleanup?.destroy();
    this.debounceTimers.forEach(t => clearTimeout(t));
    this.debounceTimers.clear();
  }

  openLearnWizard(): void {
    const status = this.sensorSocket.connectionStatus();
    if (status !== 'connected') {
      this.messageService.add({
        severity: 'warn',
        summary: 'Guante no conectado',
        detail: 'Conectá el guante antes de aprender un gesto',
        life: 3000,
      });
      return;
    }

    this.learnOpen.set(true);
    this.learnStep.set(1);
    this.learnSamplesCollected.set(0);
    this.learnAnalysis.set(null);
    this.learnActionKey.set('play_pause');
    this.sensorSocket.connect();

    this.learnEffectCleanup?.destroy();
    this.learnEffectCleanup = effect(() => {
      if (!this.learnOpen()) return;
      const t = this.sensorSocket.telemetry();
      if (!t) return;
      this.learnLiveFlexIndex.set(t.flex_index);
      this.learnLiveFlexMiddle.set(t.flex_middle);
    });
  }

  learnStart(): void {
    this.learningService.start().subscribe({
      next: (res) => {
        this.learnSamplesCollected.set(res.session.samples_collected);
        this.learnStep.set(2);
        this.messageService.add({
          severity: 'info',
          summary: 'Aprendizaje iniciado',
          detail: 'Realizá el gesto 3 veces',
          life: 3000,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo iniciar la sesión de aprendizaje',
          life: 4000,
        });
      },
    });
  }

  learnCapture(): void {
    this.learningService.sample().subscribe({
      next: (res) => {
        const collected = res.session.samples_collected;
        this.learnSamplesCollected.set(collected);
        if (res.session.analysis) {
          this.learnAnalysis.set(res.session.analysis);
          this.learnStep.set(4);
        } else {
          this.learnStep.set(2 + collected);
        }
        this.messageService.add({
          severity: 'success',
          summary: `Muestra ${collected}/3`,
          detail: collected >= 3 ? 'Gesto completo! Revisá el análisis' : 'Seguí, hacé el gesto de nuevo',
          life: 2000,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo capturar la muestra',
          life: 4000,
        });
      },
    });
  }

  learnSave(): void {
    this.learnSaving.set(true);
    this.learningService.save(this.learnActionKey()).pipe(finalize(() => this.learnSaving.set(false))).subscribe({
      next: () => {
        this.closeLearnWizard();
        this.loadGestureConfigs();
        this.messageService.add({
          severity: 'success',
          summary: 'Gesto aprendido',
          detail: 'El nuevo gesto se guardó y está activo',
          life: 3000,
        });
      },
      error: (err) => {
        const detail = err?.error?.detail || 'No se pudo guardar el gesto aprendido';
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail,
          life: 4000,
        });
      },
    });
  }

  closeLearnWizard(): void {
    this.learnOpen.set(false);
    this.learnEffectCleanup?.destroy();
    this.learnEffectCleanup = null;
    this.learningService.cancel().subscribe();
    this.sensorSocket.disconnect();
  }

  startTestMode(): void {
    this.testMode.set(true);
    this.testActions.set([]);
    this.testActionIndex = 0;
    this.sensorSocket.connect();

    this.testEffectCleanup?.destroy();
    this.testEffectCleanup = effect(() => {
      const t = this.sensorSocket.telemetry();
      if (t && this.testMode()) {
        this.testTelemetry.set(t);
      }

      const actions = this.sensorSocket.recentActions();
      if (actions.length > this.testActionIndex && this.testMode()) {
        const latest = actions[0];
        this.testActions.update(prev => [{
          id: crypto.randomUUID(),
          action: getActionLabel(latest.action),
          time: new Date().toLocaleTimeString(),
        }, ...prev].slice(0, 50));
        this.testActionIndex = actions.length;
      }
    });
  }

  stopTestMode(): void {
    this.testMode.set(false);
    this.testActions.set([]);
    this.testTelemetry.set(null);
    this.testEffectCleanup?.destroy();
    this.testEffectCleanup = null;
    this.sensorSocket.disconnect();
  }

  openCalibWizard(sensorName: string): void {
    const status = this.sensorSocket.connectionStatus();
    if (status !== 'connected') {
      this.messageService.add({
        severity: 'warn',
        summary: 'Guante no conectado',
        detail: 'Conecta el guante antes de iniciar la calibracion',
        life: 3000,
      });
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
    this.calibEffectCleanup = effect(() => {
      if (!this.calibWizardOpen()) return;
      const t = this.sensorSocket.telemetry();
      if (!t) return;
      const s = this.calibSensor();
      this.calibLiveValue.set(s === 'index_finger' ? t.flex_index : t.flex_middle);
    });
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
      .pipe(finalize(() => this.calibSaving.set(false)))
      .subscribe({
        next: () => {
          this.calibWizardOpen.set(false);
          this.calibEffectCleanup?.destroy();
          this.calibEffectCleanup = null;
          this.sensorSocket.disconnect();
          this.loadCalibration();
          this.messageService.add({
            severity: 'success',
            summary: 'Calibración guardada',
            detail: `${sensorName === 'index_finger' ? 'Índice' : 'Medio'} calibrado: ${min} – ${max}`,
            life: 3000,
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: `No se pudo guardar la calibración de ${sensorName}`,
            life: 4000,
          });
        },
      });
  }

  closeCalibWizard(): void {
    this.calibWizardOpen.set(false);
    this.calibEffectCleanup?.destroy();
    this.calibEffectCleanup = null;
    this.sensorSocket.disconnect();
  }

  loadGestureConfigs(): void {
    this.gestureLoading.set(true);
    this.gestureError.set(false);
    this.gestureService.getAll().pipe(finalize(() => this.gestureLoading.set(false))).subscribe({
      next: (data) => this.gestureConfigs.set(data),
      error: () => this.gestureError.set(true),
    });
  }

  loadCalibration(): void {
    this.calibrationLoading.set(true);
    this.calibrationError.set(false);
    this.calibrationService.getAll().pipe(finalize(() => this.calibrationLoading.set(false))).subscribe({
      next: (data) => this.calibration.set(data),
      error: () => this.calibrationError.set(true),
    });
  }

  refreshConfigs(): void {
    this.loadGestureConfigs();
  }

  refreshCalibration(): void {
    this.loadCalibration();
  }

  openCreateDialog(): void {
    this.editingId.set(null);
    this.form.set({ movement: 'NONE', orientation: 'ANY', index_state: 0, middle_state: 0, action_key: 'play_pause', context: 'GLOBAL' });
    this.dialogOpen.set(true);
  }

  openEditDialog(config: GestureConfig): void {
    this.editingId.set(config.id);
    this.form.set({
      movement: config.movement,
      orientation: config.orientation,
      index_state: config.index_state,
      middle_state: config.middle_state,
      action_key: config.action_key,
      context: config.context ?? 'GLOBAL',
    });
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  saveGesture(): void {
    this.saving.set(true);
    const data = this.form();

    const action = this.editingId()
      ? this.gestureService.update(this.editingId()!, data)
      : this.gestureService.create(data);

    action.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => {
        this.gestureConfigs.update(list => {
          const id = this.editingId();
          if (id) {
            return list.map(g => g.id === id ? { ...saved, id: saved.id } : g);
          }
          return [...list, { ...saved, id: saved.id }];
        });
        this.closeDialog();
        this.messageService.add({
          severity: 'success',
          summary: 'Guardado',
          detail: `Gesto ${this.editingId() ? 'actualizado' : 'creado'}`,
          life: 2000,
        });
      },
      error: (err) => {
        this.closeDialog();
        const detail = err?.error?.detail || 'No se pudo guardar la configuración del gesto';
        const severity = detail.includes('Ya existe') ? 'warn' : 'error';
        this.messageService.add({
          severity,
          summary: severity === 'warn' ? 'Duplicado' : 'Error',
          detail,
          life: 5000,
        });
      },
    });
  }

  deleteGesture(event: Event, id: string): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: '¿Eliminar esta configuración de gesto?',
      accept: () => {
        this.gestureService.delete(id).subscribe({
          next: () => {
            this.gestureConfigs.update(list => list.filter(g => g.id !== id));
            this.messageService.add({
              severity: 'success',
              summary: 'Eliminado',
              detail: 'Configuración de gesto eliminada',
              life: 2000,
            });
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'No se pudo eliminar la configuración',
              life: 4000,
            });
          },
        });
      },
    });
  }

  syncFromSupabase(): void {
    this.syncing.set(true);
    this.configService.refreshFromSupabase().pipe(finalize(() => this.syncing.set(false))).subscribe({
      next: () => {
        this.loadGestureConfigs();
        this.loadCalibration();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo sincronizar con Supabase',
          life: 4000,
        });
      },
    });
  }

  resetToDefaults(): void {
    this.resettando.set(true);
    this.configService.resetToDefaults().pipe(finalize(() => this.resettando.set(false))).subscribe({
      next: () => {
        this.loadGestureConfigs();
        this.loadCalibration();
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

  updateCalibration(sensor: CalibrationEntry): void {
    const key = sensor.sensor_name;
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    if (sensor.min_value >= sensor.max_value) {
      this.calibration.update(list =>
        list.map(c => c.sensor_name === sensor.sensor_name ? { ...c } : c),
      );
      this.messageService.add({
        severity: 'warn',
        summary: 'Valores inválidos',
        detail: 'El valor máximo debe ser mayor que el mínimo',
        life: 3000,
      });
      return;
    }

    this.debounceTimers.set(key, setTimeout(() => {
      this.debounceTimers.delete(key);
      this.calibrationService.update(sensor.sensor_name, {
        min_value: sensor.min_value,
        max_value: sensor.max_value,
      }).subscribe({
        next: (updated) => {
          this.calibration.update(list =>
            list.map(c => c.sensor_name === sensor.sensor_name ? updated : c),
          );
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: `No se pudo guardar calibración de ${sensor.sensor_name}`,
            life: 4000,
          });
        },
      });
    }, 400));
  }
}
