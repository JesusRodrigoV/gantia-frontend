import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { GestureConfigService } from '@core/services/gesture-config.service';
import { ConfirmationService } from 'primeng/api';
import { SoundService } from '@core/services/sound.service';
import { ToastService } from '@core/services/toast.service';
import { MacroRecordingService } from '@core/services/macro-recording.service';
import {
  GestureConfig, GestureConfigForm, MacroStep,
  getMovementLabel, getOrientationLabel, getFlexStateLabel, getContextLabel,
} from '@core/models/gesture-config.model';
import { getActionLabel } from '@core/models/glove-telemetry.model';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Injectable({ providedIn: 'root' })
export class GestureCrudService {
  private readonly gestureService = inject(GestureConfigService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly toast = inject(ToastService);
  private readonly soundService = inject(SoundService);
  private readonly macroRecordingService = inject(MacroRecordingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly gestureConfigs = signal<GestureConfig[]>([]);
  readonly gestureLoading = signal(true);
  readonly gestureError = signal(false);

  readonly activeContextTab = signal<string>('ALL');
  readonly filteredConfigs = computed(() => {
    const tab = this.activeContextTab();
    if (tab === 'ALL') return this.gestureConfigs();
    return this.gestureConfigs().filter(c => c.context === tab);
  });

  readonly dialogOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly exporting = signal(false);
  readonly importing = signal(false);

  readonly form = signal<GestureConfigForm>({
    movement: 'NONE', orientation: 'ANY', index_state: 0, middle_state: 0,
    action_key: 'play_pause', context: 'GLOBAL',
  });
  readonly onFormField = (field: keyof GestureConfigForm, value: string | number | undefined): void => {
    this.form.update(f => ({ ...f, [field]: value }));
  };

  readonly recording = signal(false);
  readonly recordedKeys = signal<string[]>([]);
  readonly showKeyRecorder = computed(() => this.form().action_key === 'hotkey');
  readonly showSequenceEditor = computed(() => this.form().action_key === 'sequence');

  readonly macroSteps = signal<MacroStep[]>([]);
  readonly macroRepeat = signal(1);
  readonly isRecording = signal(false);

  readonly showCompositeEditor = computed(() => this.form().movement === 'COMPOSITE');
  readonly compositeStep1 = signal<{ movement: string; index_state: number; middle_state: number; orientation: string }>({
    movement: 'SWIPE_RIGHT', index_state: 2, middle_state: 2, orientation: 'ANY',
  });
  readonly compositeStep2 = signal<{ movement: string; index_state: number; middle_state: number; orientation: string }>({
    movement: 'TWIST', index_state: 2, middle_state: 2, orientation: 'ANY',
  });
  readonly compositeActionKey = signal<string>('next_track');

  readonly onCompositeField = (step: 1 | 2, field: string, value: string | number): void => {
    const sig = step === 1 ? this.compositeStep1 : this.compositeStep2;
    sig.update(s => ({ ...s, [field]: value }));
  };

  readonly getMovementLabel = getMovementLabel;
  readonly getOrientationLabel = getOrientationLabel;
  readonly getFlexStateLabel = getFlexStateLabel;
  readonly getContextLabel = getContextLabel;
  readonly getActionLabel = getActionLabel;

  readonly KEY_MAP: Record<string, string> = {
    Control: 'ctrl', Alt: 'alt', Shift: 'shift', Meta: 'win',
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    ' ': 'space', Escape: 'escape', Enter: 'enter', Tab: 'tab',
    Delete: 'delete', Backspace: 'backspace',
    F1: 'f1', F2: 'f2', F3: 'f3', F4: 'f4', F5: 'f5', F6: 'f6',
    F7: 'f7', F8: 'f8', F9: 'f9', F10: 'f10', F11: 'f11', F12: 'f12',
  };

  readonly hotkeyPresets = [
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

  loadGestureConfigs(): void {
    this.gestureLoading.set(true);
    this.gestureError.set(false);
    this.gestureService.getAll().pipe(finalize(() => this.gestureLoading.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => this.gestureConfigs.set(data),
      error: () => this.gestureError.set(true),
    });
  }

  refreshConfigs(): void {
    this.loadGestureConfigs();
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
      movement: config.movement, orientation: config.orientation,
      index_state: config.index_state, middle_state: config.middle_state,
      action_key: config.action_key, action_value: config.action_value ?? '',
      context: config.context ?? 'GLOBAL',
    });
    if (config.movement === 'COMPOSITE' && config.action_value) {
      try {
        const steps = JSON.parse(config.action_value);
        if (Array.isArray(steps) && steps.length >= 2) {
          this.compositeStep1.set(steps[0]);
          this.compositeStep2.set(steps[1]);
        }
      } catch { /* not a composite config */ }
      this.compositeActionKey.set(config.action_key);
    }
    if (config.action_key === 'hotkey' && config.action_value) {
      this.recordedKeys.set(config.action_value.split(','));
    } else {
      this.recordedKeys.set([]);
    }
    this.recording.set(false);

    if (config.action_key === 'sequence' && config.action_value) {
      try {
        const parsed = JSON.parse(config.action_value);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.steps)) {
            this.macroSteps.set(parsed.steps);
            this.macroRepeat.set(parsed.repeat ?? 1);
          } else if (Array.isArray(parsed)) {
            this.macroSteps.set(parsed.map((s: { action: string; value?: string }) => ({ action: s.action, value: s.value ?? '' })));
          }
        }
      } catch {
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

    if (data.movement === 'COMPOSITE') {
      data.action_value = JSON.stringify([this.compositeStep1(), this.compositeStep2()]);
      data.action_key = this.compositeActionKey();
    } else if (data.action_key === 'sequence') {
      data.action_value = this.buildMacroJson();
    } else if (data.action_key === 'hotkey') {
      data.action_value = this.recordedKeys().join(',');
    }

    const request = this.editingId()
      ? this.gestureService.update(this.editingId()!, data)
      : this.gestureService.create(data);

    request.pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.closeDialog();
        this.loadGestureConfigs();
        this.soundService.play('sparkle');
        this.toast.success(this.editingId() ? 'Gesto actualizado' : 'Gesto creado', `${getMovementLabel(saved.movement)} → ${getActionLabel(saved.action_key)}`);
      },
      error: (err) => {
        this.toast.httpError(err, 'Error', 'No se pudo guardar la configuración del gesto');
      },
    });
  }

  deleteGesture(event: Event, id: string): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: '¿Eliminar esta configuración de gesto?',
      header: 'Confirmar',
      icon: 'bx bx-trash',
      acceptIcon: 'bx bx-check',
      rejectIcon: 'bx bx-x',
      accept: () => {
        this.gestureService.delete(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.gestureConfigs.update(prev => prev.filter(g => g.id !== id));
            this.toast.success('Eliminado', 'Gesto eliminado');
          },
          error: (err) => {
            this.toast.httpError(err, 'Error', 'No se pudo eliminar el gesto');
          },
        });
      },
    });
  }

  startRecording(): void {
    this.recording.set(true);
  }

  stopRecording(): void {
    this.recording.set(false);
  }

  onKeyDown(event: KeyboardEvent): void {
    event.preventDefault();
    const key = this.KEY_MAP[event.key] ?? event.key.toLowerCase();
    if (key === 'space') {
      this.recordedKeys.update(prev => [...prev, 'space']);
    } else {
      this.recordedKeys.update(prev => prev.includes(key) ? prev : [...prev, key]);
    }
    this.form.update(f => ({ ...f, action_value: this.recordedKeys().join(',') }));
  }

  clearRecording(): void {
    this.recordedKeys.set([]);
    this.form.update(f => ({ ...f, action_value: '' }));
  }

  applyPreset(value: string): void {
    this.recordedKeys.set(value.split(','));
    this.form.update(f => ({ ...f, action_value: value }));
  }

  addMacroStep(): void {
    this.macroSteps.update(prev => [...prev, { action: 'hotkey' }]);
  }

  removeMacroStep(index: number): void {
    this.macroSteps.update(prev => prev.filter((_, i) => i !== index));
  }

  moveMacroStepUp(index: number): void {
    if (index === 0) return;
    this.macroSteps.update(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  moveMacroStepDown(index: number): void {
    this.macroSteps.update(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  updateMacroStepAction(index: number, action: string): void {
    this.macroSteps.update(prev => prev.map((s, i) => i === index ? { ...s, action } : s));
  }

  updateMacroStepValue(index: number, value: string): void {
    this.macroSteps.update(prev => prev.map((s, i) => i === index ? { ...s, value } : s));
  }

  private parsePipeToSteps(val: string): MacroStep[] {
    return val.split('|').map(part => {
      const [action, ...rest] = part.split(':');
      return { action: action || 'hotkey', value: rest.join(':') || '' };
    });
  }

  private buildMacroJson(): string {
    return JSON.stringify({ steps: this.macroSteps(), repeat: this.macroRepeat() });
  }

  toggleRecording(): void {
    if (this.isRecording()) {
      const steps = this.macroRecordingService.stop();
      this.isRecording.set(false);
      if (steps.length > 0) {
        this.macroSteps.update(prev => [...prev, ...steps]);
      }
    } else {
      this.macroRecordingService.start();
      this.isRecording.set(true);
    }
  }

  exportConfigs(): void {
    this.exporting.set(true);
    this.gestureService.exportConfigs().pipe(finalize(() => this.exporting.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gantia-gestos.json';
        a.click();
        URL.revokeObjectURL(url);
        this.soundService.play('sparkle');
        this.toast.success('Exportado', 'Configuraciones exportadas como JSON');
      },
    });
  }

  onImportFile(event: Event): void {
    this.importing.set(true);
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) { this.importing.set(false); return; }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const configs = Array.isArray(data) ? data : [data];
        this.gestureService.importConfigs(configs).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.loadGestureConfigs();
            this.soundService.play('sparkle');
            this.toast.success('Importado', `${configs.length} configuraciones importadas`);
          },
          error: (err) => {
            this.toast.httpError(err, 'Error', 'No se pudieron importar las configuraciones');
          },
        });
      } catch {
        this.toast.error('Error', 'Archivo JSON inválido');
      } finally {
        this.importing.set(false);
      }
    };
    reader.readAsText(file);
    input.value = '';
  }
}
