import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { env } from '../../../environments/environment';
import { inject, Injectable } from '@angular/core';
import { MouseConfig } from '@core/models/mouse-config.model';

@Injectable({
  providedIn: 'root',
})
export class MouseConfigService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${env.apiUrl}`;

  getConfig(): Observable<MouseConfig> {
    return this.http.get<MouseConfig>(`${this.baseUrl}/mouse-config`);
  }

  updateConfig(config: Partial<MouseConfig>): Observable<MouseConfig> {
    return this.http.post<MouseConfig>(`${this.baseUrl}/mouse-config`, config);
  }
}
