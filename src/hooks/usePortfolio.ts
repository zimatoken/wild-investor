// Портфель — единый источник правды для банка и позиций.
// После подъёма в App хук живёт всю сессию — поэтому банк надо обновлять после close().
import { useCallback, useState } from 'react';
import {
  closePosition,
  getPositions,
  openPosition,
  openPnl,
  getBank,
  setBank as persistBank,
} from '../core/portfolio';
import type { Position } from '../types/position';

export function usePortfolio() {
  const [positions, setPositions] = useState<Position[]>(() => getPositions());
  const [bank, setBank] = useState<number>(() => getBank());

  /** Перечитать банк из localStorage (после close, после deep link). */
  const refreshBank = useCallback(() => setBank(getBank()), []);

  const changeBank = useCallback((value: number) => {
    setBank(value);
    persistBank(value);
  }, []);

  const open = useCallback((p: Parameters<typeof openPosition>[0]) => {
    openPosition(p);
    setPositions(getPositions());
    // openPosition НЕ уменьшает банк — refresh не нужен.
  }, []);

  const close = useCallback((id: string, price: number) => {
    closePosition(id, price);
    setPositions(getPositions());
    refreshBank(); // ← КЛЮЧЕВОЕ: реализованный P&L попадает в банк
  }, [refreshBank]);

  const pnl = useCallback(
    (prices: Record<string, number>) => openPnl(positions, prices),
    [positions],
  );

  return { positions, bank, changeBank, open, close, pnl, refreshBank };
}