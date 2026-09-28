// 🎯 ОХОТА — ZSS-сигналы. Ручной скан + авто в открытой вкладке (физика PWA).
import { useState } from 'react';
import { useMarketData } from '../hooks/useMarketData';
import { usePortfolio } from '../hooks/usePortfolio';
import SignalCard from '../components/SignalCard';
import { TICKERS } from '../data/tickers';
import { parseManualHistory } from '../core/moexClient';
import type { Signal } from '../types/signal';

export default function HuntScreen() {
  const { bank } = usePortfolio();
  const [autoScan, setAutoScan] = useState(true);
  const { snapshots, signals, scanning, lastScanAt, error, mode, runScan } = useMarketData(bank, autoScan);
  const [manualTicker, setManualTicker] = useState('SBER');
  const [manualText, setManualText] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const todaySignals = signals.filter((s) => s.date === today).sort((a, b) => b.zss - a.zss);

  const handleManualScan = () => {
    try {
      setManualError(null);
      const closes = parseManualHistory(manualText);
      runScan('manual', { [manualTicker]: closes });
    } catch (e) {
      setManualError(e instanceof Error ? e.message : String(e));
    }
  };

  const enterPosition = (s: Signal) => {
    // Переход в Терминал через кастомное событие (без роутера)
    window.dispatchEvent(new CustomEvent('di:enter', { detail: s }));
    alert(`${s.ticker}: план входа — экран ТЕРМИНАЛ. Стоп ${s.stopLoss}, TP1 ${s.takeProfit1}.`);
  };

  return (
    <div>
      <div className="section-title">🎯 Сканер · банк {bank.toLocaleString('ru-RU')} ₽</div>

      <div className="switch-row">
        <span>Авто-скан каждые 15 мин (вкладка открыта)</span>
        <input type="checkbox" checked={autoScan} onChange={(e) => setAutoScan(e.target.checked)} />
      </div>

      {error && <div className="banner banner-error">⚠️ {error}</div>}
      {!error && mode === 'auto' && (
        <div className="banner banner-info">
          Источник: MOEX ISS через прокси. Последний скан: {lastScanAt ? new Date(lastScanAt).toLocaleTimeString('ru-RU') : 'ещё не было'}.
        </div>
      )}

      <button className="btn btn-primary btn-large" disabled={scanning} onClick={() => runScan('auto')}>
        {scanning ? 'Сканирую джунгли…' : '🐺 Просканировать (MOEX)'}
      </button>

      <div className="section-title">Или ручной ввод истории цен</div>
      <select className="input" value={manualTicker} onChange={(e) => setManualTicker(e.target.value)}>
        {TICKERS.map((t) => <option key={t.ticker} value={t.ticker}>{t.ticker} — {t.name}</option>)}
      </select>
      <textarea
        className="input"
        placeholder="Минимум 40 цен закрытия подряд, от старой к новой: 305.1 306.4 304.8 …"
        value={manualText}
        onChange={(e) => setManualText(e.target.value)}
      />
      {manualError && <div className="banner banner-error">{manualError}</div>}
      <button className="btn btn-large" disabled={scanning} onClick={handleManualScan}>
        Сканировать вручную
      </button>

      <div className="section-title">Сигналы сегодня · {todaySignals.length}/7</div>
      {todaySignals.length === 0 && (
        <div className="empty">
          Тишина в джунглях. Это норма — большую часть времени правильное действие
          — ничего не делать.
        </div>
      )}
      {todaySignals.map((s) => <SignalCard key={s.id} signal={s} onEnter={enterPosition} />)}

      {snapshots.length > 0 && (
        <>
          <div className="section-title">Цены</div>
          {snapshots.map((s) => (
            <div key={s.ticker} className="card" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px' }}>
              <b>{s.ticker}</b>
              <span>{s.price.toFixed(2)} ₽</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
