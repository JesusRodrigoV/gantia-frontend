import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { env } from '../../../environments/environment';
import { inject, Injectable } from '@angular/core';

export interface ActionHistoryEntry {
  action: string;
  value: unknown;
  target: string;
  result: string;
  timestamp: number;
}

export interface ActionHistoryResponse {
  data: ActionHistoryEntry[];
  total: number;
}

@Injectable({
  providedIn: 'root',
})
export class ActionsHistoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${env.apiUrl}`;

  getHistory(limit = 50): Observable<ActionHistoryResponse> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<ActionHistoryResponse>(`${this.baseUrl}/actions/history`, { params });
  }
}
