import { NgOptimizedImage } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LetrasGantia } from '@components/letras-gantia/letras-gantia';
import { ThemeHandler } from '@core/services/theme-handler';
import { SensorSocket } from '@core/services/sensor-socket';
import { AuthStore } from '@core/stores/auth.store';
import { RoundedButton } from '@shared/components/ui/rounded-button';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-header',
  imports: [NgOptimizedImage, LetrasGantia, RouterLink, RoundedButton, TooltipModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  themeService = inject(ThemeHandler);
  protected sensorSocket = inject(SensorSocket);
  protected authStore = inject(AuthStore);
  links=[
    {label: "Dashboard", route: "dashboard"},
    {label: "Sensores", route: "sensores"},
    // {label: "Dispositivos", route: "dispositivos"},
  ]

  statusLabel(): string {
    const map: Record<string, string> = {
      connected: 'Conectado',
      connecting: 'Conectando',
      disconnected: 'Desconectado',
      error: 'Error',
    };
    return map[this.sensorSocket.connectionStatus()] ?? 'Desconectado';
  }
}
