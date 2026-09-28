// 🐺 СТАЯ — мостики с KG и ЗИ (общий origin zimatoken.github.io → общий localStorage)
// + deep links (?from=kg&amount=) как fallback.
import { useEffect, useState } from 'react';

interface BridgeMessage {
  from: 'KG' | 'ZI' | 'unknown';
  text: string;
  amount: number | null;
  at: string;
}

const DI_INBOX_KEY = 'di_inbox_v1';
const KG_URL = 'https://zimatoken.github.io/kapital-garden/';
const ZI_URL = 'https://zimatoken.github.io/golden-investor/';

function readBridges(): BridgeMessage[] {
  const out: BridgeMessage[] = [];
  // 1) Deep link из URL (?from=kg&amount=5000)
  const params = new URLSearchParams(window.location.search);
  const from = params.get('from');
  const amount = Number(params.get('amount')) || null;
  if (from && amount) {
    out.push({ from: from.toUpperCase() as BridgeMessage['from'], text: '', amount, at: new Date().toISOString() });
  }
  // 2) localStorage мостики (PHASE 16.2 стиль)
  try {
    const kg = JSON.parse(localStorage.getItem('kg.state') ?? 'null');
    if (kg?.availableToInvest) {
      out.push({ from: 'KG', text: '🌳 KG: свободные средства готовы к инвестиции', amount: kg.availableToInvest, at: new Date().toISOString() });
    }
  } catch { /* ignore */ }
  try {
    const ziPlan = localStorage.getItem('gi_plan_map_v1');
    if (ziPlan) {
      out.push({ from: 'ZI', text: '💎 ЗИ: план сценариев активен', amount: null, at: new Date().toISOString() });
    }
  } catch { /* ignore */ }
  // 3) Входящие, записанные ранее
  try {
    const inbox = JSON.parse(localStorage.getItem(DI_INBOX_KEY) ?? '[]') as BridgeMessage[];
    out.push(...inbox);
  } catch { /* ignore */ }
  return out;
}

export default function PackScreen() {
  const [bridges, setBridges] = useState<BridgeMessage[]>([]);

  useEffect(() => {
    const found = readBridges();
    setBridges(found);
    // Deep-link сохраняем во входящие и чистим URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('from')) {
      const deep = found.filter((b) => b.amount && b.text === '');
      if (deep.length) {
        const inbox = JSON.parse(localStorage.getItem(DI_INBOX_KEY) ?? '[]') as BridgeMessage[];
        localStorage.setItem(DI_INBOX_KEY, JSON.stringify([...deep, ...inbox].slice(0, 20)));
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  return (
    <div>
      <div className="section-title">🐺 Стая — связь братьев</div>
      <div className="banner banner-info" style={{ marginBottom: 16 }}>
        Данные общие, доверие проверяемое. Один origin — общий localStorage.
      </div>

      <div className="section-title">Входящие от братьев</div>
      {bridges.length === 0 && (
        <div className="empty">
          Пока тихо. Когда KG накопит свободные средства или ЗИ обновит план —
          здесь появится сигнал стаи.
        </div>
      )}
      {bridges.map((b, i) => (
        <div key={i} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <b>{b.from === 'KG' ? '🌳 Kapital Garden' : b.from === 'ZI' ? '💎 Золотой Инвестор' : `📨 ${b.from}`}</b>
            <div style={{ fontSize: 12, color: 'var(--subtext)' }}>{b.text || 'Передача средств'}</div>
          </div>
          {b.amount && <b style={{ color: 'var(--success)' }}>{b.amount.toLocaleString('ru-RU')} ₽</b>}
        </div>
      ))}

      <div className="section-title">Перейти к братьям</div>
      <div className="card">
        <button className="btn btn-large" style={{ marginBottom: 8 }} onClick={() => { window.open(KG_URL, '_blank'); }}>
          🌳 Kapital Garden — сад капитала
        </button>
        <button className="btn btn-large" onClick={() => { window.open(ZI_URL, '_blank'); }}>
          💎 Золотой Инвестор — тайминг-навигатор
        </button>
      </div>

      <div className="section-title">Публичные сигналы стаи</div>
      <div className="card">
        <div style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 8 }}>
          Статический public_signals.json генерируется SOKOL-референсом.
          Импорт появится в v0.2. Стая видит добычу — но не видит твою берлогу:
          публичны только тикер, направление и ZSS.
        </div>
        <button className="btn btn-ghost" disabled title="v0.2">📥 Импорт сигналов SOKOL (скоро)</button>
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: 'var(--subtext)', fontStyle: 'italic', textAlign: 'center' }}>
        Приложение показывает. Руль у тебя. 🐺
      </div>
    </div>
  );
}
