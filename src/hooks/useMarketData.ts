// ============================================================================
// useMarketData.ts v3.0
// ДИКИЙ ИНВЕСТОР
//
// T-Bank = PRIMARY
// MOEX    = SECONDARY
// Manual  = EMERGENCY (остается отдельно)
//
// Batch: 5 групп
// Concurrency: 4
// Pause: 400 ms между группами
//
// Диагностика:
//   [TBANK]
//   [MOEX]
//   [CONFLICT]
//   [STATUS]
// ============================================================================

import {
  useCallback,
  useState,
} from 'react';

import type { Candle } from '../types/market';

import {
  fetchTBankCandles,
  resolveTBankInstrument,
} from '../core/tbankClient';

import {
  fetchMoexCandles,
} from '../core/moexClient';

import {
  scanTickers,
  type ScanResult,
} from '../core/signalEngine';

import type {
  MarketDataset,
  MarketSnapshot,
  MarketStatus,
} from '../types/marketDataTypes';
import { STALE_AFTER_HOURS } from '../types/marketDataTypes';

interface MarketBatchData extends MarketDataset {
  snapshots: MarketSnapshot[];
  requestedTickers: string[];
  loadedAt: string;
}

const BATCH_SIZE = 4;
const BATCHES = 5;
const BATCH_PAUSE_MS = 400;
const DEFAULT_COUNT = 250;

const T_BANK = 'TBANK';
const MOEX = 'MOEX';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, ms),
  );
}

function latestClose(
  candles: Candle[],
): number | null {
  if (!candles.length) return null;

  return candles[
    candles.length - 1
  ].close;
}

function conflictPct(
  a: number,
  b: number,
): number {
  if (!a || !b) return Infinity;

  return (
    Math.abs(a - b) /
    ((a + b) / 2)
  );
}

function makeSnapshot(
  ticker: string,
  candles: Candle[],
  source: 'TBANK' | 'MOEX',
  lotSize: number,
  name: string,
): MarketSnapshot {
  const last =
    candles[candles.length - 1];

  const ageHours =
    (Date.now() -
      new Date(last.time).getTime()) /
    3_600_000;

  const ageDays = ageHours / 24;

  const status: MarketStatus =
    ageHours <= STALE_AFTER_HOURS
      ? 'LIVE'
      : 'STALE';

  const dataset: MarketDataset = {
    ticker,
    source,
    status,
    candles,
    name,
    lotSize,
    lastPrice: last.close,
    asOf: last.time,
    lastTime: last.time,
    ageDays,
    fetchedAt: new Date().toISOString(),
    validated: candles.length >= 40 && last.close > 0,
  };

  return {
    ticker,
    source,
    status,
    price: last.close,
    asOf: last.time,
    lastTime: last.time,
    ageDays,
    candlesCount: candles.length,
    lotSize,
    fetchedAt: new Date().toISOString(),
    dataset,
  };
}

async function fetchOne(
  ticker: string,
  count: number,
): Promise<MarketSnapshot> {
  const t =
    ticker.trim().toUpperCase();

  console.log(
    `[STATUS] ${t}: запрос T-Bank`,
  );

  try {
    const tb =
      await fetchTBankCandles(
        t,
        count,
      );

    console.log(
      `[TBANK] ${t}: SUCCESS | candles=${tb.candles.length} | close=${tb.candles[tb.candles.length - 1].close}`,
    );

    const snapshot =
      makeSnapshot(
        t,
        tb.candles,
        T_BANK,
        tb.instrument.lotSize,
        tb.instrument.name,
      );

    console.log(
      `[STATUS] ${t}: T-Bank PRIMARY OK`,
    );

    // -------------------------------------------------------------------------
    // MOEX проверяем как secondary,
    // но НЕ используем его вместо T-Bank,
    // если T-Bank уже прошёл проверки.
    // -------------------------------------------------------------------------

    try {
      const moex =
        await fetchMoexCandles(
          t,
          count,
        );

      const tbClose =
        latestClose(tb.candles);

      const moexClose =
        latestClose(moex);

      if (
        tbClose !== null &&
        moexClose !== null
      ) {
        const diff =
          conflictPct(
            tbClose,
            moexClose,
          );

        if (diff > 0.03) {
          console.error(
            `[CONFLICT] ${t}: T-Bank=${tbClose.toFixed(
              2,
            )} MOEX=${moexClose.toFixed(
              2,
            )} diff=${(
              diff * 100
            ).toFixed(2)}%`,
          );
        } else {
          console.log(
            `[CONFLICT] ${t}: OK | diff=${(
              diff * 100
            ).toFixed(3)}%`,
          );
        }
      }
    } catch (moexError) {
      console.warn(
        `[MOEX] ${t}: secondary unavailable — ${
          moexError instanceof Error
            ? moexError.message
            : String(moexError)
        }`,
      );
    }

    return snapshot;
  } catch (tbError) {
    const tbMsg = tbError instanceof Error ? tbError.message : String(tbError);
    console.error(
      `[TBANK] ${t}: PRIMARY FAIL — ${tbMsg}`,
    );

    // -------------------------------------------------------------------------
    // FALLBACK
    // -------------------------------------------------------------------------

    console.log(
      `[MOEX] ${t}: REQUEST (secondary)`,
    );

    try {
      const candles =
        await fetchMoexCandles(
          t,
          count,
        );

      console.log(
        `[MOEX] ${t}: SUCCESS | candles=${candles.length} | ` +
        `last=${candles[candles.length - 1].time.slice(0, 10)} | ` +
        `close=${candles[candles.length - 1].close}`,
      );
      console.warn(
        `[STATUS] ${t}: SECONDARY / MOEX`,
      );

      return makeSnapshot(
        t,
        candles,
        MOEX,
        1,
        t,
      );
    } catch (moexError) {
      const moexMsg = moexError instanceof Error ? moexError.message : String(moexError);
      console.error(
        `[MOEX] ${t}: FAIL — ${moexMsg}`,
      );
      console.error(
        `[STATUS] ${t}: BOTH SOURCES FAILED`,
      );

      throw new Error(
        `${t}: T-Bank ${tbMsg}; MOEX ${moexMsg}`,
      );
    }
  }
}

