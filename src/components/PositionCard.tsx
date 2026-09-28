import type { Position } from '../types/position';

interface Props {
  position: Position;
  currentPrice: number | null;
  onClose: (id: string, price: number) => void;
}

export default function PositionCard({ position: p, currentPrice, onClose }: Props) {
  const px = currentPrice ?? p.entryPrice;
  const pnl = (px - p.entryPrice) * p.qty;
  const pnlPct = ((px - p.entryPrice) / p.entryPrice) * 100;
  const positive = pnl >= 0;
  const closed = p.status === 'closed';

  return (
    <div className="card">
      <div className="signal-head">
        <div>
          <div className="signal-ticker">{p.ticker}</div>
          <div className="signal-price">
            {p.qty} шт × {p.entryPrice.toFixed(2)} ₽
          </div>
        </div>
        <div className={positive ? 'pnl-positive' : 'pnl-negative'}>
          {closed ? 'Итог: ' : ''}{positive ? '+' : ''}{pnl.toFixed(2)} ₽ ({pnlPct.toFixed(1)}%)
        </div>
      </div>
      <div className="signal-levels">
        <span>🛡️ {p.stopLoss.toFixed(2)}</span>
        <span>🎯 {p.takeProfit1.toFixed(2)}</span>
        <span>🎯 {p.takeProfit2.toFixed(2)}</span>
      </div>
      {!closed && currentPrice && (
        <button className="btn btn-danger" onClick={() => onClose(p.id, currentPrice)}>
          Закрыть по рынку
        </button>
      )}
      {closed && <div className="signal-meta">Закрыта {p.closedAt?.slice(0, 10)}</div>}
    </div>
  );
}
