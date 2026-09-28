// MOEX ISS клиент — CORS привязан к moex.com, поэтому идём через прокси.
// Fallback-цепочка: прямой → corsproxy.io → allorigins → ошибка (ручной ввод).
// Сигналы РФ: MOEX ISS публичный, без токена. Источник истины по акциям РФ.

import type { Candle } from '../types/market';

const MOEX_BASE = 'https://iss.moex.com';
const PROXIES = [
  (u: string) => u, // вдруг прямой заработает
  (u: string) => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
  (u: string) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
];

function candlesUrl(ticker: string, interval: number, count: number): string {
  return `${MOEX_BASE}/iss/engines/stock/markets/shares/boards/TQBR/securities/${ticker}/candles.json?interval=${interval}&count=${count}`;
}

interface MoexCandlesResp {
  candles: { columns: string[]; data: (string | number)[][] };
}

function parseCandles(resp: MoexCandlesResp): Candle[] {
  const cols = resp.candles.columns;
  const idx = {
    open: cols.indexOf('open'),
    close: cols.indexOf('close'),
    high: cols.indexOf('high'),
    low: cols.indexOf('low'),
    volume: cols.indexOf('volume'),
    begin: cols.indexOf('begin'),
  };
  return resp.candles.data.map((row) => ({
    time: String(row[idx.begin]),
    open: Number(row[idx.open]),
    high: Number(row[idx.high]),
    low: Number(row[idx.low]),
    close: Number(row[idx.close]),
    volume: Number(row[idx.volume]) || 0,
  }));
}

/** Тянем часовые свечи (interval=60) — минимум нужно ~40, берём 250 запас. */
export async function fetchCandles(ticker: string, count = 250): Promise<Candle[]> {
  const target = candlesUrl(ticker, 60, count);
  const errors: string[] = [];

  for (const wrap of PROXIES) {
    try {
      const res = await fetch(wrap(target), { signal: AbortSignal.timeout(12000) });
      if (!res.ok) { errors.push(`HTTP ${res.status}`); continue; }
      const data = (await res.json()) as MoexCandlesResp;
      const candles = parseCandles(data);
      if (candles.length < 40) { errors.push('мало свечей'); continue; }
      return candles;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(
    `MOEX недоступен (${errors.join(' / ')}). Переключись на ручной ввод истории цен.`,
  );
}

/** Парсер ручного ввода: «312.5 311 313.2 ...» или по строкам/запятым. Минимум 40 чисел. */
export function parseManualHistory(text: string): number[] {
  const nums = text
    .replace(/[\s,;]+/g, ' ')
    .trim()
    .split(' ')
    .map((s) => Number(s.replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length < 40) {
    throw new Error(`Нужно минимум 40 цен закрытия (по старой → новой). Сейчас: ${nums.length}`);
  }
  const closes = nums.slice(-250);
  // Синтезируем свечи: high/low ±0.3%, объём константный (ZSS по цене валиден)
  const now = Date.now();
  return closes.map((c, i) => c); // тело ниже соберёт свечи
}

export function manualClosesToCandles(closes: number[]): Candle[] {
  const now = Date.now();
  return closes.map((c, i) => ({
    time: new Date(now - (closes.length - i) * 3600_000).toISOString(),
    open: c,
    close: c,
    high: c * 1.003,
    low: c * 0.997,
    volume: 1000,
  }));
}
