// ============================================================================
// MOEX CLIENT v3.0 (secondary provider)
// ----------------------------------------------------------------------------
// Возвращает Candle[] — валидация в useMarketData
// Worker: https://di-proxy.01-zima54.workers.dev
// ============================================================================

import type { Candle } from '../types/market';

const CLOUDFLARE_WORKER = 'https://di-proxy.01-zima54.workers.dev';

const MOEX_BASE = 'https://iss.moex.com';

const FETCH_TIMEOUT_MS = 8000;

const MIN_CANDLES = 40;

interface MoexHistoryResp {
  history?: {
    columns: string[];
    data: (string | number | null)[][];
  };
}

interface MoexCandlesResp {
  candles?: {
    columns: string[];
    data: (string | number | null)[][];
  };
}

console.log(
  `[MOEX] client v3.0 | worker=${CLOUDFLARE_WORKER || 'НЕ ЗАДАН'}`,
);

// ============================================================================
// WORKER FETCH
// ============================================================================

async function workerFetch<T>(target: string): Promise<T> {
  if (!CLOUDFLARE_WORKER) {
    throw new Error('MOEX Worker не настроен');
  }

  const url =
    `${CLOUDFLARE_WORKER}/moex?url=` +
    encodeURIComponent(target) +
    `&_=${Date.now()}`;

  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = (await response.text()).slice(0, 300);
    throw new Error(`MOEX Worker HTTP ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

// ============================================================================
// URLS
// ============================================================================

function candlesUrl(ticker: string, count: number): string {
  return (
    `${MOEX_BASE}/iss/engines/stock/markets/shares/boards/TQBR/` +
    `securities/${encodeURIComponent(ticker)}/candles.json` +
    `?interval=24&count=${Math.min(count, 100)}`
  );
}

function historyUrl(ticker: string, count: number): string {
  const from = new Date(Date.now() - (count + 30) * 86400000)
    .toISOString()
    .slice(0, 10);

  const till = new Date().toISOString().slice(0, 10);

  return (
    `${MOEX_BASE}/iss/history/engines/stock/markets/shares/boards/TQBR/` +
    `securities/${encodeURIComponent(ticker)}.json` +
    `?from=${from}&till=${till}`
  );
}

// ============================================================================
// PARSERS
// ============================================================================

function parseCandles(response: MoexCandlesResp): Candle[] {
  const table = response.candles;

  if (!table) {
    throw new Error('MOEX candles: candles отсутствует');
  }

  const { columns, data } = table;

  const idx = {
    open: columns.indexOf('open'),
    high: columns.indexOf('high'),
    low: columns.indexOf('low'),
    close: columns.indexOf('close'),
    volume: columns.indexOf('volume'),
    begin: columns.indexOf('begin'),
  };

  if (idx.begin < 0 || idx.close < 0) {
    throw new Error(
      `MOEX candles: нет begin/close. Колонки: ${columns.join(', ')}`,
    );
  }

  return data
    .map((row) => {
      const rawTime = row[idx.begin];
      if (rawTime == null) return null;

      const raw = String(rawTime);
      const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;

      return {
        time: new Date(iso).toISOString(),
        open: Number(row[idx.open] ?? 0),
        high: Number(row[idx.high] ?? 0),
        low: Number(row[idx.low] ?? 0),
        close: Number(row[idx.close] ?? 0),
        volume: Number(row[idx.volume] ?? 0),
      } as Candle;
    })
    .filter((c): c is Candle => c !== null)
    .sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );
}

function parseHistory(response: MoexHistoryResp): Candle[] {
  const table = response.history;

  if (!table) {
    throw new Error('MOEX history: history отсутствует');
  }

  const { columns, data } = table;

  const idx = {
    date: columns.indexOf('TRADEDATE'),
    open: columns.indexOf('OPEN'),
    high: columns.indexOf('HIGH'),
    low: columns.indexOf('LOW'),
    close: columns.indexOf('CLOSE'),
    volume: columns.indexOf('VOLUME'),
  };

  if (idx.date < 0 || idx.close < 0) {
    throw new Error(
      `MOEX history: нет TRADEDATE/CLOSE. Колонки: ${columns.join(', ')}`,
    );
  }

  return data
    .map((row) => {
      const rawDate = row[idx.date];
      if (rawDate == null || row[idx.close] == null) return null;

      const date = String(rawDate);

      return {
        time: new Date(
          date.includes('T') ? date : `${date}T00:00:00Z`,
        ).toISOString(),
        open: Number(row[idx.open] ?? 0),
        high: Number(row[idx.high] ?? 0),
        low: Number(row[idx.low] ?? 0),
        close: Number(row[idx.close] ?? 0),
        volume: Number(row[idx.volume] ?? 0),
      } as Candle;
    })
    .filter((c): c is Candle => c !== null)
    .sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function fetchMoexCandles(
  ticker: string,
  count = 250,
): Promise<Candle[]> {
  const t = ticker.toUpperCase();

  if (!CLOUDFLARE_WORKER) {
    throw new Error('MOEX Worker не настроен');
  }

  const attempts = [
    {
      name: 'candles',
      url: candlesUrl(t, count),
      parser: (r: MoexCandlesResp) => parseCandles(r),
    },
    {
      name: 'history',
      url: historyUrl(t, count),
      parser: (r: MoexHistoryResp) => parseHistory(r),
    },
  ];

  const errors: string[] = [];

  for (const attempt of attempts) {
    try {
      console.log(`[MOEX] ${t}: пробуем ${attempt.name}`);

      const response = await workerFetch<MoexCandlesResp & MoexHistoryResp>(
        attempt.url,
      );

      const candles = attempt.parser(response);

      if (candles.length < MIN_CANDLES) {
        errors.push(
          `${attempt.name}: мало свечей (${candles.length})`,
        );
        continue;
      }

      console.log(
        `[MOEX] ${t}: OK | ${candles.length} свечей | ` +
          `last=${candles[candles.length - 1].time.slice(0, 10)}`,
      );

      return candles;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${attempt.name}: ${message}`);
      console.warn(`[MOEX] ${t}: ${attempt.name} FAIL — ${message}`);
    }
  }

  throw new Error(`MOEX ${t}: ${errors.join(' / ')}`);
}

// ============================================================================
// MANUAL EMERGENCY
// ============================================================================

export function parseManualHistory(text: string): number[] {
  const nums = text
    .replace(/[\s,;]+/g, ' ')
    .trim()
    .split(' ')
    .map((v) => Number(v.replace(',', '.')))
    .filter((v) => Number.isFinite(v) && v > 0);

  if (nums.length < MIN_CANDLES) {
    throw new Error(
      `Нужно минимум ${MIN_CANDLES} цен закрытия. Сейчас: ${nums.length}`,
    );
  }

  return nums.slice(-250);
}

export function manualClosesToCandles(closes: number[]): Candle[] {
  const now = Date.now();

  return closes.map((close, index) => ({
    time: new Date(
      now - (closes.length - index) * 86400000,
    ).toISOString(),
    open: close,
    high: close * 1.003,
    low: close * 0.997,
    close,
    volume: 1000,
  }));
}