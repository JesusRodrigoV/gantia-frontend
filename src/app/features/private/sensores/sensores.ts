import { Component } from '@angular/core';
import { AcelerometerChart } from '@components/acelerometer-chart/acelerometer-chart';
import { GyroscopeChart } from '@components/gyroscope-chart';

@Component({
  selector: 'app-sensores',
  imports: [GyroscopeChart, AcelerometerChart],
  templateUrl: './sensores.html',
  styleUrl: './sensores.scss',
})
export default class Sensores {}
