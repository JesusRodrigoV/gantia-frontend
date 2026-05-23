import { NgOptimizedImage } from '@angular/common';
import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService } from 'primeng/api';
import { LetrasGantia } from '@components/letras-gantia/letras-gantia';
import { ThemeHandler } from '@core/services/theme-handler';
import { SensorSocket } from '@core/services/sensor-socket';
import { ClientStatusService } from '@core/services/client-status.service';
import { PicoTargetService } from '@core/services/pico-target.service';
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
  protected clientStatus = inject(ClientStatusService);
  protected picoTarget = inject(PicoTargetService);
  protected authStore = inject(AuthStore);
  protected scrolled = signal(false);
  protected mouseModeActive = computed(() => this.sensorSocket.mouseModeActive());
  protected picoTargetLabel = computed(() => this.picoTarget.targetLabel());
  private confirmationService = inject(ConfirmationService);

  links=[
    {label: "Dashboard", route: "dashboard"},
    {label: "Visualizador", route: "visualizador"},
    {label: "Historial", route: "history"},
    {label: "Ajustes", route: "settings"},
    {label: "Config", route: "config"},
  ]

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 20);
  }

  confirmLogout(event: Event): void {
    if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return;
    this.confirmationService.confirm({
      target: event.currentTarget as EventTarget,
      message: '¿Estas seguro de que queres cerrar sesion?',
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
    const conn = this.sensorSocket.connectionStatus();
    const flowing = this.sensorSocket.dataFlowing();
    const waiting = this.sensorSocket.waitingForDevice();
    const map: Record<string, string> = {
      connected: flowing
        ? 'Guante conectado — recibiendo datos'
        : waiting
          ? 'Conectado al servidor — esperando guante'
          : 'Conectado — sin datos',
      connecting: 'Conectando al servidor...',
      disconnected: 'Sin conexion',
      error: 'Error de conexion',
    };
    return map[conn] ?? 'Desconectado';
  }

  clientTooltip(): string {
    const s = this.clientStatus.status();
    const targetLabel = this.picoTargetLabel();
    const parts: string[] = [];
    if (s.glove) parts.push('Guante: conectado');
    if (s.agent) parts.push('Agente: activo');
    if (s.pico_w) parts.push(`Pico W: conectado → ${targetLabel}`);
    if (!s.glove && !s.agent && !s.pico_w) parts.push('Sin dispositivos conectados');
    return parts.join('\n');
  }
}
