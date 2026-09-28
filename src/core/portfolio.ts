// Портфель — позиции, SL/TP, P&L (порт portfolio.py, JSON в localStorage).
// ВАЖНО: open резервирует, close возвращает + реализует P&L. Банк меняется сделками.

import type { Position } from '../types/position';

const POS_KEY = 'di_portfolio_v1';
const BANK_KEY = 'di_bank_v1';

function loadPositions(): Position[] {
  try {
    return JSON.parse(localStorage.getItem(POS_KEY) ?? '[]') as Position[];
  } catch {
    return [];
  }
}

function savePositions(positions: Position[]): void {
  localStorage.setItem(POS_KEY, JSON.stringify(positions));
}

function readBank(): number {
  return Number(localStorage.getItem(BANK_KEY) ?? 100000);
}

function writeBank(value: number): void {
  localStorage.setItem(BANK_KEY, String(Math.round(value * 100) / 100));
}

/** Прочитать текущий банк (в рублях). */
export function getBank(): number {
  return readBank();
}

/** Установить банк вручную. */
export function setBank(value: number): void {
  writeBank(value);
}

export function getPositions(): Position[] {
  return loadPositions().sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

/**
 * Открыть позицию.
 * Банк НЕ уменьшается: позиция считается «внутри» банка, а не резервируется отдельно.
 * Так проще для пользователя: банк = весь капитал, позиции = часть банка.
 */
export function openPosition(
  p: Omit<Position, 'id' | 'status' | 'closedAt' | 'closePrice' | 'pnl'>,
): Position {
  const positions = loadPositions();
  const pos: Position = {
    ...p,
    id: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    status: 'open',
    closedAt: null,
    closePrice: null,
    pnl: null,
  };
  positions.push(pos);
  savePositions(positions);
  return pos;
}

/**
 * Закрыть позицию.
 * Реализованный P&L прибавляется к банку.
 */
export function closePosition(id: string, closePrice: number): Position | null {
  const positions = loadPositions();
  const p = positions.find((x) => x.id === id && x.status === 'open');
  if (!p) return null;

  p.status = 'closed';
  p.closedAt = new Date().toISOString();
  p.closePrice = closePrice;
  p.pnl = Math.round((closePrice - p.entryPrice) * p.qty * 100) / 100;

  savePositions(positions);

  // ← КЛЮЧЕВОЕ: реализованный P&L прибавляется к банку
  if (p.pnl !== null) {
    const bank = readBank();
    writeBank(bank + p.pnl);
  }

  return p;
}

/** P&L открытых позиций по текущим ценам. */
export function openPnl(
  positions: Position[],
  prices: Record<string, number>,
): {
  totalPnl: number;
  totalPnlPct: number;
  invested: number;
} {
  const open = positions.filter((p) => p.status === 'open');
  let pnl = 0;
  let invested = 0;
  for (const p of open) {
    const px = prices[p.ticker];
    if (!px) continue;
    invested += p.entryPrice * p.qty;
    pnl += (px - p.entryPrice) * p.qty;
  }
  return {
    totalPnl: Math.round(pnl * 100) / 100,
    totalPnlPct: invested > 0 ? Math.round((pnl / invested) * 1000) / 10 : 0,
    invested: Math.round(invested * 100) / 100,
  };
}