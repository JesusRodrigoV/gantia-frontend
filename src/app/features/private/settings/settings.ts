import {
  Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy,
  signal, DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputNumberModule } from 'primeng/inputnumber';
import { Toast } from 'primeng/toast';
import { Skeleton } from 'primeng/skeleton';
import { MouseConfigService } from '@core/services/mouse-config.service';
import { MouseConfig } from '@core/models/mouse-config.model';
import { PicoTargetService, PicoTarget } from '@core/services/pico-target.service';
import { SensitivityService } from '@core/services/sensitivity.service';
import { SoundService } from '@core/services/sound.service';
import { ToastService } from '@core/services/toast.service';
import { SensitivitySettings } from '@core/models/sensitivity.model';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SENS_FIELDS, SENS_GROUPS, TARGET_OPTIONS } from './sensitivity-fields';
import { RoundedButton } from '@shared/components/ui/rounded-button';

@Component({
  selector: 'app-settings',
  imports: [
    FormsModule, DecimalPipe, ToggleSwitchModule, RadioButtonModule,
    InputNumberModule, Toast, Skeleton, RoundedButton,
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Settings implements OnInit, OnDestroy {
  private readonly mouseConfigService = inject(MouseConfigService);
  private readonly picoTargetService = inject(PicoTargetService);
  private readonly sensitivityService = inject(SensitivityService);
  private readonly soundService = inject(SoundService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected loading = signal(true);
  protected sensLoading = signal(true);
  protected invertRoll = signal(false);
  protected invertPitch = signal(false);

  protected sens = signal<SensitivitySettings | null>(null);
  protected savingKeys = signal<Set<string>>(new Set());
  private readonly sensTimers = new Map<string, ReturnType<typeof setTimeout>>();

  protected soundEnabled = this.soundService.enabled;
  protected readonly sensFields = SENS_FIELDS;
  protected readonly sensGroups = SENS_GROUPS;
  protected readonly targetOptions = TARGET_OPTIONS;
  protected selectedTarget = signal<PicoTarget>('auto');

  ngOnInit(): void {
    this.mouseConfigService.getConfig().pipe(
      finalize(() => this.loading.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (config) => {
        this.invertRoll.set(config.invert_roll);
        this.invertPitch.set(config.invert_pitch);
      },
      error: (err) => this.toast.httpError(err, 'Error', 'No se pudo cargar la configuración del mouse'),
    });

    this.picoTargetService.load();
    this.selectedTarget.set(this.picoTargetService.target());
    this.loadSensitivity();
  }

  protected loadSensitivity(): void {
    this.sensLoading.set(true);
    this.sensitivityService.getSettings().pipe(
      finalize(() => this.sensLoading.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (s) => this.sens.set(s),
      error: (err) => this.toast.httpError(err, 'Error', 'No se pudieron cargar los parámetros de sensibilidad'),
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
    this.sensTimers.set(key, setTimeout(() => {
      this.sensTimers.delete(key);
      this.sensitivityService.updateSettings({ [key]: value })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.savingKeys.update((s) => { s.delete(key); return new Set(s); }),
          error: (err) => {
            this.savingKeys.update((s) => { s.delete(key); return new Set(s); });
            const label = this.getField(key)?.label || key;
            this.toast.httpError(err, 'Error', `No se pudo guardar ${label}`);
            this.loadSensitivity();
          },
        });
    }, 300));
  }

  protected onToggleChange(field: 'roll' | 'pitch', value: boolean): void {
    const update = field === 'roll' ? { invert_roll: value } : { invert_pitch: value };
    const signal = field === 'roll' ? this.invertRoll : this.invertPitch;
    const label = field === 'roll' ? 'Balanceo invertido' : 'Inclinación invertida';

    this.mouseConfigService.updateConfig(update)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config: MouseConfig) => {
          signal.set(field === 'roll' ? config.invert_roll : config.invert_pitch);
          this.toast.success('Guardado', `${label}: ${value ? 'SÍ' : 'NO'}`, 2000);
        },
        error: (err) => this.toast.httpError(err, 'Error', 'No se pudo guardar la configuración'),
      });
  }

  onTargetChange(target: PicoTarget): void {
    this.selectedTarget.set(target);
    this.picoTargetService.setTarget(target);
    this.toast.info('Target cambiado', `Modo de control: ${this.picoTargetService.targetLabel()}`, 2500);
  }

  protected onSoundToggle(value: boolean): void {
    this.soundService.setEnabled(value);
  }

  ngOnDestroy(): void {
    this.sensTimers.forEach((t) => clearTimeout(t));
    this.sensTimers.clear();
  }
}
