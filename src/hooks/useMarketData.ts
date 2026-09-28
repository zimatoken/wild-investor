// Сканер: авто-загрузка MOEX + ручной режим. Авто-скан раз в 15 мин только пока вкладка открыта.
import { useCallback, useEffect, useRef, useState } from 'react';
import { TICKERS } from '../data/tickers';
import { RISK_RULES } from '../data/riskRules';
import { fetchCandles, manualClosesToCandles } from '../core/moexClient';
import { scanTickers } from '../core/signalEngine';
import { addSignalsToLab } from '../core/lab';
import type { Candle, DataMode, MarketSnapshot } from '../types/market';
import type { Signal } from '../types/signal';

export interface ScanState {
  mode: DataMode;
  snapshots: MarketSnapshot[];
  signals: Signal[];
  scanning: boolean;
  lastScanAt: string | null;
  error: string | null;
}

const LS_STATE = 'di_scan_v1';

function loadPersisted(): { signals: Signal[]; snapshots: MarketSnapshot[]; lastScanAt: string | null } {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_STATE) ?? '{}');
    return {
      signals: raw.signals ?? [],
      snapshots: raw.snapshots ?? [],
      lastScanAt: raw.lastScanAt ?? null,
    };
  } catch {
    return { signals: [], snapshots: [], lastScanAt: null };
  }
}

export function useMarketData(bank: number, autoScan: boolean) {
  const persisted = useRef(loadPersisted());
  const [state, setState] = useState<ScanState>({
    mode: 'auto',
    snapshots: persisted.current.snapshots,
    signals: persisted.current.signals,
    scanning: false,
    lastScanAt: persisted.current.lastScanAt,
    error: null,
  });

  const persist = (signals: Signal[], snapshots: MarketSnapshot[], lastScanAt: string) => {
    localStorage.setItem(LS_STATE, JSON.stringify({ signals, snapshots, lastScanAt }));
  };

  const runScan = useCallback(async (mode: DataMode, manualData?: Record<string, number[]>) => {
    setState((s) => ({ ...s, scanning: true, error: null, mode }));
    try {
      let snapshots: MarketSnapshot[];
      if (mode === 'manual' && manualData) {
        snapshots = Object.entries(manualData).map(([ticker, closes]) => ({
          ticker,
          price: closes[closes.length - 1],
          candles: manualClosesToCandles(closes),
          fetchedAt: new Date().toISOString(),
          source: 'manual' as const,
        }));
      } else {
        const results = await Promise.allSettled(
          TICKERS.map(async (t) => ({
            ticker: t.ticker,
            candles: await fetchCandles(t.ticker),
            lotSize: t.lotSize,
          })),
        );
        snapshots = [];
        const errors: string[] = [];
        for (const r of results) {
          if (r.status === 'fulfilled') {
            snapshots.push({
              ticker: r.value.ticker,
              price: r.value.candles[r.value.candles.length - 1].close,
              candles: r.value.candles,
              fetchedAt: new Date().toISOString(),
              source: 'moex' as const,
            });
          }
        }
        const rejected = results.filter((r) => r.status === 'rejected');
        if (snapshots.length === 0 && rejected.length > 0) {
          const reason = rejected[0] as PromiseRejectedResult;
          throw new Error(reason.reason instanceof Error ? reason.reason.message : 'MOEX недоступен');
        }
      }

      const lotSizes: Record<string, number> = {};
      TICKERS.forEach((t) => { lotSizes[t.ticker] = t.lotSize; });
      const { signals, errors } = scanTickers(
        snapshots.map((s) => ({ ticker: s.ticker, candles: s.candles, lotSize: lotSizes[s.ticker] ?? 1 })),
        bank,
        state.signals,
      );
      const fresh = [...signals, ...state.signals].slice(0, 200);
      addSignalsToLab(signals);
      const now = new Date().toISOString();
      persist(fresh, snapshots, now);
      setState((s) => ({
        ...s,
        snapshots,
        signals: fresh,
        scanning: false,
        lastScanAt: now,
        error: errors.length ? errors.join('; ') : null,
      }));

      // ← Проверка SL/TP для открытых позиций
      try {
        const { getPositions } = await import('../core/portfolio');
        const { checkSLTP } = await import('../core/sltpChecker');
        const triggered = checkSLTP(getPositions(), snapshots);
        if (triggered.length > 0) {
          window.dispatchEvent(new CustomEvent('di:sltp-triggered', { detail: triggered }));
        }
      } catch (e) {
        console.warn('SL/TP check failed:', e);
      }

// ← Сообщаем всем экранам, что скан завершён
window.dispatchEvent(new CustomEvent('di:scan-done', { detail: { snapshots } }));
    } catch (e) {
      setState((s) => ({
        ...s,
        scanning: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, [bank, state.signals]);

  // Авто-скан: только открытая вкладка, физика PWA. Каждые 15 мин.
  useEffect(() => {
    if (!autoScan || state.mode !== 'auto') return;
    const id = setInterval(() => { void runScan('auto'); }, RISK_RULES.autoScanIntervalMin * 60_000);
    return () => clearInterval(id);
  }, [autoScan, state.mode, runScan]);

  return { ...state, runScan };
}
