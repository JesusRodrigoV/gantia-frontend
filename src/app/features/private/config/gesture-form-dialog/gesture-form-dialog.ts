import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  GestureConfigForm, MacroStep, getMovementLabel, getOrientationLabel,
  getFlexStateLabel, getContextLabel,
  CONTEXTS, MOVEMENTS, ORIENTATIONS, FLEX_STATES, ACTIONS
} from '@core/models/gesture-config.model';
import { getActionLabel } from '@core/models/glove-telemetry.model';

@Component({
  selector: 'app-gesture-form-dialog',
  imports: [FormsModule],
  templateUrl: './gesture-form-dialog.html',
  styleUrl: './gesture-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GestureFormDialog {
  readonly open = input.required<boolean>();
  readonly editingId = input<string | null>(null);
  readonly form = input.required<GestureConfigForm>();
  readonly saving = input.required<boolean>();
  readonly recordedKeys = input.required<string[]>();
  readonly recording = input.required<boolean>();
  readonly macroSteps = input.required<MacroStep[]>();
  readonly macroRepeat = input.required<number>();
  readonly isRecording = input.required<boolean>();
  readonly compositeStep1 = input.required<{ movement: string; index_state: number; middle_state: number; orientation: string }>();
  readonly compositeStep2 = input.required<{ movement: string; index_state: number; middle_state: number; orientation: string }>();
  readonly compositeActionKey = input.required<string>();
  readonly showCompositeEditor = input.required<boolean>();
  readonly showKeyRecorder = input.required<boolean>();
  readonly showSequenceEditor = input.required<boolean>();

  readonly save = output();
  readonly close = output();
  readonly formField = output<{ field: keyof GestureConfigForm; value: string | number | undefined }>();
  readonly compositeField = output<{ step: 1 | 2; field: string; value: string | number }>();
  readonly compositeActionKeyChange = output<string>();
  readonly recordingToggle = output();
  readonly macroStepAction = output<{ index: number; action: string }>();
  readonly macroStepValue = output<{ index: number; value: string }>();
  readonly macroStepMoveUp = output<number>();
  readonly macroStepMoveDown = output<number>();
  readonly macroStepRemove = output<number>();
  readonly macroStepAdd = output();
  readonly keyRecordStart = output();
  readonly keyRecordStop = output();
  readonly keyRecordKeydown = output<KeyboardEvent>();
  readonly keyRecordClear = output();
  readonly keyPresetApply = output<string>();
  readonly macroRepeatChange = output<number>();

  protected readonly movements = MOVEMENTS;
  protected readonly orientations = ORIENTATIONS;
  protected readonly flexStates = FLEX_STATES;
  protected readonly actions = ACTIONS;
  protected readonly contexts = CONTEXTS;
  protected readonly getMovementLabel = getMovementLabel;
  protected readonly getOrientationLabel = getOrientationLabel;
  protected readonly getFlexStateLabel = getFlexStateLabel;
  protected readonly getContextLabel = getContextLabel;
  protected readonly getActionLabel = getActionLabel;
  protected readonly hotkeyPresets = [
    { label: 'Ctrl+C', value: 'ctrl,c' }, { label: 'Ctrl+V', value: 'ctrl,v' }, { label: 'Ctrl+X', value: 'ctrl,x' },
    { label: 'Ctrl+Z', value: 'ctrl,z' }, { label: 'Win+D', value: 'win,d' }, { label: 'Alt+Tab', value: 'alt,tab' },
    { label: 'Win+E', value: 'win,e' }, { label: 'Ctrl+Shift+Esc', value: 'ctrl,shift,esc' }, { label: 'F5', value: 'f5' },
    { label: 'F11', value: 'f11' }, { label: 'Win+R', value: 'win,r' }, { label: 'Ctrl+Alt+Del', value: 'ctrl,alt,delete' },
  ];
}
