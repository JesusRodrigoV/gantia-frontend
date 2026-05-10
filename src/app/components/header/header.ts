import { NgOptimizedImage } from '@angular/common';
import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService } from 'primeng/api';
import { LetrasGantia } from '@components/letras-gantia/letras-gantia';
import { ThemeHandler } from '@core/services/theme-handler';
import { SensorSocket } from '@core/services/sensor-socket';
import { AuthStore } from '@core/stores/auth.store';
import { RoundedButton } from '@shared/components/ui/rounded-button';

@Component({
  selector: 'app-header',
  imports: [NgOptimizedImage, LetrasGantia, RouterLink, RouterLinkActive, RoundedButton, TooltipModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  themeService = inject(ThemeHandler);
  protected sensorSocket = inject(SensorSocket);
  protected authStore = inject(AuthStore);
  protected scrolled = signal(false);
  private confirmationService = inject(ConfirmationService);

  links=[
    {label: "Dashboard", route: "dashboard"},
    {label: "Sensores", route: "sensores"},
  ]

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 20);
  }

  confirmLogout(event: Event): void {
    if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return;
    this.confirmationService.confirm({
      target: event.currentTarget as EventTarget,
      message: '¿Estás seguro de que querés cerrar sesión?',
      icon: 'bx bx-log-out',
      rejectButtonProps: {
        label: 'Cancelar',
        severity: 'secondary',
        outlined: true,
      },
      acceptButtonProps: {
        label: 'Salir',
        severity: 'danger',
      },
      accept: () => this.authStore.logout(),
    });
  }

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
