// Свеча и рыночные данные
export interface Candle {
  time: string; // ISO
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type DataMode = 'auto' | 'manual';

export interface MarketSnapshot {
  ticker: string;
  price: number;
  candles: Candle[];
  fetchedAt: string; // ISO
  source: 'moex' | 'manual';
}
