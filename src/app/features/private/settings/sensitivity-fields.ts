import { SensitivitySettings } from '@core/models/sensitivity.model';
import { PicoTarget } from '@core/models/pico-target.model';

export interface SensField {
  key: keyof SensitivitySettings;
  label: string;
  desc: string;
  min: number;
  max: number;
  step: number;
}

export interface SensGroup {
  label: string;
  keys: (keyof SensitivitySettings)[];
}

export interface TargetOption {
  label: string;
  value: PicoTarget;
  desc: string;
}

export const SENS_FIELDS: SensField[] = [
  { key: 'swipe_threshold', label: 'Sensibilidad Swipe', desc: 'Qué tan fuerte debe ser el movimiento de la muñeca para detectar un swipe. Valores más bajos = más sensible', min: 50, max: 500, step: 10 },
  { key: 'swipe_dominance', label: 'Dirección Swipe', desc: 'Qué tan marcado debe ser el movimiento en un solo eje. 0.5 = balanceado, 1 = muy estricto', min: 0, max: 1, step: 0.05 },
  { key: 'swipe_cooldown', label: 'Pausa Swipe', desc: 'Tiempo de espera obligatorio entre swipe y swipe para evitar repeticiones accidentales', min: 0.1, max: 5, step: 0.1 },
  { key: 'posture_hold_time', label: 'Tiempo Postura', desc: 'Cuántos segundos hay que mantener una postura quieta (puño, pinza) para activar su acción asociada', min: 0.5, max: 5, step: 0.1 },
  { key: 'mouse_speed', label: 'Velocidad Mouse', desc: 'Velocidad del cursor cuando el guante está en modo mouse. Ajustar según preferencia personal', min: 10, max: 500, step: 10 },
  { key: 'mouse_dead_zone', label: 'Zona Muerta Mouse', desc: 'Cuánto movimiento de la mano se ignora antes de que el cursor reaccione. Útil para evitar temblores', min: 0, max: 1, step: 0.01 },
  { key: 'double_tap_window', label: 'Ventana Doble Tap', desc: 'Ventana de tiempo en segundos para reconocer dos taps seguidos como "doble tap". Más corta = más difícil de activar', min: 0.1, max: 1, step: 0.05 },
  { key: 'tilt_threshold', label: 'Sensibilidad Tilt', desc: 'Ángulo mínimo de inclinación de la mano necesario para detectar un movimiento de tilt. Más bajo = más sensible', min: 0.1, max: 1.5, step: 0.05 },
  { key: 'tilt_cooldown', label: 'Pausa Tilt', desc: 'Tiempo entre detecciones de tilt para evitar activaciones múltiples involuntarias', min: 0.05, max: 1, step: 0.05 },
];

export const SENS_GROUPS: SensGroup[] = [
  { label: 'Swipe', keys: ['swipe_threshold', 'swipe_dominance', 'swipe_cooldown'] },
  { label: 'Mouse', keys: ['mouse_speed', 'mouse_dead_zone'] },
  { label: 'Postura', keys: ['posture_hold_time', 'double_tap_window'] },
  { label: 'Tilt', keys: ['tilt_threshold', 'tilt_cooldown'] },
];

export const TARGET_OPTIONS: TargetOption[] = [
  { label: 'PC', value: 'pc', desc: 'Controla la PC conectada por USB al Pico W' },
  { label: 'Automatico', value: 'auto', desc: 'USB si hay' },
];
