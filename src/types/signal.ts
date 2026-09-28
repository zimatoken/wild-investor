// ZSS-сигнал — порт SOKOL-TRADER v0.6.2
export type Rating = 'ELITE' | 'OPTIMAL' | 'MODERATE' | 'WEAK';

export interface Signal {
  id: string;              // di_<ticker>_<YYYY-MM-DD>
  ticker: string;
  date: string;            // YYYY-MM-DD
  zss: number;             // 0..5
  rating: Rating;
  price: number;
  // детализация ZSS
  adx: number;
  rsi: number;
  volumeRatio: number;
  vwapDiffPct: number;
  // уровни по правилу 2%
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  positionPct: number;     // % от банка
  createdAt: string;       // ISO
}
