export interface LearnSession {
  active: boolean;
  samples_collected: number;
  samples_required: number;
  started_at: number;
  last_sample: Record<string, unknown> | null;
  analysis?: LearnAnalysis;
}

export interface LearnAnalysis {
  movement: string;
  orientation: string;
  index_state: number;
  middle_state: number;
  confidence: number;
  is_static: boolean;
  is_dynamic: boolean;
  sample_count: number;
  raw_samples: Record<string, unknown>[];
}

export interface LearnStartResponse {
  message: string;
  session: LearnSession;
}

export interface LearnSampleResponse {
  message: string;
  session: LearnSession & { analysis?: LearnAnalysis };
}

export interface LearnSaveResponse {
  message: string;
  config: {
    movement: string;
    orientation: string;
    index_state: number;
    middle_state: number;
    action_key: string;
    action_value: string | null;
  };
  analysis: LearnAnalysis;
  created: boolean;
}

export interface LearnCancelResponse {
  message: string;
}
