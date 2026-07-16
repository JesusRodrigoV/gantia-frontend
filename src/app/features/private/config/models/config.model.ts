export interface AbsCalibrationData {
  corners?: Record<string, { pitch: number; roll: number } | null>;
  screen_width?: number;
  screen_height?: number;
  status?: 'draft' | 'complete';
}
