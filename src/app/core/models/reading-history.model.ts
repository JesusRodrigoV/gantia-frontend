export interface HistoryReading {
  id: string;
  created_at: string;
  accel_x: number;
  accel_y: number;
  accel_z: number;
  gyro_x: number;
  gyro_y: number;
  gyro_z: number;
  flex_index: number;
  flex_middle: number;
  is_active: number;
}

export interface HistoryResponse {
  data: HistoryReading[];
  total: number;
}
