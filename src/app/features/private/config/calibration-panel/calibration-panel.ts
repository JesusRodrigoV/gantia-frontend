import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Skeleton } from 'primeng/skeleton';
import { CalibrationEntry } from '@core/models/calibration.model';

@Component({
  selector: 'app-calibration-panel',
  imports: [FormsModule, Skeleton],
  templateUrl: './calibration-panel.html',
  styleUrls: ['./calibration-panel.scss', '../shared.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalibrationPanel {
  readonly calibration = input.required<CalibrationEntry[]>();
  readonly calibrationLoading = input.required<boolean>();
  readonly calibrationError = input.required<boolean>();
  readonly calibWizardOpen = input.required<boolean>();
  readonly calibStep = input.required<1 | 2 | 3>();
  readonly calibSensor = input.required<'index_finger' | 'middle_finger'>();
  readonly calibMinValue = input.required<number | null>();
  readonly calibMaxValue = input.required<number | null>();
  readonly calibLiveValue = input.required<number>();
  readonly calibSaving = input.required<boolean>();

  readonly refresh = output();
  readonly openWizard = output<string>();
  readonly closeWizard = output();
  readonly captureMin = output();
  readonly captureMax = output();
  readonly save = output();
  readonly redoFromStep = output<1>();
}
