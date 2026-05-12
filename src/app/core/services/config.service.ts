import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { env } from '../../../environments/environment';
import { inject, Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${env.apiUrl}`;

  refreshFromSupabase(): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.baseUrl}/refresh-configs`, {});
  }
}
