import { Component, ChangeDetectionStrategy, signal, DestroyRef, inject, effect, viewChild, ElementRef, OnDestroy } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Skeleton } from 'primeng/skeleton';
import { ReadingsHistoryService } from '@core/services/readings-history.service';
import { ActionsHistoryService, ActionHistoryEntry } from '@core/services/actions-history.service';
import { HistoryReading } from '@core/models/reading-history.model';
import { getActionLabel } from '@core/models/glove-telemetry.model';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HistoryChart } from './history-chart';

@Component({
  selector: 'app-history',
  imports: [DecimalPipe, DatePipe, FormsModule, Skeleton],
  templateUrl: './history.html',
  styleUrl: './history.scss',
  host: { '(window:resize)': 'onResize()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class History implements OnDestroy {
  private readonly service = inject(ReadingsHistoryService);
  private readonly actionsService = inject(ActionsHistoryService);
  private destroyRef = inject(DestroyRef);
  private chart = new HistoryChart();

  protected tab = signal<'readings' | 'actions'>('readings');

  protected since = '';
  protected until = '';
  protected limit = 200;

  protected readings = signal<HistoryReading[]>([]);
  protected total = signal(0);
  protected loading = signal(false);
  protected error = signal(false);
  protected searched = signal(false);

  protected chartType = signal<'accel' | 'gyro' | 'flex'>('accel');

  protected actions = signal<ActionHistoryEntry[]>([]);
  protected actionsTotal = signal(0);
  protected actionsLoading = signal(false);
  protected actionsError = signal(false);
  protected actionsLimit = 50;

  private chartEl = viewChild<ElementRef<HTMLDivElement>>('chartContainer');

  protected readonly getActionLabel = getActionLabel;

  constructor() {
    this.setDefaultToday();
    this.search();

    effect(() => {
      if (this.readings().length > 0) {
        const container = this.chartEl()?.nativeElement;
        if (container) {
          this.chart.init(container);
          this.chart.update(this.readings(), this.chartType());
        }
      }
    });
  }

  setDefaultToday(): void {
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    this.since = sixHoursAgo.toISOString().slice(0, 16);
    this.until = now.toISOString().slice(0, 16);
  }

  search(): void {
    if (!this.since) return;

    this.loading.set(true);
    this.error.set(false);
    this.searched.set(true);

    const sinceISO = new Date(this.since).toISOString();
    const untilISO = this.until ? new Date(this.until).toISOString() : undefined;

    this.service.getHistory(sinceISO, untilISO, this.limit)
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.readings.set(res.data);
          this.total.set(res.total);
          this.chart.update(res.data, this.chartType());
        },
        error: () => this.error.set(true),
      });
  }

  changeChartType(type: 'accel' | 'gyro' | 'flex'): void {
    this.chartType.set(type);
    if (this.readings().length > 0) {
      this.chart.update(this.readings(), type);
    }
  }

  ngOnDestroy(): void {
    this.chart.destroy();
  }

  onResize(): void {
    this.chart.onResize(this.chartEl()?.nativeElement ?? null);
  }

  protected loadActions(): void {
    this.actionsLoading.set(true);
    this.actionsError.set(false);
    this.actionsService.getHistory(this.actionsLimit).pipe(finalize(() => this.actionsLoading.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.actions.set(res.data);
        this.actionsTotal.set(res.total);
      },
      error: () => this.actionsError.set(true),
    });
  }

  protected formatActionValue(entry: ActionHistoryEntry): string {
    if (entry.value === null || entry.value === undefined) return '-';
    if (typeof entry.value === 'object') return JSON.stringify(entry.value);
    return String(entry.value);
  }

  protected formatActionTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleString();
  }

  protected switchTab(t: 'readings' | 'actions'): void {
    this.tab.set(t);
    if (t === 'actions' && this.actions().length === 0 && !this.actionsLoading()) {
      this.loadActions();
    }
  }
}
