// ─────────────────────────────────────────────────────────────
// Хранилище рыночного слоя. Единая точка правды для «ЦЕН»:
// импорт (CSV/буфер/скрин) + API-адаптеры, если живы.
// Ключ di_market_v1 — добавь его в DI_KEYS dataTransfer.ts!
// ─────────────────────────────────────────────────────────────
import type { MarketSnapshot, ImportRow, MarketStatus } from './marketDataTypes';
import { STALE_AFTER_HOURS } from './marketDataTypes';

const MARKET_KEY = 'di_market_v1';

export function loadMarket(): MarketSnapshot[] {
  try {
    const raw = localStorage.getItem(MARKET_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as MarketSnapshot[];
    const now = Date.now();
    return arr.map((s) => ({
      ...s,
      status: staleStatus(s.status, s.asOf, now),
    }));
  } catch {
    return [];
  }
}

function staleStatus(status: MarketStatus, asOf: string, now: number): MarketStatus {
  if (status === 'INVALID') return status;
  const ageH = (now - new Date(asOf).getTime()) / 3_600_000;
  return ageH > STALE_AFTER_HOURS ? 'STALE' : status;
}

export function saveMarket(snapshots: MarketSnapshot[]): void {
  localStorage.setItem(MARKET_KEY, JSON.stringify(snapshots.slice(0, 200)));
}

/** Слить импортированные строки в хранилище: новые перезаписывают старые по тикеру */
export function applyImport(rows: ImportRow[], source: MarketSnapshot['source']): MarketSnapshot[] {
  const now = new Date().toISOString();
  const existing = loadMarket();
  const map = new Map(existing.map((s) => [s.ticker, s]));

  for (const r of rows) {
    map.set(r.ticker, {
      ticker: r.ticker,
      price: r.price,
      changePct: r.changePct,
      volume: r.volume,
      asOf: now,
      source,
      status: source === 'SCREENSHOT' ? 'SCREENSHOT' : 'IMPORTED',
    });
  }

  const merged = [...map.values()];
  saveMarket(merged);
  window.dispatchEvent(new CustomEvent('di:market-imported', { detail: merged }));
  return merged;
}

/** Обновить снапшот историей свечей (для ZSS после ручного ввода истории) */
export function attachCandles(ticker: string, candles: MarketSnapshot['candles']): MarketSnapshot[] {
  const existing = loadMarket();
  const idx = existing.findIndex((s) => s.ticker === ticker);
  if (idx >= 0 && candles) {
    existing[idx] = { ...existing[idx], candles, asOf: candles[candles.length - 1].time };
  } else if (candles) {
    existing.push({
      ticker,
      price: candles[candles.length - 1].close,
      asOf: candles[candles.length - 1].time,
      source: 'MANUAL',
      status: 'MANUAL',
      candles,
    });
  }
  saveMarket(existing);
  window.dispatchEvent(new CustomEvent('di:market-imported', { detail: existing }));
  return existing;
}
