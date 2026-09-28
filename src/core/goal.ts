// ЦЕЛЬ — куда идёт волк. Одна цель, как одна добыча.
// Прогноз считаем из реальной статистики ТРОФЕЕВ, не из фантазий.
// Принцип №7 ЧЕСТНОСТЬ: если статистики мало — честно говорим «пока неизвестно».

export interface Goal {
  targetAmount: number;     // цель в ₽
  deadline?: string;        // ISO дата (YYYY-MM-DD), опционально
  monthlyDeposit?: number;  // ежемесячный взнос, опционально
  createdAt: string;
}

export interface TradeStats {
  avgTradeReturnPct: number;  // средний результат сделки, % от банка
  tradesPerMonth: number;     // средняя частота сделок
  sampleSize: number;         // сколько сделок в статистике
}

export interface Scenario {
  key: 'pessimistic' | 'base' | 'optimistic';
  label: string;
  monthlyReturnPct: number;
  monthsToGoal: number | null;  // null = при таком темпе не дойти
  date: string | null;
  feasible: boolean;            // успевает к дедлайну (если задан)
}

export interface GoalReport {
  current: number;
  target: number;
  pct: number;             // прогресс 0..100+ (может быть >100)
  remaining: number;
  achieved: boolean;
  monthsLeft: number | null;      // до дедлайна
  enoughStats: boolean;           // ≥5 сделок для прогноза
  scenarios: Scenario[];
  onTrack: boolean | null;        // null = нет дедлайна или мало данных
}

const GOAL_KEY = 'di_goal_v1';
const MIN_TRADES_FOR_FORECAST = 5;

// ── Хранение ──────────────────────────────────────────────

export function loadGoal(): Goal | null {
  try {
    const raw = localStorage.getItem(GOAL_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as Goal;
    if (typeof g.targetAmount !== 'number' || g.targetAmount <= 0) return null;
    return g;
  } catch {
    return null;
  }
}

export function saveGoal(g: Omit<Goal, 'createdAt'>): void {
  const prev = loadGoal();
  localStorage.setItem(GOAL_KEY, JSON.stringify({
    ...g,
    createdAt: prev?.createdAt ?? new Date().toISOString(),
  }));
}

export function clearGoal(): void {
  localStorage.removeItem(GOAL_KEY);
}

// ── Статистика из ТРОФЕЕВ ─────────────────────────────────

/** Закрытые сделки: pnlPct — результат в % от банка на момент сделки. */
export function calcTradeStats(
  closedTrades: { pnlPct: number; closedAt: string }[],
): TradeStats {
  if (closedTrades.length === 0) {
    return { avgTradeReturnPct: 0, tradesPerMonth: 0, sampleSize: 0 };
  }
  const avg = closedTrades.reduce((s, t) => s + t.pnlPct, 0) / closedTrades.length;

  // Частота: сделки / месяцы от первой до последней (минимум 0.5 мес)
  const times = closedTrades.map((t) => new Date(t.closedAt).getTime()).sort((a, b) => a - b);
  const spanMonths = Math.max(0.5, (times[times.length - 1] - times[0]) / (30.44 * 24 * 3600 * 1000));
  const tradesPerMonth = closedTrades.length / spanMonths;

  return { avgTradeReturnPct: avg, tradesPerMonth, sampleSize: closedTrades.length };
}

// ── Математика прогноза ───────────────────────────────────

/** Месяцев до цели при сложном проценте r (доля, не %) и взносе deposit. */
function monthsToTarget(current: number, target: number, r: number, deposit: number): number | null {
  if (current >= target) return 0;
  if (r <= 0) return deposit > 0 ? Math.ceil((target - current) / deposit) : null;
  if (deposit > 0) {
    // V_n = (V0 + d/r)·(1+r)^n − d/r  →  решаем относительно n
    const n = Math.log((target + deposit / r) / (current + deposit / r)) / Math.log(1 + r);
    return Math.max(1, Math.ceil(n));
  }
  return Math.max(1, Math.ceil(Math.log(target / current) / Math.log(1 + r)));
}

// ── Полный отчёт ──────────────────────────────────────────

export function buildGoalReport(bank: number, goal: Goal, trades: { pnlPct: number; closedAt: string }[]): GoalReport {
  const pct = bank > 0 ? Math.round((bank / goal.targetAmount) * 1000) / 10 : 0;
  const achieved = bank >= goal.targetAmount;

  const deadline = goal.deadline ? new Date(goal.deadline) : null;
  const monthsLeft = deadline
    ? Math.max(0, (deadline.getTime() - Date.now()) / (30.44 * 24 * 3600 * 1000))
    : null;

  const stats = calcTradeStats(trades);
  const enoughStats = stats.sampleSize >= MIN_TRADES_FOR_FORECAST;

  // Базовый темп — реальная история. Пессимист/оптимист — коридор вокруг неё.
  // Потолок 15%/мес — защита от фантазий на маленькой выборке (честность №7).
  const baseMonthly = enoughStats
    ? Math.min(0.15, (stats.avgTradeReturnPct / 100) * stats.tradesPerMonth)
    : 0;
  const deposit = goal.monthlyDeposit ?? 0;

  const makeScenario = (key: Scenario['key'], label: string, monthlyPct: number): Scenario => {
    const m = monthsToTarget(bank, goal.targetAmount, monthlyPct, deposit);
    return {
      key, label,
      monthlyReturnPct: Math.round(monthlyPct * 1000) / 10,
      monthsToGoal: m,
      date: m !== null ? new Date(Date.now() + m * 30.44 * 24 * 3600 * 1000).toISOString().slice(0, 7) : null,
      feasible: monthsLeft !== null && m !== null ? m <= monthsLeft : true,
    };
  };

  const scenarios: Scenario[] = enoughStats
    ? [
        makeScenario('pessimistic', '🌧 Пессимист', Math.max(0, baseMonthly * 0.5)),
        makeScenario('base', '⚖️ Реальный темп', baseMonthly),
        makeScenario('optimistic', '🔥 Оптимист', Math.min(0.15, baseMonthly * 1.5 + 0.005)),
      ]
    : [];

  const base = scenarios[1];
  const onTrack = achieved ? true
    : !monthsLeft || !base ? null
    : base.monthsToGoal !== null && base.monthsToGoal <= monthsLeft;

  return {
    current: Math.round(bank * 100) / 100,
    target: goal.targetAmount,
    pct: Math.min(999, pct),
    remaining: Math.max(0, Math.round((goal.targetAmount - bank) * 100) / 100),
    achieved,
    monthsLeft: monthsLeft !== null ? Math.round(monthsLeft * 10) / 10 : null,
    enoughStats,
    scenarios,
    onTrack,
  };
}