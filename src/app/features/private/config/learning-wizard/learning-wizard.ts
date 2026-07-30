import {
  Component, ChangeDetectionStrategy, inject, Injector, signal, computed, effect,
  runInInjectionContext, EffectRef, DestroyRef, input, output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PercentPipe } from '@angular/common';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SensorSocket } from '@core/services/sensor-socket';
import { LearningService, LearnAnalysis } from '@core/services/learning.service';
import { SoundService } from '@core/services/sound.service';
import { ToastService } from '@core/services/toast.service';
import { getMovementLabel, getOrientationLabel, getFlexStateLabel } from '@core/models/gesture-config.model';
import { getActionLabel } from '@core/models/glove-telemetry.model';
import { RoundedButton } from '@shared/components/ui/rounded-button';

@Component({
  selector: 'app-learning-wizard',
  imports: [FormsModule, PercentPipe, RoundedButton],
  templateUrl: './learning-wizard.html',
  styleUrls: ['./learning-wizard.scss', '../shared.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LearningWizard {
  readonly actions = input.required<string[]>();

  readonly saved = output<void>();

  private readonly sensorSocket = inject(SensorSocket);
  private readonly learningService = inject(LearningService);
  private readonly toast = inject(ToastService);
  private readonly soundService = inject(SoundService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  protected learnOpen = signal(false);
  protected learnStep = signal(1);
  protected learnSamplesCollected = signal(0);
  protected learnAnalysis = signal<LearnAnalysis | null>(null);
  protected learnSaving = signal(false);
  protected learnActionKey = signal('play_pause');
  protected learnLiveFlexIndex = signal(0);
  protected learnLiveFlexMiddle = signal(0);

  protected readonly isConnected = computed(() => this.sensorSocket.connectionStatus() === 'connected');

  private learnEffectCleanup: EffectRef | null = null;

  protected getMovementLabel = getMovementLabel;
  protected getOrientationLabel = getOrientationLabel;
  protected getFlexStateLabel = getFlexStateLabel;
  protected getActionLabel = getActionLabel;

  open(): void {
    const status = this.sensorSocket.connectionStatus();
    if (status !== 'connected') {
      this.toast.warn('Guante no conectado', 'Conectá el guante antes de aprender un gesto');
      return;
    }

    this.learnOpen.set(true);
    this.learnStep.set(1);
    this.learnSamplesCollected.set(0);
    this.learnAnalysis.set(null);
    this.learnActionKey.set('play_pause');
    this.sensorSocket.connect();

    this.learnEffectCleanup?.destroy();
    this.learnEffectCleanup = runInInjectionContext(this.injector, () => effect(() => {
      if (!this.learnOpen()) return;
      const t = this.sensorSocket.telemetry();
      if (!t) return;
      this.learnLiveFlexIndex.set(t.flex_index);
      this.learnLiveFlexMiddle.set(t.flex_middle);
    }));
  }

  protected start(): void {
    this.learningService.start().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.learnSamplesCollected.set(res.session.samples_collected);
        this.learnStep.set(2);
        this.toast.info('Aprendizaje iniciado', 'Realizá el gesto 3 veces');
      },
      error: (err) => {
        this.toast.httpError(err, 'Error', 'No se pudo iniciar la sesión de aprendizaje');
      },
    });
  }

  protected capture(): void {
    this.learningService.sample().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        const collected = res.session.samples_collected;
        this.learnSamplesCollected.set(collected);
        if (res.session.analysis) {
          this.learnAnalysis.set(res.session.analysis);
          this.learnStep.set(4);
        } else {
          this.learnStep.set(2 + collected);
        }
        this.toast.success(`Muestra ${collected}/3`, collected >= 3 ? 'Gesto completo — revisá el análisis' : 'Seguí, hacé el gesto de nuevo', 2000);
      },
      error: (err) => {
        this.toast.httpError(err, 'Error', 'No se pudo capturar la muestra');
      },
    });
  }

  protected save(): void {
    this.learnSaving.set(true);
    this.learningService.save(this.learnActionKey()).pipe(
      finalize(() => this.learnSaving.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.close();
        this.soundService.play('success');
        this.toast.success('Gesto aprendido', 'El nuevo gesto se guardó y está activo');
        this.saved.emit();
      },
      error: (err) => {
        this.soundService.play('droplet');
        this.toast.httpError(err, 'Error', 'No se pudo guardar el gesto aprendido');
      },
    });
  }

  protected close(): void {
    this.learnOpen.set(false);
    this.learnEffectCleanup?.destroy();
    this.learnEffectCleanup = null;
    this.learningService.cancel().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.sensorSocket.disconnect();
  }
}
