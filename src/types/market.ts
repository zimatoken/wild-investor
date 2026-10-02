// Свеча и рыночные данные
export interface Candle {
  time: string;
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
  fetchedAt: string;
  asOf: string; // ← НОВОЕ: время последней свечи (честность №7)
  source: 'moex' | 'manual';
}
