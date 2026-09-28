// Правила риска — из Саркофага ДИ: философия в коде, а не в тексте
export const RISK_RULES = {
  maxRiskPerTradePct: 2,      // ЗНАЙ РИСК: максимум 2% банка на сделку
  maxPositionPct: 10,         // ← НОВОЕ: размер позиции ≤ 10% банка
  maxSignalsPerDay: 7,        // attention budget — ЖДИ СИГНАЛ
  zssThreshold: 2.0,          // MODERATE и выше — сигнал actionable
  stopLossPct: 0.02,          // стоп −2% от входа
  takeProfit1Pct: 0.03,       // TP1 +3%
  takeProfit2Pct: 0.05,       // TP2 +5%
  autoScanIntervalMin: 15,    // авто-скан каждые 15 мин (только открытая вкладка)
} as const;

export type RiskRules = typeof RISK_RULES;