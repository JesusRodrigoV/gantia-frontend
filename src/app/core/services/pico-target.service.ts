import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { env } from '../../../environments/environment';
import { catchError, of } from 'rxjs';

export type PicoTarget = 'pc' | 'auto';

export interface PicoTargetResponse {
  target: PicoTarget;
  connected: { usb: boolean };
}

@Injectable({
  providedIn: 'root',
})
export class PicoTargetService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = env.apiUrl;

  public readonly target = signal<PicoTarget>('auto');
  public readonly connected = signal(false);

  load(): void {
    this.http.get<PicoTargetResponse>(`${this.baseUrl}/pico/target`)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (res) {
          this.target.set(res.target);
          this.connected.set(res.connected.usb);
        }
      });
  }

  setTarget(target: PicoTarget): void {
    this.http.post<PicoTargetResponse>(`${this.baseUrl}/pico/target`, { target })
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (res) {
          this.target.set(res.target);
          this.connected.set(res.connected.usb);
        }
      });
  }

  targetLabel(): string {
    const map: Partial<Record<PicoTarget, string>> = {
      pc: 'PC (USB)',
      auto: 'Automatico',
    };
    return map[this.target()] ?? 'PC (USB)';
  }
}
