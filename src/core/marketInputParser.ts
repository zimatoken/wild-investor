// ─────────────────────────────────────────────────────────────
// Парсер рыночных данных: буфер, CSV, TXT, Финам OHLCV.
// ─────────────────────────────────────────────────────────────
import type { ImportRow, ParseResult } from './marketDataTypes';

const TICKER_RE = /^[A-Z0-9][A-Z0-9.\-]{0,11}$/i;
const HEADER_WORDS = new Set([
  'инструмент', 'тикер', 'ticker', 'name', 'наименование', 'бумага',
  'цена', 'price', 'last', 'изм', 'изменение', 'change', 'оборот', 'volume', 'дата', 'time',
]);

// ─────────────────────────────────────────────────────────────
// ФИНАМ OHLCV
// ─────────────────────────────────────────────────────────────

export interface FinamCandle {
  ticker: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FinamParseResult {
  ticker: string;
  candles: FinamCandle[];
  errors: string[];
  rowsSeen: number;      // сколько OHLCV-строк было
  rowsAccepted: number;  // сколько прошло валидацию
}

/** OHLCV-строка: 9+ колонок, вторая = D/W/M */
function isOhlcvLine(cells: string[]): boolean {
  if (cells.length < 9) return false;   // ФИКС: было < 8
  const per = (cells[1] ?? '').toUpperCase();
  return per === 'D' || per === 'W' || per === 'M' || per === 'D1' || per === 'W1' || per === 'MN';
}

/** Реальная дата: 20261002 → 2026-10-02, с проверкой месяца/дня */
function finamDate(raw: string): string | null {
  if (!/^\d{8}$/.test(raw)) return null;
  const y = Number(raw.slice(0, 4));
  const m = Number(raw.slice(4, 6));
  const d = Number(raw.slice(6, 8));
  if (y < 2000 || y > 2100) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  // Проверка через Date — отсекает 31 февраля и т.п.
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

export function parseFinamOhlcv(text: string): FinamParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errors: string[] = [];
  const candles: FinamCandle[] = [];
  let ticker = '';
  let rowsSeen = 0;

  for (const line of lines) {
    if (line.startsWith('<') || line.toLowerCase().startsWith('ticker')) continue;

    const cells = line.split(/[;|,\t]+/).map((c) => c.trim());
    if (!isOhlcvLine(cells)) continue;

    rowsSeen++;

    try {
      const t = cells[0].toUpperCase();
      const date = finamDate(cells[2]);
      if (!date) continue;

      const open = Number(cells[4]);
      const high = Number(cells[5]);
      const low = Number(cells[6]);
      const close = Number(cells[7]);
      const volume = Number(cells[8]);

      if (!Number.isFinite(close) || close <= 0) continue;
      if (!Number.isFinite(open) || open <= 0) continue;
      if (!Number.isFinite(high) || high <= 0) continue;
      if (!Number.isFinite(low) || low <= 0) continue;
      if (high < low) continue;
      if (high < close || low > close) continue;
      if (high < open || low > open) continue;

      if (!ticker) ticker = t;
      candles.push({
        ticker: t, date, open, high, low, close,
        volume: Number.isFinite(volume) ? volume : 0,
      });
    } catch {
      // пропускаем
    }
  }

  candles.sort((a, b) => a.date.localeCompare(b.date));

  // КОНТРОЛЬНЫЙ ОТЧЁТ
  console.log(`[FINAM] rows seen: ${rowsSeen}, accepted: ${candles.length}, ticker: ${ticker}`);
  if (candles.length > 0) {
    const first = candles[0];
    const last = candles[candles.length - 1];
    console.log(`[FINAM] first: ${first.date} close=${first.close}`);
    console.log(`[FINAM] last:  ${last.date} close=${last.close}`);
    if (rowsSeen !== candles.length) {
      console.warn(`[FINAM] ⚠️ Потеряно строк: ${rowsSeen - candles.length}`);
    }
  }

  if (candles.length === 0) {
    errors.push('Финам CSV: не найдено ни одной валидной OHLCV-строки');
  }
  return { ticker, candles, errors, rowsSeen, rowsAccepted: candles.length };
}

/** "2,52B" → 2_520_000_000 */
export function parseNumber(raw: string): number | null {
  let s = raw.trim().replace(/[₽$€%\s]/g, '').replace(',', '.');
  if (!s) return null;
  const m = /([KMBКМВ])$/i.exec(s);
  if (m) s = s.slice(0, -1);
  let n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  const suf = m?.[1]?.toUpperCase();
  if (suf === 'K' || suf === 'К') n *= 1e3;
  if (suf === 'M' || suf === 'М') n *= 1e6;
  if (suf === 'B' || suf === 'В') n *= 1e9;
  return n;
}

function splitLine(line: string): string[] {
  if (/[\t;|]/.test(line)) return line.split(/[\t;|]+/).map((s) => s.trim());
  return line.split(/\s{2,}|\s+/).map((s) => s.trim()).filter(Boolean);
}

export function parseMarketTable(text: string): ParseResult {
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  const skipped: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const cells = splitLine(line);
    if (cells.length < 2) { skipped.push(line.slice(0, 40)); continue; }

    const ti = cells.findIndex((c) => TICKER_RE.test(c) && !HEADER_WORDS.has(c.toLowerCase()));
    if (ti < 0) { skipped.push(line.slice(0, 40)); continue; }

    const ticker = cells[ti].toUpperCase();
    if (HEADER_WORDS.has(ticker.toLowerCase())) { skipped.push(line.slice(0, 40)); continue; }

    const nums: number[] = [];
    for (const c of cells.slice(ti + 1)) {
      const n = parseNumber(c);
      if (n !== null) nums.push(n);
    }
    if (nums.length === 0) { skipped.push(line.slice(0, 40)); continue; }

    const price = nums[0];
    let changePct: number | undefined;
    let volume: number | undefined;

    for (const n of nums.slice(1)) {
      if (changePct === undefined && Math.abs(n) <= 60 && n !== price) changePct = n;
      else if (volume === undefined && n > 1000) volume = n;
    }
    rows.push({ ticker, price, changePct, volume });
  }

