// ─────────────────────────────────────────────────────────────
// Импорт рынка за 5 секунд: буфер / CSV / TXT.
// OCR временно отключён — фокус на Finam CSV → ZSS.
// ─────────────────────────────────────────────────────────────
import { useRef, useState } from 'react';
import {
  parseMarketTableOrOhlcv, parseHistoryCloses, validateImport, readFileAsText,
} from '../core/marketInputParser';
import { applyImport, attachCandles, loadMarket } from '../core/marketStore';
import { manualClosesToCandles } from '../core/moexClient';
import type { ImportRow, MarketSnapshot } from '../core/marketDataTypes';

type Mode = 'table' | 'history';

interface Props {
  knownTickers?: string[];
}

export default function MarketImporter({ knownTickers = [] }: Props) {
  const [mode, setMode] = useState<Mode>('table');
  const [text, setText] = useState('');
  const [historyTicker, setHistoryTicker] = useState(knownTickers[0] ?? 'SBER');
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showStatus = (type: 'ok' | 'error', text: string) => {
    setStatus({ type, text });
    setTimeout(() => setStatus(null), 8000);
  };

  const runTableImport = (raw: string, source: MarketSnapshot['source'] = 'CSV') => {
    const result = parseMarketTableOrOhlcv(raw);

    // ── ФИНАМ OHLCV ──
    if (result.finamCandles && result.finamCandles.length > 0 && result.finamTicker) {
      const candles = result.finamCandles.map((c) => ({
        time: new Date(`${c.date}T00:00:00Z`).toISOString(),
        open: c.open, high: c.high, low: c.low, close: c.close,
        volume: c.volume,
      }));
      const last = candles[candles.length - 1];
      const ticker = result.finamTicker;

      applyImport([{
        ticker,
        price: last.close,
        volume: last.volume,
      }], source);

      attachCandles(ticker, candles);

      setPreview([{
        ticker,
        price: last.close,
        volume: last.volume,
      }]);
      setWarnings([]);

      const stats = result.finamStats;
      const lossMsg = stats && stats.rowsSeen !== stats.accepted
        ? ` ⚠️ потеряно ${stats.rowsSeen - stats.accepted}`
        : '';

      showStatus('ok',
        `✅ ${ticker}: ${candles.length} свечей OHLCV` +
        (stats ? ` (rows: ${stats.rowsSeen} → accepted: ${stats.accepted})` : '') +
        lossMsg +
        ` — ZSS готов`
      );
      return;
    }

    // ── ПРОСТАЯ ТАБЛИЦА ──
    if (result.rows.length === 0) {
      showStatus('error', result.errors[0] ?? 'Ничего не распознано');
      return;
    }
    const warns = validateImport(result.rows, loadMarket());
    setPreview(result.rows);
    setWarnings(warns);
    applyImport(result.rows, source);
    showStatus('ok',
      `✅ Импортировано ${result.rows.length} тикеров` +
      (result.skipped.length ? ` (пропущено строк: ${result.skipped.length})` : ''));
  };

  const runHistoryImport = (raw: string) => {
    const { closes, error } = parseHistoryCloses(raw);
    if (error) { showStatus('error', error); return; }
    attachCandles(historyTicker.toUpperCase(), manualClosesToCandles(closes));
    setPreview([]);
    showStatus('ok', `✅ ${historyTicker.toUpperCase()}: ${closes.length} цен — можно сканировать (ZSS)`);
  };

  const handleParse = () => {
    if (!text.trim()) { showStatus('error', 'Вставь данные или загрузи файл'); return; }
    mode === 'table' ? runTableImport(text, 'CSV') : runHistoryImport(text);
  };

  const handlePaste = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) { showStatus('error', 'Буфер пуст'); return; }
      setText(clip);
      mode === 'table' ? runTableImport(clip, 'CSV') : runHistoryImport(clip);
    } catch {
      showStatus('error', 'Браузер не дал доступ к буферу — вставь вручную (Ctrl+V)');
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await readFileAsText(file);
      setText(content);
      mode === 'table' ? runTableImport(content, 'CSV') : runHistoryImport(content);
    } catch (err) {
      showStatus('error', err instanceof Error ? err.message : 'Ошибка чтения файла');
    }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <b>📥 Импорт рынка · 5 секунд</b>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`btn ${mode === 'table' ? 'btn-primary' : ''}`} onClick={() => setMode('table')}>Финам CSV / Таблица</button>
          <button className={`btn ${mode === 'history' ? 'btn-primary' : ''}`} onClick={() => setMode('history')}>История тикера</button>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--subtext)', margin: '8px 0' }}>
        {mode === 'table'
          ? 'Финам CSV (OHLCV) — 📁 CSV/TXT. Или таблица ТИКЕР ЦЕНА [ИЗМ%] [ОБЪЁМ] — 📋 Вставить'
          : `40+ цен закрытия (старые → новые) для ${historyTicker.toUpperCase()} — ZSS-сигнал`}
      </p>

      {mode === 'history' && (
        <input
          className="input"
          style={{ marginBottom: 8 }}
          placeholder="Тикер (например GAZP)"
          value={historyTicker}
          onChange={(e) => setHistoryTicker(e.target.value.toUpperCase())}
        />
      )}

      <textarea
        className="input"
        style={{ minHeight: 80, marginBottom: 8 }}
        placeholder={mode === 'table'
          ? 'SBER;D;20261002;000000;276.18;276.5;275.86;276.43;321460\nили SBER 272,45 +0,98% 3,72B'
          : '305.1 306.4 304.8 ...'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handlePaste}>📋 Вставить из буфера</button>
        <button className="btn" onClick={handleParse}>✔️ Распарсить</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>📁 CSV/TXT</button>
      </div>

      <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />

      {status && (
        <div className={`banner banner-${status.type === 'ok' ? 'info' : 'error'}`} style={{ marginTop: 10 }}>
          {status.text}
        </div>
      )}

      {preview.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          {preview.slice(0, 10).map((r) => (
            <div key={r.ticker} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border, #222)' }}>
              <b>{r.ticker}</b>
              <span>{r.price.toLocaleString('ru-RU')} ₽{r.changePct !== undefined && ` · ${r.changePct > 0 ? '+' : ''}${r.changePct}%`}</span>
            </div>
          ))}
        </div>
      )}

      {warnings.map((w) => (
        <div key={w} className="banner banner-error" style={{ marginTop: 8 }}>{w}</div>
      ))}
    </div>
  );
}