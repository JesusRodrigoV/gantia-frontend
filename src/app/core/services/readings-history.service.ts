import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { env } from '../../../environments/environment';
import { inject, Injectable } from '@angular/core';
import { HistoryResponse } from '@core/models/reading-history.model';

@Injectable({
  providedIn: 'root',
})
export class ReadingsHistoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${env.apiUrl}`;

  getHistory(since: string, until?: string, limit = 200): Observable<HistoryResponse> {
    let params = new HttpParams().set('since', since).set('limit', limit);
    if (until) params = params.set('until', until);
    return this.http.get<HistoryResponse>(`${this.baseUrl}/readings/history`, { params });
  }
}
