import { Injectable, signal, WritableSignal, effect } from '@angular/core';
import { SensorSocket } from './sensor-socket';
import { MacroStep } from '../models/gesture-config.model';

@Injectable({ providedIn: 'root' })
export class MacroRecordingService {
  readonly recording: WritableSignal<boolean> = signal(false);
  readonly capturedSteps: WritableSignal<MacroStep[]> = signal([]);

  private lastSeenCount = 0;

  constructor(private socket: SensorSocket) {
    effect(() => {
      const actions = this.socket.recentActions();
      if (this.recording()) {
        const currentLen = actions.length;
        if (currentLen > this.lastSeenCount) {
          const newCount = currentLen - this.lastSeenCount;
          // recentActions() prepends (newest first), so reverse for chronological order
          for (let i = newCount - 1; i >= 0; i--) {
            const action = actions[i];
            this.capturedSteps.update(steps => [
              ...steps,
              { action: action.action, value: String(action.action_value ?? '') },
            ]);
          }
        }
        this.lastSeenCount = currentLen;
      }
    });
  }

  start(): void {
    this.capturedSteps.set([]);
    this.lastSeenCount = this.socket.recentActions().length;
    this.recording.set(true);
  }

  stop(): MacroStep[] {
    this.recording.set(false);
    return this.capturedSteps();
  }

  clear(): void {
    this.capturedSteps.set([]);
    this.lastSeenCount = this.socket.recentActions().length;
  }
}
