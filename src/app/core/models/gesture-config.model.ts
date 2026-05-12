export const MOVEMENTS = ['NONE', 'SWIPE_UP', 'SWIPE_DOWN', 'SWIPE_LEFT', 'SWIPE_RIGHT', 'TWIST'] as const;
export const ORIENTATIONS = ['ANY', 'PALM_UP', 'PALM_DOWN', 'UP', 'DOWN', 'NEUTRAL'] as const;
export const FLEX_STATES = [0, 1, 2] as const;
export const ACTIONS = [
  'volume_up', 'volume_down', 'mute', 'play_pause', 'next', 'prev',
  'scroll_up', 'scroll_down', 'back', 'forward',
  'brightness_up', 'brightness_down',
  'show_desktop', 'open_browser', 'open_url', 'open_app', 'change_mode', 'hotkey',
  'next_slide', 'prev_slide', 'start_present',
  'left_click', 'right_click',
] as const;

export const MOVEMENT_LABELS: Record<string, string> = {
  NONE: 'Ninguno',
  SWIPE_UP: 'Arriba ↑',
  SWIPE_DOWN: 'Abajo ↓',
  SWIPE_LEFT: 'Izquierda ←',
  SWIPE_RIGHT: 'Derecha →',
  TWIST: 'Giro',
};

export const ORIENTATION_LABELS: Record<string, string> = {
  ANY: 'Cualquiera',
  PALM_UP: 'Palma Arriba',
  PALM_DOWN: 'Palma Abajo',
  UP: 'Hacia Arriba',
  DOWN: 'Hacia Abajo',
  NEUTRAL: 'Neutral',
};

export const FLEX_STATE_LABELS: Record<number, string> = {
  0: 'Abierto',
  1: 'Parcial',
  2: 'Flexionado',
};

export function getMovementLabel(m: string): string {
  return MOVEMENT_LABELS[m] ?? m;
}

export function getOrientationLabel(o: string): string {
  return ORIENTATION_LABELS[o] ?? o;
}

export function getFlexStateLabel(s: number): string {
  return FLEX_STATE_LABELS[s] ?? String(s);
}

export interface GestureConfig {
  id: string;
  movement: string;
  orientation: string;
  index_state: number;
  middle_state: number;
  action_key: string;
}

export type GestureConfigForm = Omit<GestureConfig, 'id'>;
