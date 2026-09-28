// Правило 2% + 10% — УПРАВЛЯЙ РАЗМЕРОМ. Философия в коде, не в тексте.
import { RISK_RULES } from '../data/riskRules';

export interface PositionPlan {
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  positionPct: number;  // % от банка
  riskAmount: number;   // ₽ риска на сделку
  shares: number;       // сколько бумаг
}

/**
 * План входа:
 *  • стоп −2%, TP1 +3%, TP2 +5%
 *  • риск ≤ 2% банка (жёстко)
 *  • размер позиции ≤ 10% банка (жёстко)
 *
 * Двойное ограничение: правило 2% — про РИСК, правило 10% — про РАЗМЕР.
 * Без второго можно получить позицию в 100% банка при близком стопе.
 */
export function buildPositionPlan(entry: number, bank: number, lotSize = 1): PositionPlan {
  // Guard: некорректные входы → нулевой план, без Infinity/NaN
  if (!Number.isFinite(entry) || !Number.isFinite(bank) || entry <= 0 || bank <= 0) {
    return {
      entry: round2(entry || 0),
      stopLoss: 0,
      takeProfit1: 0,
      takeProfit2: 0,
      positionPct: 0,
      riskAmount: 0,
      shares: 0,
    };
  }

  const stopLoss = entry * (1 - RISK_RULES.stopLossPct);
  const takeProfit1 = entry * (1 + RISK_RULES.takeProfit1Pct);
  const takeProfit2 = entry * (1 + RISK_RULES.takeProfit2Pct);

  const riskPerShare = entry - stopLoss;              // ₽ риска на бумагу
  const maxRiskAmount = bank * (RISK_RULES.maxRiskPerTradePct / 100);

  // Ограничение 1: риск ≤ 2% банка
  const sharesByRisk = Math.floor(maxRiskAmount / riskPerShare);

  // Ограничение 2: размер позиции ≤ 10% банка
  const maxPositionValue = bank * (RISK_RULES.maxPositionPct / 100);
  const sharesByValue = Math.floor(maxPositionValue / entry);

  // Берём минимум из двух ограничений
  let shares = Math.min(sharesByRisk, sharesByValue);

  // Округление по лоту (вниз)
  shares = Math.max(0, Math.floor(shares / lotSize) * lotSize);

  const positionValue = shares * entry;
  const positionPct = bank > 0
    ? Math.round((positionValue / bank) * 1000) / 10
    : 0;
  const riskAmount = shares * riskPerShare;

  return {
    entry: round2(entry),
    stopLoss: round2(stopLoss),
    takeProfit1: round2(takeProfit1),
    takeProfit2: round2(takeProfit2),
    positionPct,
    riskAmount: round2(riskAmount),
    shares,
  };
}

const round2 = (x: number) => Math.round(x * 100) / 100;