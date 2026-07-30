import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { Skeleton } from 'primeng/skeleton';
import { GestureConfig, getMovementLabel, getOrientationLabel, getFlexStateLabel, getContextLabel } from '@core/models/gesture-config.model';
import { getActionLabel } from '@core/models/glove-telemetry.model';
import { RoundedButton } from '@shared/components/ui/rounded-button';

@Component({
  selector: 'app-gesture-list',
  imports: [Skeleton, RoundedButton],
  templateUrl: './gesture-list.html',
  styleUrls: ['./gesture-list.scss', '../shared.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GestureList {
  readonly configs = input.required<GestureConfig[]>();
  readonly filtered = input.required<GestureConfig[]>();
  readonly loading = input.required<boolean>();
  readonly error = input.required<boolean>();
  readonly activeTab = input.required<string>();
  readonly contexts = input.required<readonly string[]>();

  readonly create = output();
  readonly edit = output<GestureConfig>();
  readonly delete = output<{ event: Event; id: string }>();
  readonly refresh = output();
  readonly learn = output();
  readonly tabChange = output<string>();

  protected readonly getMovementLabel = getMovementLabel;
  protected readonly getOrientationLabel = getOrientationLabel;
  protected readonly getFlexStateLabel = getFlexStateLabel;
  protected readonly getContextLabel = getContextLabel;
  protected readonly getActionLabel = getActionLabel;

  protected onDelete(event: Event, id: string): void {
    this.delete.emit({ event, id });
  }
}
