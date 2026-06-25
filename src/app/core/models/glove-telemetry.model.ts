export interface GloveTelemetry {
  button_pressed: number;
  flex_index: number;
  flex_middle: number;
  index_state: number;
  middle_state: number;
  accel_x: number;
  accel_y: number;
  accel_z: number;
  gyro_x: number;
  gyro_y: number;
  gyro_z: number;
}

export const FLEX_STATE_LABELS: Record<number, string> = {
  0: 'Abierto',
  1: 'Parcial',
  2: 'Flexionado',
};

export interface ActionEvent {
  action: string;
  action_value: unknown;
}

export interface GestureDetectedEvent {
  type: 'gesture_detected';
  gesture: string;
  action: string;
}

export function isGestureDetected(data: unknown): data is GestureDetectedEvent {
  return typeof data === 'object' && data !== null && (data as any).type === 'gesture_detected';
}

const ACTION_LABELS: Record<string, string> = {
  mouse_mode: 'Mouse Mode',
  volume_up: 'Subir Volumen',
  volume_down: 'Bajar Volumen',
  mute: 'Silenciar',
  play_pause: 'Reproducir/Pausar',
  next: 'Siguiente',
  prev: 'Anterior',
  scroll_up: 'Scroll Arriba',
  scroll_down: 'Scroll Abajo',
  back: 'Atrás',
  forward: 'Adelante',
  brightness_up: 'Brillo +',
  brightness_down: 'Brillo -',
  show_desktop: 'Mostrar Escritorio',
  open_browser: 'Abrir Navegador',
  open_url: 'Abrir URL',
  open_app: 'Abrir App',
  change_mode: 'Cambiar Modo',
  hotkey: 'Hotkey',
  next_slide: 'Siguiente Slide',
  prev_slide: 'Slide Anterior',
  start_present: 'Iniciar Presentación',
  left_click: 'Click Izquierdo',
  right_click: 'Click Derecho',
  scroll: 'Scroll',
  mouse_move: 'Mover Mouse',
  execute_cmd: 'Ejecutar Comando',
  sequence: 'Secuencia',
  delay: 'Esperar',
};

export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function isActionMessage(data: unknown): data is ActionEvent {
  return typeof data === 'object' && data !== null && 'action' in data;
}