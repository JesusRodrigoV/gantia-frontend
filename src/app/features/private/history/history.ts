import { Component, ChangeDetectionStrategy, signal, DestroyRef, inject, OnDestroy, effect, viewChild, ElementRef } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Skeleton } from 'primeng/skeleton';
import { ReadingsHistoryService } from '@core/services/readings-history.service';
import { ActionsHistoryService, ActionHistoryEntry } from '@core/services/actions-history.service';
import { HistoryReading } from '@core/models/reading-history.model';
import { getActionLabel } from '@core/models/glove-telemetry.model';
import { finalize } from 'rxjs';
import uPlot, { AlignedData } from 'uplot';

@Component({
  selector: 'app-history',
  imports: [DecimalPipe, DatePipe, FormsModule, Skeleton],
  templateUrl: './history.html',
  styleUrl: './history.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:resize)': 'onResize()',
  },
})
export default class History {
  private readonly service = inject(ReadingsHistoryService);
  private readonly actionsService = inject(ActionsHistoryService);
  private destroyRef = inject(DestroyRef);

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
  private plot: uPlot | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly getActionLabel = getActionLabel;

  constructor() {
    this.setDefaultToday();
    this.search();

    effect(() => {
      if (this.readings().length > 0 && this.plot === null) {
        setTimeout(() => {
          this.initChart();
          if (this.plot) {
            this.updateChart(this.readings());
          }
        });
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
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.readings.set(res.data);
          this.total.set(res.total);
          this.updateChart(res.data);
        },
        error: () => this.error.set(true),
      });
  }

  changeChartType(type: 'accel' | 'gyro' | 'flex'): void {
    this.chartType.set(type);
    if (this.readings().length > 0) {
      this.updateChart(this.readings());
    }
  }

  private initChart(): void {
    const container = this.chartEl()?.nativeElement;
    if (!container) return;

    const opts: uPlot.Options = {
      width: container.clientWidth,
      height: 280,
      cursor: {
        points: { show: false },
      },
      scales: {
        x: { time: false },
      },
      axes: [
        {
          label: 'Índice',
          labelSize: 14,
          stroke: '#6366f1',
          font: '11px inherit',
        },
        {
          label: 'Valor',
          labelSize: 14,
          stroke: '#94a3b8',
          font: '11px inherit',
        },
      ],
      series: [
        {},
        {
          label: 'Serie 1',
          stroke: '#6366f1',
          width: 1.5,
          points: { show: false },
        },
        {
          label: 'Serie 2',
          stroke: '#8b5cf6',
          width: 1.5,
          points: { show: false },
        },
        {
          label: 'Serie 3',
          stroke: '#a78bfa',
          width: 1.5,
          points: { show: false },
        },
      ],
      legend: {
        show: true,
        live: false,
      },
    };

    const data: AlignedData = [[], [], [], []];
    this.plot = new uPlot(opts, data, container);
  }

  private updateChart(data: HistoryReading[]): void {
    if (!this.plot || data.length === 0) return;

    const type = this.chartType();
    const timestamps = new Float64Array(data.map((_, i) => i));

    let series1: Float64Array, series2: Float64Array, series3: Float64Array;
    let label1: string, label2: string, label3: string;
    let color1: string, color2: string, color3: string;

    if (type === 'accel') {
      series1 = new Float64Array(data.map(r => r.accel_x));
      series2 = new Float64Array(data.map(r => r.accel_y));
      series3 = new Float64Array(data.map(r => r.accel_z));
      label1 = 'Accel X';
      label2 = 'Accel Y';
      label3 = 'Accel Z';
      color1 = '#6366f1';
      color2 = '#8b5cf6';
      color3 = '#a78bfa';
    } else if (type === 'gyro') {
      series1 = new Float64Array(data.map(r => r.gyro_x));
      series2 = new Float64Array(data.map(r => r.gyro_y));
      series3 = new Float64Array(data.map(r => r.gyro_z));
      label1 = 'Gyro X';
      label2 = 'Gyro Y';
      label3 = 'Gyro Z';
      color1 = '#f59e0b';
      color2 = '#f97316';
      color3 = '#ef4444';
    } else {
      series1 = new Float64Array(data.map(r => r.flex_index));
      series2 = new Float64Array(data.map(r => r.flex_middle));
      series3 = new Float64Array(data.map(() => 0));
      label1 = 'Flex Índice';
      label2 = 'Flex Medio';
      label3 = '';
      color1 = '#10b981';
      color2 = '#06b6d4';
      color3 = 'transparent';
    }

    const chartData: AlignedData = [timestamps, series1, series2, series3];
    this.plot.setData(chartData);

    const series = this.plot.series;
    if (series[1]) {
      (series[1] as any).label = label1;
      (series[1] as any).stroke = color1;
    }
    if (series[2]) {
      (series[2] as any).label = label2;
      (series[2] as any).stroke = color2;
    }
    if (series[3]) {
      (series[3] as any).label = label3;
      (series[3] as any).stroke = color3;
    }

    this.plot.redraw();
  }

  ngOnDestroy(): void {
    if (this.resizeTimer !== null) {
      clearTimeout(this.resizeTimer);
    }
    if (this.plot) {
      this.plot.destroy();
      this.plot = null;
    }
  }

  onResize(): void {
    if (this.resizeTimer !== null) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      if (this.plot && this.chartEl()) {
        this.plot.setSize({
          width: this.chartEl()!.nativeElement.clientWidth,
          height: 280,
        });
      }
    }, 100);
  }

  protected formatActionValue(entry: ActionHistoryEntry): string {
    if (entry.value === null || entry.value === undefined) return '-';
    if (typeof entry.value === 'object') return JSON.stringify(entry.value);
    return String(entry.value);
  }

  protected formatActionTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleString();
  }

  protected loadActions(): void {
    this.actionsLoading.set(true);
    this.actionsError.set(false);
    this.actionsService.getHistory(this.actionsLimit).pipe(finalize(() => this.actionsLoading.set(false))).subscribe({
      next: (res) => {
        this.actions.set(res.data);
        this.actionsTotal.set(res.total);
      },
      error: () => this.actionsError.set(true),
    });
  }

  protected switchTab(t: 'readings' | 'actions'): void {
    this.tab.set(t);
    if (t === 'actions' && this.actions().length === 0 && !this.actionsLoading()) {
      this.loadActions();
    }
  }
}
