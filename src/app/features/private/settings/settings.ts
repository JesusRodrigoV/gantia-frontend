import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { Skeleton } from 'primeng/skeleton';
import { MouseConfigService } from '@core/services/mouse-config.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, ToggleSwitchModule, Toast, Skeleton],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  providers: [MessageService],
})
export default class Settings implements OnInit {
  private readonly mouseConfigService = inject(MouseConfigService);
  private readonly messageService = inject(MessageService);

  protected loading = signal(true);
  protected invertRoll = false;
  protected invertPitch = false;

  ngOnInit(): void {
    this.mouseConfigService.getConfig().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (config) => {
        this.invertRoll = config.invert_roll;
        this.invertPitch = config.invert_pitch;
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar la configuración del mouse',
          life: 4000,
        });
      },
    });
  }

  onRollChange(): void {
    this.mouseConfigService.updateConfig({ invert_roll: this.invertRoll }).subscribe({
      next: (config) => {
        this.invertRoll = config.invert_roll;
        this.messageService.add({
          severity: 'success',
          summary: 'Guardado',
          detail: `Balanceo invertido: ${config.invert_roll ? 'SÍ' : 'NO'}`,
          life: 2000,
        });
      },
      error: () => {
        this.invertRoll = !this.invertRoll;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo guardar la configuración',
          life: 4000,
        });
      },
    });
  }

  onPitchChange(): void {
    this.mouseConfigService.updateConfig({ invert_pitch: this.invertPitch }).subscribe({
      next: (config) => {
        this.invertPitch = config.invert_pitch;
        this.messageService.add({
          severity: 'success',
          summary: 'Guardado',
          detail: `Inclinación invertida: ${config.invert_pitch ? 'SÍ' : 'NO'}`,
          life: 2000,
        });
      },
      error: () => {
        this.invertPitch = !this.invertPitch;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo guardar la configuración',
          life: 4000,
        });
      },
    });
  }
}
