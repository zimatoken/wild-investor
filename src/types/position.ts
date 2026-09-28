// Позиция портфеля
export interface Position {
  id: string;
  ticker: string;
  qty: number;             // лотов/шт
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  openedAt: string;        // ISO
  signalId: string | null;
  status: 'open' | 'closed';
  closedAt: string | null;
  closePrice: number | null;
  pnl: number | null;
}
