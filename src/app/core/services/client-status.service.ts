import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { env } from '../../../environments/environment';
import { interval, startWith, switchMap, catchError, of } from 'rxjs';

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

  public readonly status = signal<ClientStatus>({
    glove: false,
    agent: false,
    pico_w: false,
    dashboard_count: 0,
  });

  constructor() {
    interval(5000)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.http.get<ClientStatus>(`${this.baseUrl}/clients`).pipe(
            catchError(() => of({ glove: false, agent: false, pico_w: false, dashboard_count: 0 })),
          ),
        ),
      )
      .subscribe((data) => this.status.set(data));
  }
}
