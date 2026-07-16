import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { env } from '../../../environments/environment';
import { inject, Injectable } from '@angular/core';
import {
  LearnSession,
  LearnAnalysis,
  LearnStartResponse,
  LearnSampleResponse,
  LearnSaveResponse,
  LearnCancelResponse,
} from '@core/models/learning.model';

export type {
  LearnSession,
  LearnAnalysis,
  LearnStartResponse,
  LearnSampleResponse,
  LearnSaveResponse,
  LearnCancelResponse,
};

@Injectable({
  providedIn: 'root',
})
export class LearningService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${env.apiUrl}`;

  start(): Observable<LearnStartResponse> {
    return this.http.post<LearnStartResponse>(`${this.baseUrl}/learn/start`, {});
  }

  sample(): Observable<LearnSampleResponse> {
    return this.http.post<LearnSampleResponse>(`${this.baseUrl}/learn/sample`, {});
  }

  save(actionKey: string): Observable<LearnSaveResponse> {
    return this.http.post<LearnSaveResponse>(`${this.baseUrl}/learn/save`, { action_key: actionKey });
  }

  getSession(): Observable<LearnSession> {
    return this.http.get<LearnSession>(`${this.baseUrl}/learn/session`);
  }

  cancel(): Observable<LearnCancelResponse> {
    return this.http.delete<LearnCancelResponse>(`${this.baseUrl}/learn/cancel`);
  }
}
