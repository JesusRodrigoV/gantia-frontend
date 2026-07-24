import {
  Component, ChangeDetectionStrategy, inject, Injector, signal, effect,
  runInInjectionContext, EffectRef, DestroyRef,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SensorSocket } from '@core/services/sensor-socket';
import { GloveTelemetry, getActionLabel } from '@core/models/glove-telemetry.model';

@Component({
  selector: 'app-test-mode',
  imports: [DecimalPipe],
  templateUrl: './test-mode.html',
  styleUrls: ['./test-mode.scss', '../shared.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestMode {
  private readonly sensorSocket = inject(SensorSocket);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  protected mode = signal(false);
  protected telemetry = signal<GloveTelemetry | null>(null);
  protected actions = signal<Array<{ id: string; action: string; time: string }>>([]);

  private testActionIndex = 0;
  private testEffectCleanup: EffectRef | null = null;

  protected start(): void {
    this.mode.set(true);
    this.actions.set([]);
    this.testActionIndex = 0;
    this.sensorSocket.connect();

    this.testEffectCleanup?.destroy();
    this.testEffectCleanup = runInInjectionContext(this.injector, () => effect(() => {
      const t = this.sensorSocket.telemetry();
      if (t && this.mode()) {
        this.telemetry.set(t);
      }

      const recent = this.sensorSocket.recentActions();
      const len = recent.length;
      if (this.mode() && len > this.testActionIndex) {
        const newCount = len - this.testActionIndex;
        for (let i = 0; i < newCount; i++) {
          const action = recent[i];
          this.actions.update(prev => [{
            id: crypto.randomUUID(),
            action: getActionLabel(action.action),
            time: new Date().toLocaleTimeString(),
          }, ...prev].slice(0, 50));
        }
        this.testActionIndex = len;
      }
    }));

    this.destroyRef.onDestroy(() => this.stop());
  }

  protected stop(): void {
    this.mode.set(false);
    this.actions.set([]);
    this.telemetry.set(null);
    this.testEffectCleanup?.destroy();
    this.testEffectCleanup = null;
    this.sensorSocket.disconnect();
  }
}
