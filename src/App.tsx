import { useEffect, useMemo, useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { usePortfolio } from './hooks/usePortfolio';
import HuntScreen from './screens/HuntScreen';
import GoalScreen from './screens/GoalScreen';
import TerminalScreen from './screens/TerminalScreen';
import TrophiesScreen from './screens/TrophiesScreen';
import PackScreen from './screens/PackScreen';
import DataTransfer from './components/DataTransfer';
import SLTPBanner from './components/SLTPBanner';

type Tab = 'hunt' | 'goal' | 'terminal' | 'trophies' | 'pack';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'hunt', icon: '🎯', label: 'ОХОТА' },
  { id: 'goal', icon: '🏁', label: 'ЦЕЛЬ' },
  { id: 'terminal', icon: '📊', label: 'ТЕРМИНАЛ' },
  { id: 'trophies', icon: '📖', label: 'ТРОФЕИ' },
  { id: 'pack', icon: '🐺', label: 'СТАЯ' },
];

export default function App() {
  // ← ПРАВКА: разовая чистка протухших снапшотов + market
  if (typeof window !== 'undefined') {
    const SNAPSHOT_SCHEMA_V = '3';
    if (localStorage.getItem('di_scan_schema') !== SNAPSHOT_SCHEMA_V) {
      localStorage.removeItem('di_scan_v1');
      localStorage.removeItem('di_market_v1');
      localStorage.setItem('di_scan_schema', SNAPSHOT_SCHEMA_V);
      console.log('[MIGRATION] di_scan_v1 + di_market_v1 очищены (schema → 3)');
    }
  }

  const [tab, setTab] = useState<Tab>('hunt');
  const [theme, toggleTheme] = useTheme();
  const [dataTransferOpen, setDataTransferOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  // Единый источник правды: банк + позиции
  const { positions, bank, changeBank, open, close, pnl } = usePortfolio();

  // Закрытые сделки для прогноза ЦЕЛИ — пересчёт только при изменении позиций
  const closedTrades = useMemo(
    () =>
      positions
        .filter((p) => p.status === 'closed' && p.closePrice != null && p.entryPrice > 0)
        .map((p) => ({
          pnlPct: ((p.closePrice! - p.entryPrice) / p.entryPrice) * 100,
          closedAt: p.closedAt ?? p.openedAt,
        })),
    [positions],
  );

  // Обработчик di:navigate (из SLTPBanner → ТЕРМИНАЛ)
  useEffect(() => {
    const handler = (e: Event) => {
      const target = (e as CustomEvent).detail as Tab;
      if (target) setTab(target);
    };
    window.addEventListener('di:navigate', handler);
    return () => window.removeEventListener('di:navigate', handler);
  }, []);

  const handleRequestNotifications = async () => {
    const {
      requestNotificationPermission,
      wasPermissionAsked,
      getNotificationPermission,
    } = await import('./core/notifications');

    const current = getNotificationPermission();

    if (current === 'denied' && wasPermissionAsked()) {
      setStatusMessage({
        type: 'error',
        text: 'Уведомления отключены. Включи их в настройках сайта (замок в адресной строке).',
      });
      return;
    }

    const perm = await requestNotificationPermission();
    if (perm === 'granted') {
      setStatusMessage({ type: 'ok', text: '✅ Уведомления включены' });
    } else if (perm === 'denied') {
      setStatusMessage({ type: 'error', text: 'Уведомления не разрешены' });
    } else {
      setStatusMessage({ type: 'error', text: 'Браузер не поддерживает уведомления' });
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <span className="header-logo">🐺</span>
          <div>
            <div className="header-title">ДИКИЙ ИНВЕСТОР</div>
            <div className="header-sub">ZSS-сканер · Руль у тебя</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-ghost"
            onClick={handleRequestNotifications}
            title="Уведомления SL/TP"
          >
            🔔
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setDataTransferOpen(true)}
            title="Экспорт/импорт данных"
          >
            💾
          </button>
          <button className="btn btn-ghost" onClick={toggleTheme} title="Сменить тему">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="main">
        {statusMessage && (
          <div
            className={`banner banner-${statusMessage.type === 'ok' ? 'info' : 'error'}`}
            style={{
              marginBottom: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: 16,
              }}
            >
              ✕
            </button>
          </div>
        )}

        <SLTPBanner />

        {tab === 'hunt' && <HuntScreen />}
        {tab === 'goal' && <GoalScreen bank={bank} closedTrades={closedTrades} />}
        {tab === 'terminal' && (
          <TerminalScreen
            positions={positions}
            bank={bank}
            changeBank={changeBank}
            open={open}
            close={close}
            pnl={pnl}
          />
        )}
        {tab === 'trophies' && <TrophiesScreen />}
        {tab === 'pack' && <PackScreen />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tabbar-item ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tabbar-icon">{t.icon}</span>
            <span className="tabbar-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <DataTransfer
        open={dataTransferOpen}
        onClose={() => setDataTransferOpen(false)}
        onImported={() => {
          // После импорта данные обновятся, модалка предложит перезагрузку.
        }}
      />
    </div>
  );
}