import { GloveTelemetry } from '@core/models/glove-telemetry.model';

export interface SensorChartConfig {
  title: string;
  unitLabel: string;
  seriesColors: [string, string, string];
  seriesLabels?: [string, string, string];
  extractValues: (telemetry: GloveTelemetry) => [number, number, number];
}
