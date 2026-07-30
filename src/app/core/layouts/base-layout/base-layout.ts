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
import { Toast } from 'primeng/toast';
import { ConfirmPopup } from 'primeng/confirmpopup';
import { Header } from '@components/header';
import { SensorSocket } from '@core/services/sensor-socket';
import { SoundService } from '@core/services/sound.service';
import { ToastService } from '@core/services/toast.service';

@Component({
  selector: 'app-base-layout',
  imports: [Header, Toast, ConfirmPopup, RouterOutlet],
  templateUrl: './base-layout.html',
  styleUrl: './base-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class BaseLayout implements OnInit, OnDestroy {
  private readonly sensorSocket = inject(SensorSocket);
  private readonly toast = inject(ToastService);
  private readonly soundService = inject(SoundService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected routeLoading = signal(false);
  private lastStatus = '';
  private disconnectDebounce: ReturnType<typeof setTimeout> | null = null;

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

      if (this.disconnectDebounce !== null) {
        clearTimeout(this.disconnectDebounce);
        this.disconnectDebounce = null;
      }

      switch (status) {
        case 'connected':
          this.soundService.play('bloom');
          this.toast.success('Conectado', 'Conexión establecida con el servidor');
          break;
        case 'disconnected':
          this.disconnectDebounce = setTimeout(() => {
            this.toast.warn('Desconectado', 'Sin conexión al servidor');
          }, 3000);
          break;
        case 'reconnecting':
          break;
        case 'error':
          this.toast.error('Error', 'No se pudo conectar al servidor');
          break;
      }
    });
  }

  ngOnInit(): void {
    this.sensorSocket.connect();
  }

  ngOnDestroy(): void {
    if (this.disconnectDebounce !== null) {
      clearTimeout(this.disconnectDebounce);
      this.disconnectDebounce = null;
    }
    this.sensorSocket.disconnect();
  }
}
