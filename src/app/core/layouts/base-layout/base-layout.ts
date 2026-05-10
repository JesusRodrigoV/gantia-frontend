import { Component, effect, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { ConfirmPopup } from 'primeng/confirmpopup';
import { Header } from '@components/header';
import { SensorSocket } from '@core/services/sensor-socket';

@Component({
  selector: 'app-base-layout',
  imports: [Header, Toast, ConfirmPopup, RouterOutlet],
  templateUrl: './base-layout.html',
  styleUrl: './base-layout.scss',
})
export default class BaseLayout implements OnInit, OnDestroy {
  private readonly sensorSocket = inject(SensorSocket);
  private readonly messageService = inject(MessageService);
  private lastStatus = '';

  constructor() {
    effect(() => {
      const status = this.sensorSocket.connectionStatus();
      if (status === this.lastStatus) return;
      this.lastStatus = status;

      switch (status) {
        case 'connected':
          this.messageService.add({ severity: 'success', summary: 'Conectado', detail: 'Conexión establecida con el servidor', life: 3000 });
          break;
        case 'disconnected':
          this.messageService.add({ severity: 'warn', summary: 'Desconectado', detail: 'Reconectando en 5 segundos...', life: 4000 });
          break;
        case 'error':
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo conectar al servidor', life: 5000 });
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
