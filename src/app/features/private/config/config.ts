import { Component, ChangeDetectionStrategy, inject, Injector, OnInit, signal, computed, effect, OnDestroy, EffectRef, runInInjectionContext } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Skeleton } from 'primeng/skeleton';
import { Toast } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { GestureConfigService } from '@core/services/gesture-config.service';
import { CalibrationService } from '@core/services/calibration.service';
import { ConfigService } from '@core/services/config.service';
import { SensorSocket } from '@core/services/sensor-socket';
import { LearningService, LearnAnalysis } from '@core/services/learning.service';
import {
  GestureConfig, GestureConfigForm, MacroStep, CONTEXTS, MOVEMENTS, ORIENTATIONS, FLEX_STATES, ACTIONS,
  getMovementLabel, getOrientationLabel, getFlexStateLabel, getContextLabel,
} from '@core/models/gesture-config.model';
import { MacroRecordingService } from '@core/services/macro-recording.service';
import { SoundService } from '@core/services/sound.service';
import { getActionLabel } from '@core/models/glove-telemetry.model';
import { CalibrationEntry } from '@core/models/calibration.model';
import { env } from '../../../../environments/environment';
import { finalize } from 'rxjs';
import AbsolutePointerCalibration from './absolute-pointer-calibration';

@Component({
  selector: 'app-config',
  imports: [FormsModule, Skeleton, Toast, DecimalPipe, PercentPipe, AbsolutePointerCalibration],
  providers: [MessageService],
  templateUrl: './config.html',
  styleUrl: './config.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Config implements OnInit, OnDestroy {
  private readonly gestureService = inject(GestureConfigService);
  private readonly calibrationService = inject(CalibrationService);
  private readonly configService = inject(ConfigService);
  private readonly injector = inject(Injector);
  private readonly learningService = inject(LearningService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly http = inject(HttpClient);
  private readonly sensorSocket = inject(SensorSocket);
  private readonly macroRecordingService = inject(MacroRecordingService);
  private readonly soundService = inject(SoundService);
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

  protected onFormField(field: keyof GestureConfigForm, value: string | number | undefined): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  protected onCompositeField(step: 1 | 2, field: string, value: string | number): void {
    const sig = step === 1 ? this.compositeStep1 : this.compositeStep2;
    sig.update(s => ({ ...s, [field]: value }));
  }

  protected recording = signal(false);
  protected recordedKeys = signal<string[]>([]);
  protected showKeyRecorder = computed(() => this.form().action_key === 'hotkey');
  protected showSequenceEditor = computed(() => this.form().action_key === 'sequence');

  // Macro step editor state
  protected macroSteps = signal<MacroStep[]>([]);
  protected macroRepeat = signal(1);
  protected isRecording = signal(false);

  // Composite state
  protected showCompositeEditor = computed(() => this.form().movement === 'COMPOSITE');
  protected compositeStep1 = signal<{ movement: string; index_state: number; middle_state: number; orientation: string }>({
    movement: 'SWIPE_RIGHT', index_state: 2, middle_state: 2, orientation: 'ANY',
  });
  protected compositeStep2 = signal<{ movement: string; index_state: number; middle_state: number; orientation: string }>({
    movement: 'TWIST', index_state: 2, middle_state: 2, orientation: 'ANY',
  });
  protected compositeActionKey = signal<string>('next_track');

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

  // Absolute pointer state
  protected readonly absPointerEnabled = computed(() => this.sensorSocket.absolutePointerEnabled());
  protected absCalibrationData = signal<any | null>(null); // null = unknown/not found
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
  protected readonly actions = ACTIONS;
  protected readonly getMovementLabel = getMovementLabel;
  protected readonly getOrientationLabel = getOrientationLabel;
  protected readonly getFlexStateLabel = getFlexStateLabel;
  protected readonly getContextLabel = getContextLabel;
  protected readonly getActionLabel = getActionLabel;

  protected readonly KEY_MAP: Record<string, string> = {
    Control: 'ctrl', Alt: 'alt', Shift: 'shift', Meta: 'win',
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    ' ': 'space', Escape: 'escape', Enter: 'enter', Tab: 'tab',
    Delete: 'delete', Backspace: 'backspace',
    F1: 'f1', F2: 'f2', F3: 'f3', F4: 'f4', F5: 'f5', F6: 'f6',
    F7: 'f7', F8: 'f8', F9: 'f9', F10: 'f10', F11: 'f11', F12: 'f12',
  };

  protected readonly hotkeyPresets = [
    { label: 'Ctrl+C', value: 'ctrl,c' },
    { label: 'Ctrl+V', value: 'ctrl,v' },
    { label: 'Ctrl+X', value: 'ctrl,x' },
    { label: 'Ctrl+Z', value: 'ctrl,z' },
    { label: 'Win+D', value: 'win,d' },
    { label: 'Alt+Tab', value: 'alt,tab' },
    { label: 'Win+E', value: 'win,e' },
    { label: 'Ctrl+Shift+Esc', value: 'ctrl,shift,esc' },
    { label: 'F5', value: 'f5' },
    { label: 'F11', value: 'f11' },
    { label: 'Win+R', value: 'win,r' },
    { label: 'Ctrl+Alt+Del', value: 'ctrl,alt,delete' },
  ];

  protected activeContextTab = signal<string>('ALL');
  protected filteredConfigs = computed(() => {
    const tab = this.activeContextTab();
    if (tab === 'ALL') return this.gestureConfigs();
    return this.gestureConfigs().filter(c => c.context === tab);
  });
  protected readonly isConnected = computed(() => this.sensorSocket.connectionStatus() === 'connected');
  protected resettando = signal(false);
  protected exporting = signal(false);
  protected importing = signal(false);

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
    this.checkAbsCalibration();
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
    this.learnEffectCleanup = runInInjectionContext(this.injector, () => effect(() => {
      if (!this.learnOpen()) return;
      const t = this.sensorSocket.telemetry();
      if (!t) return;
      this.learnLiveFlexIndex.set(t.flex_index);
      this.learnLiveFlexMiddle.set(t.flex_middle);
    }));
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
        this.soundService.play('success');
        this.messageService.add({
          severity: 'success',
          summary: 'Gesto aprendido',
          detail: 'El nuevo gesto se guardó y está activo',
          life: 3000,
        });
      },
      error: (err) => {
        const detail = err?.error?.detail || 'No se pudo guardar el gesto aprendido';
        this.soundService.play('droplet');
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

  checkAbsCalibration(): void {
    this.absCalibLoading.set(true);
    this.http.get(`${env.apiUrl}/config/absolute-pointer/calibration`).pipe(finalize(() => this.absCalibLoading.set(false))).subscribe({
      next: (data: any) => this.absCalibrationData.set(data),
      error: () => this.absCalibrationData.set(null),
    });
  }

  toggleAbsPointer(enabled: boolean): void {
    this.sensorSocket.sendToggleAbsolutePointer(enabled);
  }

  openAbsCalibWizard(): void {
    this.absCalibWizardOpen.set(true);
  }

  onAbsCalibSaved(): void {
    this.absCalibWizardOpen.set(false);
    this.checkAbsCalibration();
    this.messageService.add({
      severity: 'success',
      summary: 'Calibración guardada',
      detail: 'El puntero absoluto ya está calibrado',
      life: 3000,
    });
  }

  closeAbsCalibWizard(): void {
    this.absCalibWizardOpen.set(false);
  }

  startTestMode(): void {
    this.testMode.set(true);
    this.testActions.set([]);
    this.testActionIndex = 0;
    this.sensorSocket.connect();

    this.testEffectCleanup?.destroy();
    this.testEffectCleanup = runInInjectionContext(this.injector, () => effect(() => {
      const t = this.sensorSocket.telemetry();
      if (t && this.testMode()) {
        this.testTelemetry.set(t);
      }

      const actions = this.sensorSocket.recentActions();
      const len = actions.length;
      if (this.testMode() && len > this.testActionIndex) {
        const newCount = len - this.testActionIndex;
        for (let i = 0; i < newCount; i++) {
          const action = actions[i];
          this.testActions.update(prev => [{
            id: crypto.randomUUID(),
            action: getActionLabel(action.action),
            time: new Date().toLocaleTimeString(),
          }, ...prev].slice(0, 50));
        }
        this.testActionIndex = len;
      }
    }));
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
    this.form.set({ movement: 'NONE', orientation: 'ANY', index_state: 0, middle_state: 0, action_key: 'play_pause', action_value: '', context: 'GLOBAL' });
    this.recordedKeys.set([]);
    this.recording.set(false);
    this.compositeStep1.set({ movement: 'SWIPE_RIGHT', index_state: 2, middle_state: 2, orientation: 'ANY' });
    this.compositeStep2.set({ movement: 'TWIST', index_state: 2, middle_state: 2, orientation: 'ANY' });
    this.compositeActionKey.set('next_track');
    this.macroSteps.set([]);
    this.macroRepeat.set(1);
    this.isRecording.set(false);
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
      action_value: config.action_value ?? '',
      context: config.context ?? 'GLOBAL',
    });
    if (config.movement === 'COMPOSITE' && config.action_value) {
      try {
        const steps = JSON.parse(config.action_value);
        if (Array.isArray(steps) && steps.length >= 2) {
          this.compositeStep1.set(steps[0]);
          this.compositeStep2.set(steps[1]);
        }
      } catch {}
      this.compositeActionKey.set(config.action_key);
    }
    if (config.action_key === 'hotkey' && config.action_value) {
      this.recordedKeys.set(config.action_value.split(','));
    } else {
      this.recordedKeys.set([]);
    }
    this.recording.set(false);

    // Load existing macro steps for sequence action
    if (config.action_key === 'sequence' && config.action_value) {
      try {
        const parsed = JSON.parse(config.action_value);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.steps)) {
            this.macroSteps.set(parsed.steps);
            this.macroRepeat.set(parsed.repeat ?? 1);
          } else if (Array.isArray(parsed)) {
            // Legacy bare array format
            this.macroSteps.set(parsed.map((s: any) => ({ action: s.action, value: s.value ?? '' })));
          }
        }
      } catch {
        // Try pipe-separated format
        const steps = this.parsePipeToSteps(config.action_value);
        if (steps.length > 0) {
          this.macroSteps.set(steps);
        }
      }
    } else {
      this.macroSteps.set([]);
      this.macroRepeat.set(1);
    }
    this.isRecording.set(false);
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.recording.set(false);
    this.recordedKeys.set([]);
    this.dialogOpen.set(false);
  }

  saveGesture(): void {
    this.saving.set(true);
    const data = { ...this.form() };

    // Build JSON action_value for composites
    if (data.movement === 'COMPOSITE') {
      const s1 = this.compositeStep1();
      const s2 = this.compositeStep2();
      data.action_value = JSON.stringify([s1, s2]);
      data.action_key = this.compositeActionKey();
      data.orientation = 'ANY';
      data.index_state = 0;
      data.middle_state = 0;
    }

    // Build JSON action_value for sequence macros
    if (data.action_key === 'sequence') {
      data.action_value = this.buildMacroJson();
    }

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
        this.soundService.play('success');
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
            this.soundService.play('success');
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

  protected startRecording(): void {
    this.recording.set(true);
  }

  protected stopRecording(): void {
    this.recording.set(false);
  }

  protected onKeyDown(event: KeyboardEvent): void {
    event.preventDefault();
    const key = event.key;
    const mapped = this.KEY_MAP[key] ?? key.toLowerCase();
    if (mapped.length > 1 || /^[a-z0-9]$/.test(mapped)) {
      this.recordedKeys.update(keys => {
        if (!keys.includes(mapped)) return [...keys, mapped];
        return keys;
      });
    }
    this.form.update(f => ({ ...f, action_value: this.recordedKeys().join(',') }));
  }

  protected clearRecording(): void {
    this.recordedKeys.set([]);
    this.form.update(f => ({ ...f, action_value: '' }));
  }

  protected applyPreset(value: string): void {
    this.recordedKeys.set(value.split(','));
    this.form.update(f => ({ ...f, action_value: value }));
  }

  // ── Macro step helpers ──

  protected addMacroStep(): void {
    this.macroSteps.update(steps => [...steps, { action: 'hotkey', value: '' }]);
  }

  protected removeMacroStep(index: number): void {
    this.macroSteps.update(steps => steps.filter((_, i) => i !== index));
  }

  protected moveMacroStepUp(index: number): void {
    if (index <= 0) return;
    this.macroSteps.update(steps => {
      const copy = [...steps];
      [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
      return copy;
    });
  }

  protected moveMacroStepDown(index: number): void {
    this.macroSteps.update(steps => {
      if (index >= steps.length - 1) return steps;
      const copy = [...steps];
      [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
      return copy;
    });
  }

  protected updateMacroStepAction(index: number, action: string): void {
    this.macroSteps.update(steps =>
      steps.map((s, i) => (i === index ? { ...s, action } : s)),
    );
  }

  protected updateMacroStepValue(index: number, value: string): void {
    this.macroSteps.update(steps =>
      steps.map((s, i) => (i === index ? { ...s, value } : s)),
    );
  }

  protected parsePipeToSteps(value: string): MacroStep[] {
    return value.split('|').map(part => {
      const colonIdx = part.indexOf(':');
      if (colonIdx > 0) {
        return { action: part.slice(0, colonIdx).trim(), value: part.slice(colonIdx + 1).trim() };
      }
      return { action: part.trim() };
    });
  }

  protected buildMacroJson(): string {
    return JSON.stringify({ steps: this.macroSteps(), repeat: this.macroRepeat() });
  }

  protected toggleRecording(): void {
    if (this.isRecording()) {
      const steps = this.macroRecordingService.stop();
      if (steps.length > 0) {
        this.macroSteps.update(existing => [...existing, ...steps]);
      }
      this.isRecording.set(false);
    } else {
      this.macroRecordingService.start();
      this.isRecording.set(true);
    }
  }

  syncFromSupabase(): void {
    this.syncing.set(true);
    this.configService.refreshFromSupabase().pipe(finalize(() => this.syncing.set(false))).subscribe({
      next: () => {
        this.loadGestureConfigs();
        this.loadCalibration();
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

  exportConfigs(): void {
    this.exporting.set(true);
    this.gestureService.exportConfigs().pipe(finalize(() => this.exporting.set(false))).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gantia-gestos.json';
        a.click();
        URL.revokeObjectURL(url);
        this.soundService.play('sparkle');
        this.messageService.add({
          severity: 'success',
          summary: 'Exportado',
          detail: 'Configuraciones exportadas como JSON',
          life: 3000,
        });
      },
      error: () => {
        this.soundService.play('droplet');
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron exportar las configuraciones',
          life: 4000,
        });
      },
    });
  }

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    this.importing.set(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!Array.isArray(data)) throw new Error('Formato invalido');
        this.gestureService.importConfigs(data).pipe(finalize(() => this.importing.set(false))).subscribe({
          next: (res) => {
            this.loadGestureConfigs();
            this.soundService.play('success');
            this.messageService.add({
              severity: 'success',
              summary: 'Importado',
              detail: `${res.imported} importadas, ${res.skipped} omitidas`,
              life: 4000,
            });
          },
          error: () => {
            this.soundService.play('droplet');
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'No se pudieron importar las configuraciones',
              life: 4000,
            });
          },
        });
      } catch {
        this.importing.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'El archivo JSON no tiene un formato valido',
          life: 4000,
        });
      }
    };
    reader.readAsText(file);
    input.value = '';
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
