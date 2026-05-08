import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from '@components/header';
import { SensorSocket } from '@core/services/sensor-socket';

@Component({
  selector: 'app-base-layout',
  imports: [Header,  RouterOutlet],
  templateUrl: './base-layout.html',
  styleUrl: './base-layout.scss',
})
export default class BaseLayout implements OnInit, OnDestroy {
  private readonly sensorSocket = inject(SensorSocket);

  ngOnInit(): void {
    this.sensorSocket.connect();
  }

  ngOnDestroy(): void {
    this.sensorSocket.disconnect();
  }
}
