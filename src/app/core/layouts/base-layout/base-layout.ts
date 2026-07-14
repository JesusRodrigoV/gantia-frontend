import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import {
  RouterOutlet,
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { ConfirmPopup } from 'primeng/confirmpopup';
import { Header } from '@components/header';
import { SensorSocket } from '@core/services/sensor-socket';
import { SoundService } from '@core/services/sound.service';

@Component({
  selector: 'app-base-layout',
  imports: [Header, Toast, ConfirmPopup, RouterOutlet],
  templateUrl: './base-layout.html',
  styleUrl: './base-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class BaseLayout implements OnInit, OnDestroy {
  private readonly sensorSocket = inject(SensorSocket);
  private readonly messageService = inject(MessageService);
  private readonly soundService = inject(SoundService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected routeLoading = signal(false);
  private lastStatus = '';

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationStart) this.routeLoading.set(true);
      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.routeLoading.set(false);
      }
    });

    effect(() => {
      const status = this.sensorSocket.connectionStatus();
      if (status === this.lastStatus) return;
      this.lastStatus = status;

      switch (status) {
        case 'connected':
          this.soundService.play('bloom');
          this.messageService.add({
            severity: 'success',
            summary: 'Conectado',
            detail: 'Conexión establecida con el servidor',
            life: 3000,
          });
          break;
        case 'disconnected':
          this.messageService.add({
            severity: 'warn',
            summary: 'Desconectado',
            detail: 'Sin conexión al servidor',
            life: 4000,
          });
          break;
        case 'reconnecting':
          this.messageService.add({
            severity: 'warn',
            summary: 'Reconectando',
            detail: `Intento ${this.sensorSocket.retryCount()}/${this.sensorSocket.maxRetries()}...`,
            life: 3000,
          });
          break;
        case 'error':
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo conectar al servidor',
            life: 5000,
          });
          break;
      }
    });
  }

  ngOnInit(): void {
    this.sensorSocket.connect();
  }

  ngOnDestroy(): void {
    this.sensorSocket.disconnect();
  }
}