  if (rows.length === 0) {
    errors.push('Не распознано ни одной строки. Ожидается: ТИКЕР ЦЕНА [ИЗМ%] [ОБЪЁМ]');
  }
  return { rows, errors, skipped };
}

// ─────────────────────────────────────────────────────────────
// УНИВЕРСАЛЬНЫЙ ДЕТЕКТОР
// ─────────────────────────────────────────────────────────────

export interface UniversalParseResult extends ParseResult {
  finamCandles?: FinamCandle[];
  finamTicker?: string;
  finamStats?: { rowsSeen: number; accepted: number };
}

/**
 * ДЕТЕКТОР ФОРМАТА:
 * 1. Ищем первую непустую строку с 9+ колонками и D/W/M во второй.
 * 2. Если такая есть — это Финам OHLCV, даже если 1 свеча.
 * 3. Иначе — обычная таблица цен.
 */
export function parseMarketTableOrOhlcv(text: string): UniversalParseResult {
  // ШАГ 1: найти хоть одну OHLCV-строку
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let hasOhlcvLine = false;

  for (const line of lines) {
    if (line.startsWith('<') || line.toLowerCase().startsWith('ticker')) continue;
    const cells = line.split(/[;|,\t]+/).map((c) => c.trim());
    if (isOhlcvLine(cells)) { hasOhlcvLine = true; break; }
  }

  // ШАГ 2: если нашли — парсим как Финам (даже если 1 свеча)
  if (hasOhlcvLine) {
    const finam = parseFinamOhlcv(text);
    if (finam.candles.length > 0) {
      const last = finam.candles[finam.candles.length - 1];
      return {
        rows: [{
          ticker: last.ticker,
          price: last.close,
          volume: last.volume,
        }],
        errors: finam.errors,
        skipped: [],
        finamCandles: finam.candles,
        finamTicker: last.ticker,
        finamStats: { rowsSeen: finam.rowsSeen, accepted: finam.rowsAccepted },
      };
    }
  }

  // ШАГ 3: обычная таблица
  return parseMarketTable(text);
}

export function parseHistoryCloses(text: string): { closes: number[]; error?: string } {
  const nums = text
    .replace(/[\t;|]/g, ' ')
    .replace(/[\s]+/g, ' ')
    .trim()
    .split(' ')
    .map((s) => parseNumber(s))
    .filter((n): n is number => n !== null && n > 0);

  if (nums.length < 40) {
    return { closes: [], error: `Нужно минимум 40 цен (старые → новые). Распознано: ${nums.length}` };
  }
  return { closes: nums.slice(-250) };
}

export function validateImport(
  rows: ImportRow[],
  previous: { ticker: string; price: number }[],
): string[] {
  const warnings: string[] = [];
  const prevMap = new Map(previous.map((p) => [p.ticker, p.price]));
  for (const r of rows) {
    const prev = prevMap.get(r.ticker);
    if (prev && Math.abs(r.price - prev) / prev > 0.3) {
      warnings.push(`⚠️ ${r.ticker}: ${r.price} сильно отличается от прошлого ${prev} — проверь`);
    }
  }
  return warnings;
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsText(file, 'utf-8');
  });
}