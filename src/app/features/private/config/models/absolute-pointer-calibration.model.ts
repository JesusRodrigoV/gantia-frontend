export type CornerName = 'tl' | 'tr' | 'bl' | 'br';

export interface CornerStep {
  key: CornerName;
  label: string;
  description: string;
  icon: string;
}
