import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { env } from '../../../environments/environment';
import { inject, Injectable } from '@angular/core';
import { SensitivitySettings } from '@core/models/sensitivity.model';

@Injectable({
  providedIn: 'root',
})
export class SensitivityService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${env.apiUrl}`;

  getSettings(): Observable<SensitivitySettings> {
    return this.http.get<SensitivitySettings>(`${this.baseUrl}/sensitivity`);
  }

  updateSettings(settings: Partial<SensitivitySettings>): Observable<SensitivitySettings> {
    return this.http.put<SensitivitySettings>(`${this.baseUrl}/sensitivity`, settings);
  }
}
