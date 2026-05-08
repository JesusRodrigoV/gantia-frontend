import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-rounded-button',
  imports: [ButtonModule],
  templateUrl: './rounded-button.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoundedButton {
  rounded = input<boolean>(true);
  label = input(undefined);
  variant = input<"text" | "outlined">("text");
  icon=input<string | undefined>(undefined);
}
