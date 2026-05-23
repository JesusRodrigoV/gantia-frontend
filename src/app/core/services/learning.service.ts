import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { env } from '../../../environments/environment';
import { inject, Injectable } from '@angular/core';

export interface LearnSession {
  active: boolean;
  samples_collected: number;
  samples_required: number;
  started_at: number;
  last_sample: Record<string, unknown> | null;
  analysis?: LearnAnalysis;
}

export interface LearnAnalysis {
  movement: string;
  orientation: string;
  index_state: number;
  middle_state: number;
  confidence: number;
  is_static: boolean;
  is_dynamic: boolean;
  sample_count: number;
  raw_samples: Record<string, unknown>[];
}

export interface LearnStartResponse {
  message: string;
  session: LearnSession;
}

export interface LearnSampleResponse {
  message: string;
  session: LearnSession & { analysis?: LearnAnalysis };
}

export interface LearnSaveResponse {
  message: string;
  config: {
    movement: string;
    orientation: string;
    index_state: number;
    middle_state: number;
    action_key: string;
    action_value: string | null;
  };
  analysis: LearnAnalysis;
  created: boolean;
}

export interface LearnCancelResponse {
  message: string;
}

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
