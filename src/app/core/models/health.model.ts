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
