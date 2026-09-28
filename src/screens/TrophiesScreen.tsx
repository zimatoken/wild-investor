// 📖 ТРОФЕИ — дневник охоты. Трофеи важнее побед: ошибки учат больше.
import { useState } from 'react';
import { getLab, labStats, setVerdict } from '../core/lab';
import ZSSBadge from '../components/ZSSBadge';
import type { Verdict } from '../core/lab';

export default function TrophiesScreen() {
  const [entries, setEntries] = useState(() => getLab());
  const stats = labStats();

  const verdict = (id: string, v: Verdict) => {
    setVerdict(id, v);
    setEntries(getLab());
  };

  const winRate = stats.win + stats.loss > 0
    ? Math.round((stats.win / (stats.win + stats.loss)) * 100)
    : null;

  return (
    <div>
      <div className="section-title">📖 Лаборатория истины</div>
      <div className="stats-grid">
        <div className="stat-box"><div className="v">{stats.total}</div><div className="l">Сигналов</div></div>
        <div className="stat-box"><div className="v" style={{ color: 'var(--success)' }}>{stats.win}</div><div className="l">Win</div></div>
        <div className="stat-box"><div className="v" style={{ color: 'var(--danger)' }}>{stats.loss}</div><div className="l">Loss</div></div>
        <div className="stat-box"><div className="v" style={{ color: 'var(--warning)' }}>{stats.neutral}</div><div className="l">Нейтр.</div></div>
      </div>
      <div className="banner banner-info" style={{ marginBottom: 16 }}>
        {winRate !== null
          ? `Win Rate: ${winRate}% · Не скрываем убытки, не приукрашиваем прибыль.`
          : 'Исходов пока мало. Отмечай исходы через день-два — так растёт мастерство.'}
      </div>

      {entries.length === 0 && (
        <div className="empty">Журнал пуст. Сделай первый скан на экране ОХОТА.</div>
      )}

      {entries.map((e) => (
        <div key={e.signal.id} className="card">
          <div className="signal-head">
            <div>
              <div className="signal-ticker">{e.signal.ticker}</div>
              <div className="signal-price">{e.signal.date} · вход {e.signal.price.toFixed(2)} ₽</div>
            </div>
            <ZSSBadge rating={e.signal.rating} zss={e.signal.zss} />
          </div>
          <div className="signal-levels">
            <span>🛡️ {e.signal.stopLoss.toFixed(2)}</span>
            <span>🎯 {e.signal.takeProfit1.toFixed(2)}</span>
          </div>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            Исход: <b style={{
              color: e.verdict === 'WIN' ? 'var(--success)' : e.verdict === 'LOSS' ? 'var(--danger)' : 'var(--subtext)',
            }}>{e.verdict}</b>
          </div>
          <div className="signal-actions">
            <button className="btn" onClick={() => verdict(e.signal.id, 'WIN')}>🟢 Сработало</button>
            <button className="btn" onClick={() => verdict(e.signal.id, 'LOSS')}>🔴 Не сработало</button>
            <button className="btn btn-ghost" onClick={() => verdict(e.signal.id, 'NEUTRAL')}>⚪</button>
          </div>
        </div>
      ))}
    </div>
  );
}
