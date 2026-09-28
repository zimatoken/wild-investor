// Тикеры охоты — из SOKOL v0.5: 5 бумаг ТОП-лиquidности MOEX
export interface TickerInfo {
  ticker: string;
  name: string;
  lotSize: number; // лот, шт
}

export const TICKERS: TickerInfo[] = [
  { ticker: 'SBER',  name: 'Сбербанк',            lotSize: 10 },
  { ticker: 'GAZP',  name: 'Газпром',             lotSize: 10 },
  { ticker: 'YNDX',  name: 'Яндекс',              lotSize: 1 },
  { ticker: 'LKOH',  name: 'Лукойл',              lotSize: 1 },
  { ticker: 'ROSN',  name: 'Роснефть',            lotSize: 1 },
];

export const DEFAULT_TICKER = 'SBER';
