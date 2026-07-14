import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { env } from '../../../environments/environment';

export interface HealthSnapshot {
  created_at: string;
  rssi: number;
  temp_mpu: number;
  uptime_ms: number;
}

export interface HealthData {
  rssi: number;
  temp_mpu: number;
  uptime_ms: number;
  uptime_formatted: string;
  rssi_bars: number;
  temp_formatted: string;
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  getHistory(limit = 500): Observable<HealthSnapshot[]> {
    return this.http
      .get<{ data: HealthSnapshot[] }>(`${env.apiUrl}/readings/health/history?limit=${limit}`)
      .pipe(map((r) => r.data));
  }

  getLatest(): Observable<HealthData | null> {
    return this.http
      .get<{ data: HealthSnapshot | null }>(`${env.apiUrl}/readings/health/latest`)
      .pipe(
        map((r) => (r.data ? this._format(r.data) : null)),
      );
  }

  private _format(s: HealthSnapshot): HealthData {
    const totalSec = Math.floor(s.uptime_ms / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const min = Math.floor((totalSec % 3600) / 60);
    const sec = totalSec % 60;
    const uptimeStr = hrs > 0 ? `${hrs}h ${min}m` : min > 0 ? `${min}m ${sec}s` : `${sec}s`;

    // RSSI to "bars" (1-5)
    const bars =
      s.rssi >= -50 ? 5 : s.rssi >= -60 ? 4 : s.rssi >= -70 ? 3 : s.rssi >= -80 ? 2 : 1;

    return {
      rssi: s.rssi,
      temp_mpu: s.temp_mpu,
      uptime_ms: s.uptime_ms,
      uptime_formatted: uptimeStr,
      rssi_bars: bars,
      temp_formatted: `${s.temp_mpu.toFixed(1)}°C`,
    };
  }
}
