import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { env } from '../../../environments/environment';
import { inject, Injectable } from '@angular/core';
import { CalibrationEntry } from '@core/models/calibration.model';

@Injectable({
  providedIn: 'root',
})
export class CalibrationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${env.apiUrl}`;

  getAll(): Observable<CalibrationEntry[]> {
    return this.http.get<CalibrationEntry[]>(`${this.baseUrl}/calibration`);
  }

  update(sensorName: string, data: Partial<CalibrationEntry>): Observable<CalibrationEntry> {
    return this.http.put<CalibrationEntry>(`${this.baseUrl}/calibration/${sensorName}`, data);
  }
}
