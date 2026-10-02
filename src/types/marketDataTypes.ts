import type { Candle } from './market';

export type MarketSource =
  | 'TBANK' | 'MOEX'   // API-адаптеры (опционально, могут отсутствовать)
  | 'CSV' | 'XLSX'     // файлы
  | 'SCREENSHOT'       // OCR
  | 'MANUAL';          // ручной ввод

export type MarketStatus =
  | 'LIVE'        // живой API, свежее
  | 'IMPORTED'    // импортировано (буфер/файл), время известно
  | 'SCREENSHOT'  // распознано со скриншота
  | 'MANUAL'      // введено руками
  | 'STALE'       // данные старше 24ч — пометка, не блокировка
  | 'INVALID';    // не прошло валидацию — не показываем как цену

export interface MarketDataset {
  ticker: string;

  source: MarketSource;
  status: MarketStatus;

  candles: Candle[];

  name?: string;
  figi?: string;
  lotSize: number;

  lastPrice?: number;
  asOf?: string;
  lastTime?: string;   // legacy compatibility

  ageDays?: number;

  fetchedAt: string;

  error?: string;

  /**
   * true только если серия прошла все проверки:
   * - достаточная длина
   * - корректные цены
   * - freshness
   * - sanity check
   */
  validated: boolean;
}

export interface MarketSnapshot {
  ticker: string;

  source: MarketSource;
  status: MarketStatus;

  price: number;

  asOf: string;          // ISO — ВРЕМЯ ДАННЫХ, обязательно

  ageDays?: number;      // опционально для совместимости

  candlesCount?: number; // опционально для совместимости

  lotSize?: number;      // опционально для совместимости с marketStore

  fetchedAt?: string;    // опционально для совместимости с marketStore

  dataset?: MarketDataset; // опционально для совместимости с marketStore

  error?: string;

  changePct?: number;    // изменение за день, %
  volume?: number;       // в штуках/лотах
  candles?: Candle[];    // если есть история — движок считает ZSS
  name?: string;
  lastTime?: string;     // legacy compatibility
}

export interface MarketBatchResult {
  snapshots: MarketSnapshot[];

  valid: MarketSnapshot[];

  rejected: MarketSnapshot[];

  unavailable: MarketSnapshot[];

  startedAt: string;
  finishedAt: string;

  durationMs: number;

  total: number;
  validCount: number;
  rejectedCount: number;
  unavailableCount: number;
}

export function isUsableMarketData(
  snapshot: MarketSnapshot,
): boolean {
  const candlesCount =
    snapshot.candlesCount ??
    snapshot.candles?.length ??
    snapshot.dataset?.candles?.length ??
    0;

  const validated =
    snapshot.dataset?.validated ?? candlesCount >= 40;

  return (
    (
      snapshot.status === 'LIVE' ||
      snapshot.status === 'IMPORTED' ||
      snapshot.status === 'SCREENSHOT' ||
      snapshot.status === 'MANUAL'
    ) &&
    validated &&
    candlesCount >= 40 &&
    snapshot.price > 0
  );
}

export interface ImportRow {
  ticker: string;
  price: number;
  changePct?: number;
  volume?: number;
}

export interface ParseResult {
  rows: ImportRow[];
  errors: string[];
  skipped: string[];
}

export const STALE_AFTER_HOURS = 24;
