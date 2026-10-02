// 🎯 ОХОТА — ZSS-сигналы. Ручной скан + авто в открытой вкладке (физика PWA).
import MarketImporter from '../components/MarketImporter';
import { loadMarket } from '../core/marketStore';
import { scanTickers } from '../core/signalEngine';
import { useState, useEffect } from 'react';
import { useMarketData } from '../hooks/useMarketData';
import { usePortfolio } from '../hooks/usePortfolio';
import SignalCard from '../components/SignalCard';
import { TICKERS } from '../data/tickers';
import { parseManualHistory, manualClosesToCandles } from '../core/moexClient';
import type { Signal } from '../types/signal';

export default function HuntScreen() {
  const { bank } = usePortfolio();
  const [autoScan, setAutoScan] = useState(true);
  const { runScan, loading, error } = useMarketData();

  const [marketData, setMarketData] = useState(() => loadMarket());
  const [signals, setSignals] = useState<Signal[]>([]);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);

  const [manualTicker, setManualTicker] = useState('SBER');
  const [manualText, setManualText] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const todaySignals = signals
    .filter((s) => s.date === today)
    .sort((a, b) => b.zss - a.zss);

  // ─── ХЕЛПЕР: объединить по тикеру, не заменять ───
  const mergeSignals = (prev: Signal[], fresh: Signal[]): Signal[] => {
    const map = new Map(prev.map((s) => [s.ticker, s]));
    for (const s of fresh) {
      map.set(s.ticker, s);
    }
    return Array.from(map.values()).slice(0, 200);
  };

  // ---------------------------------------------------------------------------
  // АВТО-ПЕРЕСЧЁТ по marketStore (срабатывает при di:market-imported)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleImport = () => {
      const market = loadMarket();
      setMarketData(market);

      const withCandles = market.filter(
        (s) => s.candles && s.candles.length >= 40,
      );

      if (withCandles.length === 0) return;

      console.log(`[HUNT] Пересчёт ZSS: ${withCandles.length} тикеров`);

      const result = scanTickers(
        withCandles.map((s) => ({
          ticker: s.ticker,
          candles: s.candles!,
          lotSize: s.lotSize ?? 1,
        })),
        bank,
        signals,
      );

      setSignals((prev) => mergeSignals(prev, result.signals));
      setLastScanAt(result.scannedAt);

      console.log(
        `[HUNT] ZSS: ${result.signals.length} свежих` +
          (result.errors.length ? `, ошибок ${result.errors.length}` : ''),
      );
    };

    window.addEventListener('di:market-imported', handleImport);
    return () => window.removeEventListener('di:market-imported', handleImport);
  }, [bank, signals]);

  // ---------------------------------------------------------------------------
  // СКАН ЧЕРЕЗ API + marketStore
  // ---------------------------------------------------------------------------

  const handleScan = async () => {
    try {
      const tickers = TICKERS.map((t) => t.ticker);
      const result = await runScan(tickers, bank, signals);

      const market = loadMarket();
      const withCandles = market.filter(
        (s) => s.candles && s.candles.length >= 40,
      );

      if (withCandles.length > 0) {
        const zssResult = scanTickers(
          withCandles.map((s) => ({
            ticker: s.ticker,
            candles: s.candles!,
            lotSize: s.lotSize ?? 1,
          })),
          bank,
          signals,
        );

        setSignals((prev) => mergeSignals(prev, zssResult.signals));
        setLastScanAt(zssResult.scannedAt);

        console.log(
          `[HUNT] ZSS по marketStore: ${zssResult.signals.length} свежих`,
        );
      } else {
        setSignals((prev) => mergeSignals(prev, result.signals));
        setLastScanAt(result.scannedAt);
        console.log(`[HUNT] Скан API: ${result.signals.length} свежих`);
      }
    } catch (e) {
      console.error('[HUNT] Скан упал:', e);
    }
  };

  // ---------------------------------------------------------------------------
  // РУЧНОЙ СКАН
  // ---------------------------------------------------------------------------

  const handleManualScan = () => {
    try {
      setManualError(null);
      const closes = parseManualHistory(manualText);
      const candles = manualClosesToCandles(closes);

      console.log(`[MANUAL] ${manualTicker}: ${candles.length} candles`);

      import('../core/marketStore').then(({ attachCandles }) => {
        attachCandles(manualTicker.toUpperCase(), candles);
      });
    } catch (e) {
      setManualError(e instanceof Error ? e.message : String(e));
    }
  };

  // ---------------------------------------------------------------------------
  // ВХОД В ПОЗИЦИЮ
  // ---------------------------------------------------------------------------

  const enterPosition = (s: Signal) => {
    window.dispatchEvent(new CustomEvent('di:enter', { detail: s }));
    alert(
      `${s.ticker}: план входа — экран ТЕРМИНАЛ. Стоп ${s.stopLoss}, TP1 ${s.takeProfit1}.`,
    );
  };

  return (
    <div>
      <MarketImporter />

      <div className="section-title">
        🎯 Сканер · банк {bank.toLocaleString('ru-RU')} ₽
      </div>

      <div className="switch-row">
        <span>Авто-скан каждые 15 мин (вкладка открыта)</span>
        <input
          type="checkbox"
          checked={autoScan}
          onChange={(e) => setAutoScan(e.target.checked)}
        />
      </div>

      {error && <div className="banner banner-error">⚠️ {error}</div>}

      {!error && (
        <div className="banner banner-info">
          ZSS-источник: marketStore (CSV/буфер). API (T-Bank + MOEX) — дополнительно.
          Последний скан:{' '}
          {lastScanAt
            ? new Date(lastScanAt).toLocaleTimeString('ru-RU')
            : 'ещё не было'}
          .
        </div>
      )}

      <button
        className="btn btn-primary btn-large"
        disabled={loading}
        onClick={handleScan}
      >
        {loading ? 'Сканирую джунгли…' : '🐺 Просканировать (marketStore + API)'}
      </button>

      <div className="section-title">Или ручной ввод истории цен</div>

      <select
        className="input"
        value={manualTicker}
        onChange={(e) => setManualTicker(e.target.value)}
      >
        {TICKERS.map((t) => (
          <option key={t.ticker} value={t.ticker}>
            {t.ticker} — {t.name}
          </option>
        ))}
      </select>

      <textarea
        className="input"
        placeholder="Минимум 40 цен закрытия подряд, от старой к новой: 305.1 306.4 304.8 …"
        value={manualText}
        onChange={(e) => setManualText(e.target.value)}
      />

      {manualError && <div className="banner banner-error">{manualError}</div>}

      <button
        className="btn btn-large"
        disabled={loading}
        onClick={handleManualScan}
      >
        Сканировать вручную
      </button>

      <div className="section-title">
        Сигналы сегодня · {todaySignals.length}/7
      </div>

      {todaySignals.length === 0 && (
        <div className="empty">
          Тишина в джунглях. Это норма — большую часть времени правильное
          действие — ничего не делать.
        </div>
      )}

      {todaySignals.map((s) => (
        <SignalCard key={s.id} signal={s} onEnter={enterPosition} />
      ))}

      {/* Блок ЦЕН — из marketStore */}
      {marketData.length > 0 && (
        <>
          <div className="section-title">Цены</div>

          {marketData.map((s) => {
            const isStale = s.status === 'STALE';
            const asOfDate = new Date(s.asOf);
            const asOfLabel = asOfDate.toLocaleDateString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
            });

            return (
              <div
                key={s.ticker}
                className="card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  opacity: isStale ? 0.6 : 1,
                }}
              >
                <b>
                  {s.ticker}
                  <span
                    style={{
                      fontSize: 10,
                      marginLeft: 6,
                      color: s.source === 'TBANK' ? '#22c55e' : '#f59e0b',
                    }}
                  >
                    {s.source === 'TBANK'
                      ? '🟢 T-Bank'
                      : s.source === 'MOEX'
                        ? '🟡 MOEX'
                        : `📋 ${s.source}`}
                  </span>
                </b>
                <span>
                  {s.price.toFixed(2)} ₽
                  <span
                    style={{
                      fontSize: 11,
                      marginLeft: 8,
                      color: isStale
                        ? 'var(--color-warning, #f59e0b)'
                        : 'var(--color-muted, #888)',
                    }}
                    title={asOfDate.toLocaleString('ru-RU')}
                  >
                    {isStale ? `⚠️ ${asOfLabel}` : `на ${asOfLabel}`}
                  </span>
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}