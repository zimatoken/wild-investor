// Порт indicators.py из SOKOL-TRADER v0.6.2
// Чистые функции, без состояния. Вход — числовые массивы, выход — числа.

export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : NaN);
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/** RSI (Wilder, 14) — последнее значение */
export function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  let avgG = gain / period, avgL = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgL === 0) return 100;
  return 100 - 100 / (1 + avgG / avgL);
}

/** MACD: возвращает { macd, signal, hist } — последние значения */
export function macd(closes: number[]): { macd: number; signal: number; hist: number } {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const line = ema12.map((v, i) => v - ema26[i]);
  const sig = ema(line, 9);
  const last = closes.length - 1;
  return { macd: line[last], signal: sig[last], hist: line[last] - sig[last] };
}

/** Стохастик %K (14, 3) — последнее значение */
export function stochastic(highs: number[], lows: number[], closes: number[], k = 14): number {
  if (closes.length < k) return 50;
  const i = closes.length - 1;
  const hh = Math.max(...highs.slice(i - k + 1, i + 1));
  const ll = Math.min(...lows.slice(i - k + 1, i + 1));
  if (hh === ll) return 50;
  return ((closes[i] - ll) / (hh - ll)) * 100;
}

/** OBV и его наклон (сравнение окон last vs prev window) */
export function obv(closes: number[], volumes: number[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    const dir = closes[i] > closes[i - 1] ? 1 : closes[i] < closes[i - 1] ? -1 : 0;
    out.push(out[i - 1] + dir * volumes[i]);
  }
  return out;
}

/** ADX (Wilder, 14) — последнее значение, 0..100+ */
export function adx(highs: number[], lows: number[], closes: number[], period = 14): number {
  const n = closes.length;
  if (n < period * 2 + 1) return 0;
  const tr: number[] = [0];
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  for (let i = 1; i < n; i++) {
    const up = highs[i] - highs[i - 1];
    const down = lows[i - 1] - lows[i];
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    ));
  }
  let atr = 0, pdm = 0, mdm = 0;
  for (let i = 1; i <= period; i++) { atr += tr[i]; pdm += plusDM[i]; mdm += minusDM[i]; }
  atr /= period; pdm /= period; mdm /= period;
  let dxSum = 0;
  const dxCount = n - period - 1;
  for (let i = period + 1; i < n; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
    pdm = (pdm * (period - 1) + plusDM[i]) / period;
    mdm = (mdm * (period - 1) + minusDM[i]) / period;
    const pdi = atr === 0 ? 0 : (100 * pdm) / atr;
    const mdi = atr === 0 ? 0 : (100 * mdm) / atr;
    const denom = pdi + mdi;
    dxSum += denom === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / denom;
  }
  return dxCount <= 0 ? 0 : dxSum / Math.min(dxCount, period);
}

/** VWAP (typical price, кумулятивно) — последнее значение */
export function vwap(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
  let pv = 0, vv = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    pv += tp * volumes[i];
    vv += volumes[i];
  }
  return vv === 0 ? closes[closes.length - 1] : pv / vv;
}

/** Bollinger Bands (20, 2): { upper, middle, lower, pctB } — последние */
export function bollinger(closes: number[], period = 20, mult = 2): {
  upper: number; middle: number; lower: number; pctB: number;
} {
  const i = closes.length - 1;
  const win = closes.slice(Math.max(0, i - period + 1));
  const mid = win.reduce((a, b) => a + b, 0) / win.length;
  const sd = Math.sqrt(win.reduce((a, b) => a + (b - mid) ** 2, 0) / win.length);
  const upper = mid + mult * sd, lower = mid - mult * sd;
  const pctB = upper === lower ? 0.5 : (closes[i] - lower) / (upper - lower);
  return { upper, middle: mid, lower, pctB };  // ← ФИКС: middle = mid
}

/** Ichimoku: tenkan(9), kijun(26) — последние значения */
export function ichimoku(highs: number[], lows: number[]): { tenkan: number; kijun: number } {
  const hi = (p: number) => Math.max(...highs.slice(-p));
  const lo = (p: number) => Math.min(...lows.slice(-p));
  return { tenkan: (hi(9) + lo(9)) / 2, kijun: (hi(26) + lo(26)) / 2 };
}

/** Отношение текущего объёма к SMA объёмов */
export function volumeRatio(volumes: number[], period = 20): number {
  const i = volumes.length - 1;
  if (i < period) return 1;
  const avg = volumes.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
  return avg === 0 ? 1 : volumes[i] / avg;
}
