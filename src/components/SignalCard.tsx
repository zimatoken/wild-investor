import { useState } from 'react';
import ZSSBadge from './ZSSBadge';
import type { Signal } from '../types/signal';

interface Props {
  signal: Signal;
  onEnter: (s: Signal) => void;
}

export default function SignalCard({ signal: s, onEnter }: Props) {
  const [details, setDetails] = useState(false);
  return (
    <div className="card signal-card">
      <div className="signal-head">
        <div>
          <div className="signal-ticker">{s.ticker}</div>
          <div className="signal-price">{s.price.toFixed(2)} ₽</div>
        </div>
        <ZSSBadge rating={s.rating} zss={s.zss} />
      </div>

      <div className="signal-levels">
        <span>🛡️ {s.stopLoss.toFixed(2)} (−2%)</span>
        <span>🎯 {s.takeProfit1.toFixed(2)} (+3%)</span>
        <span>🎯 {s.takeProfit2.toFixed(2)} (+5%)</span>
      </div>
      <div className="signal-meta">
        Размер позиции: <b>{s.positionPct}%</b> банка · R/R ≈ 1:1.5
      </div>

      <div className="signal-actions">
        <button className="btn btn-primary" onClick={() => onEnter(s)}>🐺 Войти</button>
        <button className="btn btn-ghost" onClick={() => setDetails(!details)}>
          {details ? 'Скрыть' : 'Подробнее'}
        </button>
      </div>

      {details && (
        <div className="signal-details">
          <div>ADX {s.adx} (тренд)</div>
          <div>RSI {s.rsi}</div>
          <div>Объём ×{s.volumeRatio}</div>
          <div>VWAP-отклонение {s.vwapDiffPct}%</div>
          <div className="signal-honest">
            🦅 Рекомендует. Человек решает.
          </div>
        </div>
      )}
    </div>
  );
}
