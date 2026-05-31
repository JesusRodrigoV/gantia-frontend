import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { env } from '../../../environments/environment';
import { interval, startWith, switchMap, catchError, of, NEVER, fromEvent, map } from 'rxjs';
import { DOCUMENT } from '@angular/common';

export interface ClientStatus {
  glove: boolean;
  agent: boolean;
  pico_w: boolean;
  dashboard_count: number;
}

@Injectable({
  providedIn: 'root',
})
export class ClientStatusService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = env.apiUrl;

  public readonly isLoading = signal(true);
  public readonly error = signal<string | null>(null);
  public readonly status = signal<ClientStatus>({
    glove: false,
    agent: false,
    pico_w: false,
    dashboard_count: 0,
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    const document = inject(DOCUMENT);
    let isFirst = true;

    fromEvent(document, 'visibilitychange').pipe(
      map(() => !document.hidden),
      startWith(true),
      switchMap((isVisible) =>
        isVisible
          ? interval(5000).pipe(
              startWith(0),
              switchMap(() =>
                this.http.get<ClientStatus>(`${this.baseUrl}/clients`).pipe(
                  catchError((err) => {
                    if (isFirst) {
                      isFirst = false;
                      this.isLoading.set(false);
                    }
                    this.error.set(err.statusText || 'Error al verificar estado');
                    return of(null as unknown as ClientStatus);
                  }),
                ),
              ),
            )
          : NEVER,
      ),
      takeUntilDestroyed(destroyRef),
    ).subscribe((data) => {
      if (isFirst) {
        isFirst = false;
        this.isLoading.set(false);
      }
      if (data) {
        this.error.set(null);
        this.status.set(data);
      }
    });
  }
}
