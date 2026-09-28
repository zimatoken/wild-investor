// 📊 ТЕРМИНАЛ — портфель, P&L, размер позиции. Руль у тебя.
// Экран «глупый»: получает данные через props из App (единый источник правды).
import { useEffect, useState } from 'react';
import PositionCard from '../components/PositionCard';
import { buildPositionPlan } from '../core/positionSize';
import { TICKERS } from '../data/tickers';
import type { Position } from '../types/position';
import type { openPosition } from '../core/portfolio';

interface Props {
  positions: Position[];
  bank: number;
  changeBank: (v: number) => void;
  open: (p: Parameters<typeof openPosition>[0]) => void;
  close: (id: string, price: number) => void;
  pnl: (prices: Record<string, number>) => { totalPnl: number; totalPnlPct: number; invested: number };
}

export default function TerminalScreen({ positions, bank, changeBank, open, close, pnl }: Props) {
  const [ticker, setTicker] = useState('SBER');
  const [price, setPrice] = useState('');
  const [closePrices, setClosePrices] = useState<Record<string, number>>({});
  const [editingBank, setEditingBank] = useState(false);
  const [bankDraft, setBankDraft] = useState(String(bank));

  // Цены из последнего скана + реакция на новые сканы
  useEffect(() => {
    const loadPrices = () => {
      try {
        const raw = JSON.parse(localStorage.getItem('di_scan_v1') ?? '{}');
        const map: Record<string, number> = {};
        (raw.snapshots ?? []).forEach((s: { ticker: string; price: number }) => {
          map[s.ticker] = s.price;
        });
        setClosePrices(map);
      } catch {
        /* ignore */
      }
    };

    loadPrices();

    const handler = () => loadPrices();
    window.addEventListener('di:scan-done', handler);
    return () => window.removeEventListener('di:scan-done', handler);
  }, []);

  // Синхронизируем bankDraft, если банк обновился сверху
  useEffect(() => {
    if (!editingBank) setBankDraft(String(bank));
  }, [bank, editingBank]);

  // Сигнал с ОХОТЫ → автозаполнение
  useEffect(() => {
    const handler = (e: Event) => {
      const s = (e as CustomEvent).detail;
      if (s?.ticker && s?.price) {
        setTicker(s.ticker);
        setPrice(String(s.price));
      }
    };
    window.addEventListener('di:enter', handler);
    return () => window.removeEventListener('di:enter', handler);
  }, []);

  const currentPrice = closePrices[ticker];
  const entry = Number(price) || currentPrice || 0;
  const lotSize = TICKERS.find((t) => t.ticker === ticker)?.lotSize ?? 1;
  const plan = entry > 0 ? buildPositionPlan(entry, bank, lotSize) : null;
  const openPositions = positions.filter((p) => p.status === 'open');
  const pnlData = pnl(closePrices);

  const handleSaveBank = () => {
    changeBank(Number(bankDraft) || bank);
    setEditingBank(false);
  };

  return (
    <div>
      <div className="section-title">📊 Банк · УПРАВЛЯЙ РАЗМЕРОМ (2% макс)</div>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {editingBank ? (
          <div className="row" style={{ width: '100%' }}>
            <input
              className="input"
              type="number"
              value={bankDraft}
              onChange={(e) => setBankDraft(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleSaveBank}>
              OK
            </button>
          </div>
        ) : (
          <>
            <span style={{ fontSize: 22, fontWeight: 800 }}>
              {bank.toLocaleString('ru-RU')} ₽
            </span>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setBankDraft(String(bank));
                setEditingBank(true);
              }}
            >
              ✏️
            </button>
          </>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="v">{pnlData.invested.toLocaleString('ru-RU')} ₽</div>
          <div className="l">В позициях</div>
        </div>
        <div className="stat-box">
          <div
            className="v"
            style={{ color: pnlData.totalPnl >= 0 ? 'var(--success)' : 'var(--danger)' }}
          >
            {pnlData.totalPnl >= 0 ? '+' : ''}
            {pnlData.totalPnl.toLocaleString('ru-RU')} ₽
          </div>
          <div className="l">P&L ({pnlData.totalPnlPct}%)</div>
        </div>
      </div>

      <div className="section-title">Новая позиция</div>
      <div className="card">
        <select className="input" value={ticker} onChange={(e) => setTicker(e.target.value)}>
          {TICKERS.map((t) => (
            <option key={t.ticker} value={t.ticker}>
              {t.ticker} — {t.name}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="number"
          placeholder={`Цена входа (последняя: ${currentPrice ? currentPrice.toFixed(2) : '—'})`}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        {plan && plan.shares > 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 10 }}>
            Стоп {plan.stopLoss.toFixed(2)} · TP1 {plan.takeProfit1.toFixed(2)} · TP2{' '}
            {plan.takeProfit2.toFixed(2)}
            <br />
            Риск {plan.riskAmount.toFixed(2)} ₽ ({riskPct(plan.riskAmount, bank)}% банка) ·{' '}
            {plan.shares} шт ({plan.positionPct}%)
          </div>
        )}
        {plan && plan.shares === 0 && (
          <div className="banner banner-warning">
            Банк слишком мал для лота {lotSize} шт при стопе 2%. Подними банк.
          </div>
        )}
        <button
          className="btn btn-primary btn-large"
          disabled={!plan || plan.shares === 0}
          onClick={() => {
            open({
              ticker,
              qty: plan!.shares,
              entryPrice: plan!.entry,
              stopLoss: plan!.stopLoss,
              takeProfit1: plan!.takeProfit1,
              takeProfit2: plan!.takeProfit2,
              openedAt: new Date().toISOString(),
              signalId: null,
            });
            setPrice('');
          }}
        >
          📥 Войти в позицию
        </button>
      </div>

      <div className="section-title">Открытые позиции · {openPositions.length}</div>
      {openPositions.length === 0 && (
        <div className="empty">Портфель пуст. Это тоже позиция — позиция в кэше.</div>
      )}
      {openPositions.map((p) => (
        <PositionCard
          key={p.id}
          position={p}
          currentPrice={closePrices[p.ticker] ?? null}
          onClose={(id, px) => close(id, px)}
        />
      ))}

      <div className="section-title">История</div>
      {positions
        .filter((p) => p.status === 'closed')
        .map((p) => (
          <PositionCard key={p.id} position={p} currentPrice={null} onClose={() => {}} />
        ))}
    </div>
  );
}

function riskPct(riskAmount: number, bank: number): string {
  if (bank <= 0) return '0';
  return ((riskAmount / bank) * 100).toFixed(2);
}