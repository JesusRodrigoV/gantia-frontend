import { Injectable } from '@angular/core';
import { Observable, Subscriber } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TelemetrySimulation {
  public stream(): Observable<[number, number, number, number]> {
    return new Observable((subscriber: Subscriber<[number, number, number, number]>) => {
      const startTime = Date.now();

      const intervalId = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;

        const now = Date.now() / 1000;

        const accX = Math.sin(elapsed * 2) * 9.8 + (Math.random() - 0.5);
        const accY = Math.cos(elapsed * 3) * 9.8 + (Math.random() - 0.5);
        const accZ = Math.sin(elapsed * 1.5) * 9.8 + 9.8 + (Math.random() - 0.5);

        subscriber.next([now, accX, accY, accZ]);
      }, 20);

      return () => clearInterval(intervalId);
    });
  }
}
