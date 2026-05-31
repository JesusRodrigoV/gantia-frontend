import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { RadioButtonModule } from 'primeng/radiobutton';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { Skeleton } from 'primeng/skeleton';
import { InputNumberModule } from 'primeng/inputnumber';
import { MouseConfigService } from '@core/services/mouse-config.service';
import { PicoTargetService, PicoTarget } from '@core/services/pico-target.service';
import { SensitivityService } from '@core/services/sensitivity.service';
import { SensitivitySettings } from '@core/models/sensitivity.model';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, DecimalPipe, ToggleSwitchModule, RadioButtonModule, InputNumberModule, Toast, Skeleton],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  providers: [MessageService],
})
export default class Settings implements OnInit, OnDestroy {
  private readonly mouseConfigService = inject(MouseConfigService);
  private readonly picoTargetService = inject(PicoTargetService);
  private readonly sensitivityService = inject(SensitivityService);
  private readonly messageService = inject(MessageService);

  protected loading = signal(true);
  protected sensLoading = signal(true);
  protected invertRoll = false;
  protected invertPitch = false;

  protected sens = signal<SensitivitySettings | null>(null);
  protected savingKeys = signal<Set<string>>(new Set());
  private readonly sensTimers = new Map<string, ReturnType<typeof setTimeout>>();

  protected readonly sensFields: { key: keyof SensitivitySettings; label: string; desc: string; min: number; max: number; step: number }[] = [
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

  protected readonly sensGroups: { label: string; keys: (keyof SensitivitySettings)[] }[] = [
    { label: 'Swipe', keys: ['swipe_threshold', 'swipe_dominance', 'swipe_cooldown'] },
    { label: 'Mouse', keys: ['mouse_speed', 'mouse_dead_zone'] },
    { label: 'Postura', keys: ['posture_hold_time', 'double_tap_window'] },
    { label: 'Tilt', keys: ['tilt_threshold', 'tilt_cooldown'] },
  ];

  protected selectedTarget = signal<PicoTarget>('auto');
  protected targetOptions: { label: string; value: PicoTarget; desc: string }[] = [
    { label: 'PC', value: 'pc', desc: 'Controla la PC conectada por USB al Pico W' },
    { label: 'Automatico', value: 'auto', desc: 'USB si hay' },
  ];

  ngOnInit(): void {
    this.mouseConfigService.getConfig().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (config) => {
        this.invertRoll = config.invert_roll;
        this.invertPitch = config.invert_pitch;
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
    this.sensitivityService.getSettings().pipe(finalize(() => this.sensLoading.set(false))).subscribe({
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
    return this.sensFields.find(f => f.key === key)!;
  }

  updateSensitivity(key: keyof SensitivitySettings, value: number): void {
    const current = this.sens();
    if (!current) return;
    this.sens.set({ ...current, [key]: value });
    this.savingKeys.update(s => new Set(s).add(key));

    const existing = this.sensTimers.get(key);
    if (existing) clearTimeout(existing);
    this.sensTimers.set(key, setTimeout(() => {
      this.sensTimers.delete(key);
      this.sensitivityService.updateSettings({ [key]: value }).subscribe({
        next: () => this.savingKeys.update(s => { s.delete(key); return new Set(s); }),
        error: () => {
          this.savingKeys.update(s => { s.delete(key); return new Set(s); });
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: `No se pudo guardar ${key}`,
            life: 4000,
          });
          this.loadSensitivity();
        },
      });
    }, 300));
  }

  onRollChange(): void {
    this.mouseConfigService.updateConfig({ invert_roll: this.invertRoll }).subscribe({
      next: (config) => {
        this.invertRoll = config.invert_roll;
        this.messageService.add({
          severity: 'success',
          summary: 'Guardado',
          detail: `Balanceo invertido: ${config.invert_roll ? 'SÍ' : 'NO'}`,
          life: 2000,
        });
      },
      error: () => {
        this.invertRoll = !this.invertRoll;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo guardar la configuracion',
          life: 4000,
        });
      },
    });
  }

  onPitchChange(): void {
    this.mouseConfigService.updateConfig({ invert_pitch: this.invertPitch }).subscribe({
      next: (config) => {
        this.invertPitch = config.invert_pitch;
        this.messageService.add({
          severity: 'success',
          summary: 'Guardado',
          detail: `Inclinacion invertida: ${config.invert_pitch ? 'SÍ' : 'NO'}`,
          life: 2000,
        });
      },
      error: () => {
        this.invertPitch = !this.invertPitch;
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
    this.sensTimers.forEach(t => clearTimeout(t));
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
