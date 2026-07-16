export interface ActionHistoryEntry {
  action: string;
  value: unknown;
  target: string;
  result: string;
  timestamp: number;
}

export interface ActionHistoryResponse {
  data: ActionHistoryEntry[];
  total: number;
}
