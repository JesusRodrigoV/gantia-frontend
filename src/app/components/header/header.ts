import { NgOptimizedImage } from '@angular/common';
import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService } from 'primeng/api';
import { LetrasGantia } from '@components/letras-gantia/letras-gantia';
import { ThemeHandler } from '@core/services/theme-handler';
import { SensorSocket } from '@core/services/sensor-socket';
import { ClientStatusService } from '@core/services/client-status.service';
import { PicoTargetService } from '@core/services/pico-target.service';
import { AuthStore } from '@core/stores/auth.store';
import { RoundedButton } from '@shared/components/ui/rounded-button';
import { getContextLabel, CONTEXTS } from '@core/models/gesture-config.model';
import { env } from '../../../environments/environment';

@Component({
  selector: 'app-header',
  imports: [NgOptimizedImage, LetrasGantia, RouterLink, RouterLinkActive, RoundedButton, TooltipModule, FormsModule, SelectModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private http = inject(HttpClient);
  themeService = inject(ThemeHandler);
  protected sensorSocket = inject(SensorSocket);
  protected clientStatus = inject(ClientStatusService);
  protected picoTarget = inject(PicoTargetService);
  protected authStore = inject(AuthStore);
  protected scrolled = signal(false);
  protected mouseModeActive = computed(() => this.sensorSocket.mouseModeActive());
  protected readonly getContextLabel = getContextLabel;
  protected picoTargetLabel = computed(() => this.picoTarget.targetLabel());
  private confirmationService = inject(ConfirmationService);
  protected readonly modeOptions = [...CONTEXTS];

  changeMode(mode: string): void {
    this.sensorSocket.currentMode.set(mode);
    this.http.post(`${env.apiUrl}/mode`, { mode }).subscribe();
  }

  links=[
    {label: "Dashboard", route: "dashboard"},
    {label: "Visualizador", route: "visualizador"},
    {label: "Historial", route: "history"},
    {label: "Ajustes", route: "settings"},
    {label: "Gestos", route: "config"},
  ]

  private scrollRaf: number | null = null;

  @HostListener('window:scroll')
  onScroll(): void {
    if (this.scrollRaf !== null) return;
    this.scrollRaf = requestAnimationFrame(() => {
      this.scrolled.set(window.scrollY > 20);
      this.scrollRaf = null;
    });
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
    if (this.clientStatus.isLoading()) return 'Verificando estado...';
    const s = this.clientStatus.status();
    const targetLabel = this.picoTargetLabel();
    const parts: string[] = [];
    if (s.glove) parts.push('Guante: conectado');
    if (s.pico_w) parts.push(`Pico W: conectado → ${targetLabel}`);
    if (!s.glove && !s.pico_w) parts.push('Sin dispositivos conectados');
    return parts.join('\n');
  }
}
