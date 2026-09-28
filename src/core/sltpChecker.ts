// Проверка SL/TP после скана. Возвращает список сработавших алертов.
import type { Position } from '../types/position';
import type { MarketSnapshot } from '../types/market';
import { pushAlert, sendNotification, type SLTPAlert } from './notifications';

const TITLES: Record<SLTPAlert['type'], string> = {
  SL: '🚨 СТОП-ЛОСС',
  TP1: '🎯 ТЕЙК-ПРОФИТ 1',
  TP2: '🎯 ТЕЙК-ПРОФИТ 2',
};

/**
 * Проверяем открытые позиции:
 *  • если цена ≤ стоп → SL
 *  • если цена ≥ TP1 → TP1
 *  • если цена ≥ TP2 → TP2
 *
 * Отправляем уведомления (без дублей) и возвращаем сработавшие алерты.
 */
export function checkSLTP(
  positions: Position[],
  snapshots: MarketSnapshot[],
): SLTPAlert[] {
  const priceMap: Record<string, number> = {};
  for (const s of snapshots) priceMap[s.ticker] = s.price;

  const triggered: SLTPAlert[] = [];

  for (const p of positions) {
    if (p.status !== 'open') continue;
    const price = priceMap[p.ticker];
    if (!price) continue;

    const checks: { type: SLTPAlert['type']; level: number; hit: boolean }[] = [
      { type: 'SL', level: p.stopLoss, hit: price <= p.stopLoss },
      { type: 'TP2', level: p.takeProfit2, hit: price >= p.takeProfit2 },
      { type: 'TP1', level: p.takeProfit1, hit: price >= p.takeProfit1 },
    ];

    // Срабатывает только первый по приоритету (SL → TP2 → TP1)
    for (const c of checks) {
      if (!c.hit) continue;
      const alert: SLTPAlert = {
        positionId: p.id,
        ticker: p.ticker,
        type: c.type,
        price,
        level: c.level,
        at: new Date().toISOString(),
      };
      if (pushAlert(alert)) {
        sendNotification(
          `${TITLES[c.type]} · ${p.ticker}`,
          `Цена ${price.toFixed(2)} ₽ · уровень ${c.level.toFixed(2)} ₽`,
        );
        triggered.push(alert);
      }
      break; // один алерт на позицию за раз
    }
  }

  return triggered;
}