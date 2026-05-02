import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { env } from '../../../environments/environment';
import { inject, Injectable } from '@angular/core';
import { AuthRequest } from '@core/models/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${env.apiUrl}/auth`;

  register(credentials: AuthRequest): Observable<string> {
    return this.http.post<string>(`${this.baseUrl}/register`, credentials);
  }

  login(credentials: AuthRequest): Observable<string> {
    return this.http.post<string>(`${this.baseUrl}/login`, credentials);
  }

  refreshConfigs(): Observable<string> {
    return this.http.post<string>(`${env.apiUrl}/refresh-configs`, {});
  }
}