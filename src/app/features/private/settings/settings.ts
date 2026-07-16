import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  OnDestroy,
  signal,
  DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { RadioButtonModule } from 'primeng/radiobutton';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { Skeleton } from 'primeng/skeleton';
import { InputNumberModule } from 'primeng/inputnumber';
import { MouseConfigService } from '@core/services/mouse-config.service';
import { MouseConfig } from '@core/models/mouse-config.model';
import { PicoTargetService, PicoTarget } from '@core/services/pico-target.service';
import { SensitivityService } from '@core/services/sensitivity.service';
import { SoundService } from '@core/services/sound.service';
import { SensitivitySettings } from '@core/models/sensitivity.model';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SENS_FIELDS, SENS_GROUPS, TARGET_OPTIONS } from './sensitivity-fields';

@Component({
  selector: 'app-settings',
  imports: [
    FormsModule,
    DecimalPipe,
    ToggleSwitchModule,
    RadioButtonModule,
    InputNumberModule,
    Toast,
    Skeleton,
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Settings implements OnInit, OnDestroy {
  private readonly mouseConfigService = inject(MouseConfigService);
  private readonly picoTargetService = inject(PicoTargetService);
  private readonly sensitivityService = inject(SensitivityService);
  private readonly soundService = inject(SoundService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  protected loading = signal(true);
  protected sensLoading = signal(true);
  protected invertRoll = signal(false);
  protected invertPitch = signal(false);

  protected sens = signal<SensitivitySettings | null>(null);
  protected savingKeys = signal<Set<string>>(new Set());
  private readonly sensTimers = new Map<string, ReturnType<typeof setTimeout>>();

  protected soundEnabled = this.soundService.enabled;

  protected onSoundToggle(value: boolean): void {
    this.soundService.setEnabled(value);
  }

  protected readonly sensFields = SENS_FIELDS;
  protected readonly sensGroups = SENS_GROUPS;
  protected readonly targetOptions = TARGET_OPTIONS;

  protected selectedTarget = signal<PicoTarget>('auto');

  ngOnInit(): void {
    this.mouseConfigService
      .getConfig()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (config) => {
          this.invertRoll.set(config.invert_roll);
          this.invertPitch.set(config.invert_pitch);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo cargar la configuracion del mouse',
            life: 4000,
          });
        },
      });

    this.picoTargetService.load();
    this.selectedTarget.set(this.picoTargetService.target());

    this.loadSensitivity();
  }

  protected loadSensitivity(): void {
    this.sensLoading.set(true);
    this.sensitivityService
      .getSettings()
      .pipe(
        finalize(() => this.sensLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (s) => this.sens.set(s),
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar los parámetros de sensibilidad',
            life: 4000,
          });
        },
      });
  }

  isRangeField(key: keyof SensitivitySettings): boolean {
    return key === 'swipe_dominance' || key === 'mouse_dead_zone';
  }

  getField(key: keyof SensitivitySettings) {
    return this.sensFields.find((f) => f.key === key)!;
  }

  protected onRangeInput(key: keyof SensitivitySettings, event: Event): void {
    const target = event.target as HTMLInputElement;
    this.updateSensitivity(key, target.valueAsNumber || Number(target.value));
  }

  updateSensitivity(key: keyof SensitivitySettings, value: number): void {
    const current = this.sens();
    if (!current) return;
    this.sens.set({ ...current, [key]: value });
    this.savingKeys.update((s) => new Set(s).add(key));

    const existing = this.sensTimers.get(key);
    if (existing) clearTimeout(existing);
    this.sensTimers.set(
      key,
      setTimeout(() => {
        this.sensTimers.delete(key);
        this.sensitivityService
          .updateSettings({ [key]: value })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () =>
              this.savingKeys.update((s) => {
                s.delete(key);
                return new Set(s);
              }),
            error: () => {
              this.savingKeys.update((s) => {
                s.delete(key);
                return new Set(s);
              });
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: `No se pudo guardar ${key}`,
                life: 4000,
              });
              this.loadSensitivity();
            },
          });
      }, 300),
    );
  }

  onRollChange(value: boolean): void {
    this.mouseConfigService
      .updateConfig({ invert_roll: value })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config: MouseConfig) => {
          this.invertRoll.set(config.invert_roll);
          this.messageService.add({
            severity: 'success',
            summary: 'Guardado',
            detail: `Balanceo invertido: ${config.invert_roll ? 'SÍ' : 'NO'}`,
            life: 2000,
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo guardar la configuracion',
            life: 4000,
          });
        },
      });
  }

  onPitchChange(value: boolean): void {
    this.mouseConfigService
      .updateConfig({ invert_pitch: value })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config: MouseConfig) => {
          this.invertPitch.set(config.invert_pitch);
          this.messageService.add({
            severity: 'success',
            summary: 'Guardado',
            detail: `Inclinacion invertida: ${config.invert_pitch ? 'SÍ' : 'NO'}`,
            life: 2000,
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo guardar la configuracion',
            life: 4000,
          });
        },
      });
  }

  ngOnDestroy(): void {
    this.sensTimers.forEach((t) => clearTimeout(t));
    this.sensTimers.clear();
  }

  onTargetChange(target: PicoTarget): void {
    this.selectedTarget.set(target);
    this.picoTargetService.setTarget(target);
    this.messageService.add({
      severity: 'info',
      summary: 'Target cambiado',
      detail: `Modo de control: ${this.picoTargetService.targetLabel()}`,
      life: 2500,
    });
  }
}
