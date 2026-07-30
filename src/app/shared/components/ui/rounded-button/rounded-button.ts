import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-rounded-button',
  imports: [ButtonModule],
  templateUrl: './rounded-button.html',
  styleUrl: './rounded-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoundedButton {
  rounded = input<boolean>(true);
  label = input<string | undefined>(undefined);
  icon = input<string | undefined>(undefined);
  variant = input<string>('');
  severity = input<string | undefined>(undefined);
  disabled = input<boolean>(false);
  loading = input<boolean>(false);
  type = input<string>('button');
  size = input<string | undefined>(undefined);
  styleClass = input<string>('');
}
