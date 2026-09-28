// Лаборатория Истины — дневник сигналов (порт lab.py, localStorage вместо SQLite).
// Статистика WIN/LOSS/NEUTRAL — ТРОФЕИ ВАЖНЕЕ ПОБЕД.

import type { Signal } from '../types/signal';

export type Verdict = 'WIN' | 'LOSS' | 'NEUTRAL' | 'PENDING';

export interface LabEntry {
  signal: Signal;
  verdict: Verdict;
  note: string;
  updatedAt: string;
}

const KEY = 'di_lab_v1';

function load(): LabEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as LabEntry[];
  } catch {
    return [];
  }
}

function save(entries: LabEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function getLab(): LabEntry[] {
  return load().sort((a, b) => b.signal.createdAt.localeCompare(a.signal.createdAt));
}

export function addSignalsToLab(signals: Signal[]): number {
  const entries = load();
  const existing = new Set(entries.map((e) => e.signal.id));
  let added = 0;
  for (const s of signals) {
    if (existing.has(s.id)) continue;
    entries.push({ signal: s, verdict: 'PENDING', note: '', updatedAt: s.createdAt });
    added++;
  }
  save(entries);
  return added;
}

export function setVerdict(signalId: string, verdict: Verdict, note = ''): void {
  const entries = load();
  const e = entries.find((x) => x.signal.id === signalId);
  if (!e) return;
  e.verdict = verdict;
  e.note = note;
  e.updatedAt = new Date().toISOString();
  save(entries);
}

export function labStats(): { total: number; win: number; loss: number; neutral: number; pending: number } {
  const entries = load();
  const done = entries.filter((e) => e.verdict !== 'PENDING');
  return {
    total: entries.length,
    win: done.filter((e) => e.verdict === 'WIN').length,
    loss: done.filter((e) => e.verdict === 'LOSS').length,
    neutral: done.filter((e) => e.verdict === 'NEUTRAL').length,
    pending: entries.filter((e) => e.verdict === 'PENDING').length,
  };
}