async function fetchBatch(
  tickers: string[],
  count: number,
): Promise<{
  snapshots: MarketSnapshot[];
  errors: string[];
}> {
  const snapshots: MarketSnapshot[] = [];
  const errors: string[] = [];

  const results =
    await Promise.allSettled(
      tickers.map((ticker) =>
        fetchOne(ticker, count),
      ),
    );

  results.forEach(
    (result, index) => {
      const ticker =
        tickers[index];

      if (
        result.status ===
        'fulfilled'
      ) {
        snapshots.push(
          result.value,
        );
      } else {
        errors.push(
          `${ticker}: ${
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
          }`,
        );
      }
    },
  );

  return {
    snapshots,
    errors,
  };
}

export interface MarketScanResult
  extends ScanResult {
  dataset: MarketDataset;
}

export interface UseMarketDataResult {
  dataset: MarketBatchData | null;
  loading: boolean;
  error: string | null;

  scan: (
    tickers: string[],
    bank: number,
    existingSignals?: Parameters<
      typeof scanTickers
    >[2],
  ) => Promise<MarketScanResult>;

  // Compatibility alias:
  runScan: UseMarketDataResult['scan'];

  refresh: (
    tickers: string[],
  ) => Promise<MarketBatchData>;
}

export function useMarketData(): UseMarketDataResult {
  const [dataset, setDataset] =
    useState<MarketBatchData | null>(
      null,
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null,
    );

  const refresh =
    useCallback(
      async (
        tickers: string[],
      ): Promise<MarketBatchData> => {
        setLoading(true);
        setError(null);

        const unique =
          Array.from(
            new Set(
              tickers
                .map((x) =>
                  x.trim().toUpperCase(),
                )
                .filter(Boolean),
            ),
          ).slice(
            0,
            BATCHES * BATCH_SIZE,
          );

        console.log(
          `[STATUS] market scan START | ${unique.length} tickers`,
        );

        const snapshots: MarketSnapshot[] =
          [];

        const errors: string[] =
          [];

        try {
          for (
            let i = 0;
            i < unique.length;
            i += BATCH_SIZE
          ) {
            const batch =
              unique.slice(
                i,
                i + BATCH_SIZE,
              );

            const batchNo =
              Math.floor(
                i / BATCH_SIZE,
              ) + 1;

            console.log(
              `[STATUS] batch ${batchNo}/${BATCHES} | ${batch.join(
                ', ',
              )}`,
            );

            const result =
              await fetchBatch(
                batch,
                DEFAULT_COUNT,
              );

            snapshots.push(
              ...result.snapshots,
            );

            errors.push(
              ...result.errors,
            );

            // Пауза МЕЖДУ батчами.
            if (
              i + BATCH_SIZE <
                unique.length
            ) {
              await sleep(
                BATCH_PAUSE_MS,
              );
            }
          }

          const result: MarketBatchData = {
            ticker: 'BATCH',
            source: 'TBANK',
            status: errors.length === 0 ? 'LIVE' : snapshots.length > 0 ? 'STALE' : 'INVALID',
            candles: [],
            lotSize: 1,
            fetchedAt: new Date().toISOString(),
            validated: false,
            error: errors.length > 0 ? errors.join('; ') : undefined,
            snapshots,
            requestedTickers: unique,
            loadedAt: new Date().toISOString(),
          };

          setDataset(result);

          console.log(
            `[STATUS] market scan DONE | loaded=${snapshots.length}/${unique.length} | errors=${errors.length}`,
          );

          if (errors.length) {
            setError(
              `${errors.length} инструмент(ов) не загружено`,
            );
          }

          return result;
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  const scan =
    useCallback(
      async (
        tickers: string[],
        bank: number,
        existingSignals?: Parameters<typeof scanTickers>[2],
      ): Promise<MarketScanResult> => {
        const data =
          await refresh(tickers);

        const validSnapshots =
          data.snapshots.filter(
            (s: MarketSnapshot) => {
              const candlesCount =
                s.candlesCount ??
                s.candles?.length ??
                s.dataset?.candles?.length ??
                0;

              return (
                (
                  s.status === 'LIVE' ||
                  s.status === 'IMPORTED' ||
                  s.status === 'SCREENSHOT' ||
                  s.status === 'MANUAL'
                ) &&
                candlesCount >= 40
              );
            }
          );

        console.log(
          `[STATUS] signal scan | valid=${validSnapshots.length}/${data.snapshots.length}`,
        );

        const result =
          scanTickers(
            validSnapshots.map(
              (s: MarketSnapshot) => ({
                ticker: s.ticker,
                candles: s.dataset?.candles ?? s.candles ?? [],
                lotSize: s.lotSize ?? s.dataset?.lotSize ?? 1,
              }),
            ),
            bank,
            existingSignals ?? [],
          );

        return {
          ...result,
          dataset: data,
          errors: [
            ...(data.error ? [data.error] : []),
            ...result.errors,
          ],
        };
      },
      [refresh],
    );

  return {
    dataset,
    loading,
    error,
    scan,
    runScan: scan,
    refresh,
  };
}