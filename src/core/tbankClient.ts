// ============================================================================
// tbankClient.ts v3.1 — Apps Script relay
// ----------------------------------------------------------------------------
// Вместо Cloudflare Worker (526) — Google Apps Script релей
// Apps Script использует validateHttpsCertificates: false
// ============================================================================

import type { Candle } from '../types/market';

// ← ЗАМЕНИТЬ на твой Apps Script URL после деплоя
const RELAY_URL = 'https://script.google.com/macros/s/ТВОЙ_ID/exec';

const FETCH_TIMEOUT_MS = 10_000;
const MIN_CANDLES = 40;

interface TBankQuotation {
  units?: string | number;
  nano?: number;
}

interface TBankCandle {
  time: string;
  open: TBankQuotation;
  high: TBankQuotation;
  low: TBankQuotation;
  close: TBankQuotation;
  volume?: string | number;
}

interface TBankCandlesResponse {
  candles?: TBankCandle[];
}

interface TBankShareResponse {
  share?: {
    figi?: string;
    uid?: string;
    name?: string;
    ticker?: string;
    classCode?: string;
    lot?: number;
  };
}

export interface TBankInstrument {
  ticker: string;
  name: string;
  figi: string;
  uid: string;
  lotSize: number;
  classCode: string;
}

export interface TBankResult {
  ticker: string;
  candles: Candle[];
  instrument: TBankInstrument;
  fetchedAt: string;
  source: 'tbank';
}

function price(q?: TBankQuotation): number {
  if (!q) return 0;
  return Number(q.units ?? 0) + Number(q.nano ?? 0) / 1_000_000_000;
}

async function relayPost<T>(
  action: string,
  body: Record<string, unknown>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    FETCH_TIMEOUT_MS,
  );

  try {
    const response = await fetch(RELAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Apps Script требует text/plain для CORS
      },
      body: JSON.stringify({ action, body }),
      signal: controller.signal,
    });

    const text = await response.text();

    let data: { ok?: boolean; status?: number; data?: T; error?: string };

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `[RELAY] non-JSON HTTP ${response.status}: ${text.slice(0, 250)}`,
      );
    }

    if (data.error) {
      throw new Error(`[RELAY] ${action}: ${data.error}`);
    }

    if (!data.ok || !data.data) {
      throw new Error(
        `[RELAY] ${action}: HTTP ${data.status ?? response.status}`,
      );
    }

    return data.data as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function resolveTBankInstrument(
  ticker: string,
): Promise<TBankInstrument> {
  const t = ticker.trim().toUpperCase();

  const response = await relayPost<TBankShareResponse>('share', {
    idType: 'INSTRUMENT_ID_TYPE_TICKER',
    classCode: 'TQBR',
    id: t,
  });

  if (!response.share) {
    throw new Error(`[TBANK] ${t}: ShareBy не вернул инструмент`);
  }

  const share = response.share;

  return {
    ticker: share.ticker ?? t,
    name: share.name ?? t,
    figi: share.figi ?? '',
    uid: share.uid ?? '',
    lotSize: Number(share.lot ?? 1) || 1,
    classCode: share.classCode ?? 'TQBR',
  };
}

export async function fetchTBankCandles(
  ticker: string,
  count = 250,
): Promise<TBankResult> {
  const t = ticker.trim().toUpperCase();

  if (!t) {
    throw new Error('[TBANK] Пустой ticker');
  }

  const safeCount = Math.min(Math.max(count, MIN_CANDLES), 2400);
  const instrument = await resolveTBankInstrument(t);

  const to = new Date();
  const from = new Date(
    Date.now() - Math.max(safeCount + 20, 60) * 24 * 60 * 60 * 1000,
  );

  console.log(`[TBANK] ${t}: GetCandles ${safeCount}D via Apps Script`);

  const response = await relayPost<TBankCandlesResponse>('candles', {
    from: from.toISOString(),
    to: to.toISOString(),
    interval: 'CANDLE_INTERVAL_DAY',
    instrumentId: `${t}_TQBR`,
    candleSourceType: 'CANDLE_SOURCE_EXCHANGE',
    limit: safeCount,
  });

  const raw = response.candles ?? [];

  const candles: Candle[] = raw
    .map((c) => {
      const open = price(c.open);
      const high = price(c.high);
      const low = price(c.low);
      const close = price(c.close);

      if (!Number.isFinite(close) || close <= 0) return null;

      return {
        time: new Date(c.time).toISOString(),
        open,
        high,
        low,
        close,
        volume: Number(c.volume ?? 0),
      };
    })
    .filter((c): c is Candle => c !== null)
    .sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );

  if (candles.length < MIN_CANDLES) {
    throw new Error(
      `[TBANK] ${t}: недостаточно свечей (${candles.length}/${MIN_CANDLES})`,
    );
  }

  const last = candles[candles.length - 1];
  const ageDays =
    (Date.now() - new Date(last.time).getTime()) / 86_400_000;

  console.log(
    `[TBANK] ${t}: OK | candles=${candles.length} | last=${last.time.slice(0, 10)} | close=${last.close.toFixed(2)} | age=${ageDays.toFixed(2)}d`,
  );

  return {
    ticker: t,
    candles,
    instrument,
    fetchedAt: new Date().toISOString(),
    source: 'tbank',
  };
}