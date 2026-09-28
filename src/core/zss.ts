// ZSS-скоринг 0..5 — порт signal_engine.py из SOKOL-TRADER v0.6.2
//
//   ZSS = trend + momentum + volume + structure
//   trend     = min(ADX/50, 1) * 2          → 0..2
//   momentum  = RSI + MACD + Stochastic     → 0..1
//   volume    = OBV + volume_ratio          → 0..1
//   structure = BB + VWAP + Ichimoku        → 0..1
//
// Рейтинги: ELITE ≥ 4.0, OPTIMAL ≥ 3.0, MODERATE ≥ 2.0, WEAK < 2.0

import * as ind from './indicators';
import type { Candle } from '../types/market';
import type { Rating } from '../types/signal';

export interface ZSSBreakdown {
  trend: number;
  momentum: number;
  volume: number;
  structure: number;
  // сырые индикаторы — для экрана «Подробнее»
  adx: number;
  rsi: number;
  stochK: number;
  macdHist: number;
  volumeRatio: number;
  vwapDiffPct: number;
  pctB: number;
  ichimokuBull: boolean;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function computeZSS(candles: Candle[]): { zss: number; b: ZSSBreakdown } | null {
  if (candles.length < 40) return null;
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const vols = candles.map((c) => c.volume);
  const price = closes[closes.length - 1];

  // ─── trend: ADX ───
  const adx = ind.adx(highs, lows, closes, 14);
  const trend = Math.min(adx / 50, 1) * 2;

  // ─── momentum ───
  const r = ind.rsi(closes, 14);
  const m = ind.macd(closes);
  const st = ind.stochastic(highs, lows, closes, 14);
  // RSI: перепроданность у нижней границы — потенциал роста
  const rsiScore = r < 30 ? 1 : r > 70 ? 0.2 : clamp01(1 - Math.abs(r - 45) / 45);
  // MACD: гистограмма выше нуля — бычий импульс
  const macdScore = m.hist > 0
    ? 0.5 + clamp01(Math.abs(m.hist) / price * 2000) * 0.5
    : clamp01(0.5 - Math.abs(m.hist) / price * 2000);
  // Стохастик: %K у дна — отскок
  const stochScore = st < 20 ? 1 : st > 80 ? 0.2 : clamp01(1 - Math.abs(st - 45) / 45);
  const momentum = (rsiScore + macdScore + stochScore) / 3;

  // ─── volume ───
  const obvArr = ind.obv(closes, vols);
  const win = Math.min(10, obvArr.length - 1);
  const obvRising = obvArr[obvArr.length - 1] > obvArr[obvArr.length - 1 - win];
  const vr = ind.volumeRatio(vols, 20);
  // OBV растёт + объём выше среднего → покупки идут
  const obvScore = obvRising ? 0.6 : 0.2;
  const volScore = vr > 1.5 ? 1 : vr > 1.0 ? 0.6 : 0.3;
  const volume = obvScore * 0.5 + volScore * 0.5;

  // ─── structure ───
  const bb = ind.bollinger(closes, 20, 2);
  const bbScore = bb.pctB < 0.05 ? 1 : bb.pctB > 0.95 ? 0.2 : clamp01(1 - Math.abs(bb.pctB - 0.4));
  const vw = ind.vwap(highs, lows, closes, vols);
  const vwapDiffPct = ((price - vw) / vw) * 100;
  const vwapScore = price < vw * 0.995 ? 1 : price > vw * 1.005 ? 0.3 : 0.6;
  const ichi = ind.ichimoku(highs, lows);
  const ichimokuBull = ichi.tenkan > ichi.kijun && price > ichi.kijun;
  const ichiScore = ichimokuBull ? 1 : 0.3;
  const structure = (bbScore + vwapScore + ichiScore) / 3;

  const zss = Math.round((trend + momentum + volume + structure) * 100) / 100;

  return {
    zss,
    b: {
      trend: Math.round(trend * 100) / 100,
      momentum: Math.round(momentum * 100) / 100,
      volume: Math.round(volume * 100) / 100,
      structure: Math.round(structure * 100) / 100,
      adx: Math.round(adx * 10) / 10,
      rsi: Math.round(r * 10) / 10,
      stochK: Math.round(st * 10) / 10,
      macdHist: m.hist,
      volumeRatio: Math.round(vr * 100) / 100,
      vwapDiffPct: Math.round(vwapDiffPct * 100) / 100,
      pctB: Math.round(bb.pctB * 100) / 100,
      ichimokuBull,
    },
  };
}

export function ratingFromZss(zss: number): Rating {
  if (zss >= 4.0) return 'ELITE';
  if (zss >= 3.0) return 'OPTIMAL';
  if (zss >= 2.0) return 'MODERATE';
  return 'WEAK';
}
