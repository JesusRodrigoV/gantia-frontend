export type PicoTarget = 'pc' | 'auto';

export interface PicoTargetResponse {
  target: PicoTarget;
  connected: { usb: boolean };
}
