// In-app баннер SL/TP — резервный канал, когда уведомления запрещены.
import { useEffect, useState } from 'react';
import type { SLTPAlert } from '../core/notifications';

export default function SLTPBanner() {
  const [alerts, setAlerts] = useState<SLTPAlert[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const list = (e as CustomEvent).detail as SLTPAlert[];
      if (list.length > 0) setAlerts(list);
    };
    window.addEventListener('di:sltp-triggered', handler);
    return () => window.removeEventListener('di:sltp-triggered', handler);
  }, []);

  if (alerts.length === 0) return null;

  const alert = alerts[0];
  const isSL = alert.type === 'SL';
  const emoji = isSL ? '🚨' : '🎯';
  const title = isSL ? 'СТОП-ЛОСС' : alert.type === 'TP1' ? 'ТЕЙК-ПРОФИТ 1' : 'ТЕЙК-ПРОФИТ 2';
  const color = isSL ? 'var(--danger)' : 'var(--success)';
  const extra = alerts.length - 1;

  const dismiss = () => setAlerts([]);
  const goToTerminal = () => {
    window.dispatchEvent(new CustomEvent('di:navigate', { detail: 'terminal' }));
    setAlerts([]);
  };

  return (
    <div
      className="banner"
      style={{
        borderColor: color,
        color,
        background: isSL
          ? 'color-mix(in srgb, var(--danger) 10%, transparent)'
          : 'color-mix(in srgb, var(--success) 10%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <b>{emoji} {title} · {alert.ticker}</b>
          <div style={{ fontSize: 12, marginTop: 2 }}>
            Цена {alert.price.toFixed(2)} ₽ · уровень {alert.level.toFixed(2)} ₽
            {extra > 0 && <span> · ещё {extra}</span>}
          </div>
        </div>
        <button
          onClick={dismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color,
            cursor: 'pointer',
            fontSize: 16,
            padding: 0,
          }}
        >
          ✕
        </button>
      </div>
      <button
        onClick={goToTerminal}
        className="btn"
        style={{
          fontSize: 12,
          padding: '6px 10px',
          background: 'transparent',
          borderColor: color,
          color,
          alignSelf: 'flex-start',
        }}
      >
        → Терминал
      </button>
    </div>
  );
}