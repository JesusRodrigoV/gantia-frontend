import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Skeleton } from 'primeng/skeleton';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { GestureConfigService } from '@core/services/gesture-config.service';
import { CalibrationService } from '@core/services/calibration.service';
import { ConfigService } from '@core/services/config.service';
import {
  GestureConfig, GestureConfigForm, MOVEMENTS, ORIENTATIONS, FLEX_STATES, ACTIONS,
  getMovementLabel, getOrientationLabel, getFlexStateLabel,
} from '@core/models/gesture-config.model';
import { getActionLabel } from '@core/models/glove-telemetry.model';
import { CalibrationEntry } from '@core/models/calibration.model';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-config',
  imports: [FormsModule, Skeleton, Toast],
  providers: [MessageService],
  templateUrl: './config.html',
  styleUrl: './config.scss',
})
export default class Config implements OnInit {
  private readonly gestureService = inject(GestureConfigService);
  private readonly calibrationService = inject(CalibrationService);
  private readonly configService = inject(ConfigService);
  private readonly messageService = inject(MessageService);
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  protected gestureConfigs = signal<GestureConfig[]>([]);
  protected gestureLoading = signal(true);
  protected gestureError = signal(false);

  protected calibration = signal<CalibrationEntry[]>([]);
  protected calibrationLoading = signal(true);
  protected calibrationError = signal(false);

  protected dialogOpen = signal(false);
  protected editingId = signal<string | null>(null);
  protected form = signal<GestureConfigForm>({
    movement: 'NONE',
    orientation: 'ANY',
    index_state: 0,
    middle_state: 0,
    action_key: 'play_pause',
  });
  protected saving = signal(false);
  protected syncing = signal(false);

  protected readonly movements = MOVEMENTS;
  protected readonly orientations = ORIENTATIONS;
  protected readonly flexStates = FLEX_STATES;
  protected readonly actions = ACTIONS;
  protected readonly getMovementLabel = getMovementLabel;
  protected readonly getOrientationLabel = getOrientationLabel;
  protected readonly getFlexStateLabel = getFlexStateLabel;
  protected readonly getActionLabel = getActionLabel;

  ngOnInit(): void {
    this.loadGestureConfigs();
    this.loadCalibration();
  }

  loadGestureConfigs(): void {
    this.gestureLoading.set(true);
    this.gestureError.set(false);
    this.gestureService.getAll().pipe(finalize(() => this.gestureLoading.set(false))).subscribe({
      next: (data) => this.gestureConfigs.set(data),
      error: () => this.gestureError.set(true),
    });
  }

  loadCalibration(): void {
    this.calibrationLoading.set(true);
    this.calibrationError.set(false);
    this.calibrationService.getAll().pipe(finalize(() => this.calibrationLoading.set(false))).subscribe({
      next: (data) => this.calibration.set(data),
      error: () => this.calibrationError.set(true),
    });
  }

  refreshConfigs(): void {
    this.loadGestureConfigs();
  }

  refreshCalibration(): void {
    this.loadCalibration();
  }

  openCreateDialog(): void {
    this.editingId.set(null);
    this.form.set({ movement: 'NONE', orientation: 'ANY', index_state: 0, middle_state: 0, action_key: 'play_pause' });
    this.dialogOpen.set(true);
  }

  openEditDialog(config: GestureConfig): void {
    this.editingId.set(config.id);
    this.form.set({
      movement: config.movement,
      orientation: config.orientation,
      index_state: config.index_state,
      middle_state: config.middle_state,
      action_key: config.action_key,
    });
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  saveGesture(): void {
    this.saving.set(true);
    const data = this.form();

    const action = this.editingId()
      ? this.gestureService.update(this.editingId()!, data)
      : this.gestureService.create(data);

    action.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => {
        this.gestureConfigs.update(list => {
          const id = this.editingId();
          if (id) {
            return list.map(g => g.id === id ? { ...saved, id: saved.id } : g);
          }
          return [...list, { ...saved, id: saved.id }];
        });
        this.closeDialog();
        this.messageService.add({
          severity: 'success',
          summary: 'Guardado',
          detail: `Gesto ${this.editingId() ? 'actualizado' : 'creado'}`,
          life: 2000,
        });
      },
      error: () => {
        this.closeDialog();
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo guardar la configuración del gesto',
          life: 4000,
        });
      },
    });
  }

  deleteGesture(id: string): void {
    this.gestureService.delete(id).subscribe({
      next: () => {
        this.gestureConfigs.update(list => list.filter(g => g.id !== id));
        this.messageService.add({
          severity: 'success',
          summary: 'Eliminado',
          detail: 'Configuración de gesto eliminada',
          life: 2000,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo eliminar la configuración',
          life: 4000,
        });
      },
    });
  }

  syncFromSupabase(): void {
    this.syncing.set(true);
    this.configService.refreshFromSupabase().pipe(finalize(() => this.syncing.set(false))).subscribe({
      next: () => {
        this.loadGestureConfigs();
        this.loadCalibration();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo sincronizar con Supabase',
          life: 4000,
        });
      },
    });
  }

  updateCalibration(sensor: CalibrationEntry): void {
    const key = sensor.sensor_name;
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);
    this.debounceTimers.set(key, setTimeout(() => {
      this.debounceTimers.delete(key);
      this.calibrationService.update(sensor.sensor_name, {
        min_value: sensor.min_value,
        max_value: sensor.max_value,
      }).subscribe({
        next: (updated) => {
          this.calibration.update(list =>
            list.map(c => c.sensor_name === sensor.sensor_name ? updated : c),
          );
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: `No se pudo guardar calibración de ${sensor.sensor_name}`,
            life: 4000,
          });
        },
      });
    }, 400));
  }
}
