import { Injectable, signal } from '@angular/core';
import { bind, play, setEnabled } from 'cuelume';

export type SoundName = 'chime' | 'sparkle' | 'droplet' | 'bloom' | 'whisper' | 'tick' | 'press' | 'release' | 'toggle' | 'success';

@Injectable({ providedIn: 'root' })
export class SoundService {
  private readonly _enabled = signal<boolean>(true);
  readonly enabled = this._enabled.asReadonly();

  constructor() {
    const stored = localStorage.getItem('gantia_sound_enabled');
    const isEnabled = stored === null ? true : stored === 'true';
    this._enabled.set(isEnabled);
    setEnabled(isEnabled);
    bind();
  }

  setEnabled(value: boolean): void {
    this._enabled.set(value);
    localStorage.setItem('gantia_sound_enabled', String(value));
    setEnabled(value);
  }

  play(name?: SoundName): void {
    play(name);
  }
}
