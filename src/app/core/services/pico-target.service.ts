import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { env } from '../../../environments/environment';
import { catchError, of, tap } from 'rxjs';

import { PicoTarget, PicoTargetResponse } from '@core/models/pico-target.model';

export type { PicoTarget, PicoTargetResponse };

@Injectable({
  providedIn: 'root',
})
export class PicoTargetService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly baseUrl = env.apiUrl;

  public readonly target = signal<PicoTarget>('auto');
  public readonly connected = signal(false);

  load(): void {
    this.http.get<PicoTargetResponse>(`${this.baseUrl}/pico/target`)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap({ error: (err) => console.error('Failed to load pico target', err) }),
        catchError(() => of(null)),
      )
      .subscribe((res) => {
        if (res) {
          this.target.set(res.target);
          this.connected.set(res.connected.usb);
        }
      });
  }

  setTarget(target: PicoTarget): void {
    this.http.post<PicoTargetResponse>(`${this.baseUrl}/pico/target`, { target })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap({ error: (err) => console.error('Failed to set pico target', err) }),
        catchError(() => of(null)),
      )
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
