// Движок сигналов — фильтры, дедупликация, attention budget.
// Порт signal_engine.py: макс 7 actionable сигналов/день, 1 сигнал на тикер/день.

import { computeZSS, ratingFromZss } from './zss';
import { buildPositionPlan } from './positionSize';
import { RISK_RULES } from '../data/riskRules';
import type { Candle } from '../types/market';
import type { Signal } from '../types/signal';

export interface ScanResult {
  signals: Signal[];
  scannedAt: string;
  errors: string[];
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function scanTickers(
  snapshots: { ticker: string; candles: Candle[]; lotSize: number }[],
  bank: number,
  existingSignals: Signal[],
): ScanResult {
  const errors: string[] = [];
  const today = todayStr();
  const signals: Signal[] = [];
  let budgetLeft = RISK_RULES.maxSignalsPerDay;

  // Дедупликация: какие тикеры уже имеют сигнал сегодня
  const todayTickers = new Set(
    existingSignals.filter((s) => s.date === today).map((s) => s.ticker),
  );

  // Сортируем по ZSS-потенциалу — сначала сильнейшие (бюджет тратим на лучших)
  const computed = snapshots.map((snap) => {
    const res = computeZSS(snap.candles);
    return { snap, res };
  }).sort((a, b) => (b.res?.zss ?? 0) - (a.res?.zss ?? 0));

  for (const { snap, res } of computed) {
    if (budgetLeft <= 0) break;
    if (!res || res.zss < RISK_RULES.zssThreshold) continue;
    if (todayTickers.has(snap.ticker)) continue;

    const price = snap.candles[snap.candles.length - 1].close;
    const plan = buildPositionPlan(price, bank, snap.lotSize);
    if (plan.shares <= 0) {
      errors.push(`${snap.ticker}: банк ${bank}₽ слишком мал для лота`);
      continue;
    }

    signals.push({
      id: `di_${snap.ticker}_${today}`,
      ticker: snap.ticker,
      date: today,
      zss: res.zss,
      rating: ratingFromZss(res.zss),
      price,
      adx: res.b.adx,
      rsi: res.b.rsi,
      volumeRatio: res.b.volumeRatio,
      vwapDiffPct: res.b.vwapDiffPct,
      stopLoss: plan.stopLoss,
      takeProfit1: plan.takeProfit1,
      takeProfit2: plan.takeProfit2,
      positionPct: plan.positionPct,
      createdAt: new Date().toISOString(),
    });
    budgetLeft--;
  }

  return { signals, scannedAt: new Date().toISOString(), errors };
}
