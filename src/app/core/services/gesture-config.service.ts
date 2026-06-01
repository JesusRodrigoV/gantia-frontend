import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { env } from '../../../environments/environment';
import { inject, Injectable } from '@angular/core';
import { GestureConfig, GestureConfigForm } from '@core/models/gesture-config.model';

@Injectable({
  providedIn: 'root',
})
export class GestureConfigService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${env.apiUrl}`;

  getAll(): Observable<GestureConfig[]> {
    return this.http.get<GestureConfig[]>(`${this.baseUrl}/gesture-configs`);
  }

  create(data: GestureConfigForm): Observable<GestureConfig> {
    return this.http.post<GestureConfig>(`${this.baseUrl}/gesture-configs`, data);
  }

  update(id: string, data: Partial<GestureConfig>): Observable<GestureConfig> {
    return this.http.put<GestureConfig>(`${this.baseUrl}/gesture-configs/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/gesture-configs/${id}`);
  }

  exportConfigs(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/gesture-configs/export`, { responseType: 'blob' });
  }

  importConfigs(data: GestureConfigForm[]): Observable<{ imported: number; skipped: number }> {
    return this.http.post<{ imported: number; skipped: number }>(`${this.baseUrl}/gesture-configs/import`, data);
  }
}
