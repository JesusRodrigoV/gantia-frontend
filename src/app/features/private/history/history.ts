import { Component, inject, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Skeleton } from 'primeng/skeleton';
import { ReadingsHistoryService } from '@core/services/readings-history.service';
import { HistoryReading } from '@core/models/reading-history.model';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-history',
  imports: [DecimalPipe, DatePipe, FormsModule, Skeleton],
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export default class History {
  private readonly service = inject(ReadingsHistoryService);

  protected since = '';
  protected until = '';
  protected limit = 200;

  protected readings = signal<HistoryReading[]>([]);
  protected total = signal(0);
  protected loading = signal(false);
  protected error = signal(false);
  protected searched = signal(false);

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
        },
        error: () => this.error.set(true),
      });
  }
}
