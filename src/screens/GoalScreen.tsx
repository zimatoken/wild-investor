// Экран ЦЕЛЬ — куда идёт волк. Банк vs Цель, прогресс, прогноз из ТРОФЕЕВ.
import { useState } from 'react';
import { loadGoal, saveGoal, clearGoal, buildGoalReport, type GoalReport } from '../core/goal';

interface Props {
  bank: number;
  closedTrades: { pnlPct: number; closedAt: string }[];
}

const fmt = (x: number) => x.toLocaleString('ru-RU', { maximumFractionDigits: 0 });

export default function GoalScreen({ bank, closedTrades }: Props) {
  const [goal, setGoal] = useState(() => loadGoal());
  const [editing, setEditing] = useState(!goal);
  const [target, setTarget] = useState(goal?.targetAmount?.toString() ?? '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [deposit, setDeposit] = useState(goal?.monthlyDeposit?.toString() ?? '');

  const report: GoalReport | null = goal ? buildGoalReport(bank, goal, closedTrades) : null;

  const handleSave = () => {
    const t = parseFloat(target.replace(/\s/g, '').replace(',', '.'));
    if (!t || t <= 0) return;
    const d = parseFloat(deposit.replace(/\s/g, '').replace(',', '.')) || 0;
    const g = {
      targetAmount: t,
      deadline: deadline || undefined,
      monthlyDeposit: d > 0 ? d : undefined,
    };
    saveGoal(g);
    setGoal(loadGoal());
    setEditing(false);
  };

  // ── Нет цели / редактирование ──
  if (!goal || editing) {
    return (
      <div>
        <h2 style={{ color: 'var(--heading)' }}>🏁 Поставь цель</h2>
        <p style={{ color: 'var(--subtext)', fontSize: 13, marginBottom: 16 }}>
          Одна цель — как одна добыча. Волк не гонится за двумя зайцами.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
          <label style={{ fontSize: 13, color: 'var(--subtext)' }}>
            Цель, ₽
            <input
              className="input"
              type="text"
              inputMode="decimal"
              placeholder="200 000"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              style={{ marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 13, color: 'var(--subtext)' }}>
            Срок (необязательно)
            <input
              className="input"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              style={{ marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 13, color: 'var(--subtext)' }}>
            Ежемесячный взнос, ₽ (необязательно)
            <input
              className="input"
              type="text"
              inputMode="decimal"
              placeholder="10 000"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              style={{ marginTop: 4 }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-large" onClick={handleSave}>
              💾 Сохранить
            </button>
            {goal && (
              <button className="btn" onClick={() => setEditing(false)}>
                Отмена
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Отчёт ──
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: 'var(--heading)', margin: 0 }}>🏁 Цель</h2>
        <button className="btn btn-ghost" onClick={() => setEditing(true)}>
          ✏️
        </button>
      </div>

      {report?.achieved ? (
        <div className="banner banner-info" style={{ marginTop: 16 }}>
          🏆 ЦЕЛЬ ДОСТИГНУТА. Волк добылся. Поставь следующую.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 15, marginBottom: 4, marginTop: 16 }}>
            {fmt(report!.current)} ₽ → <b>{fmt(report!.target)} ₽</b>
            {goal.deadline && (
              <span style={{ color: 'var(--subtext)' }}> · к {goal.deadline}</span>
            )}
          </div>

          {/* Прогресс-бар */}
          <div
            style={{
              height: 14,
              borderRadius: 7,
              background: 'var(--border)',
              overflow: 'hidden',
              margin: '10px 0 4px',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, report!.pct)}%`,
                background: 'var(--primary)',
                transition: 'width 0.5s',
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--subtext)' }}>
            Прогресс: {report!.pct}% · осталось {fmt(report!.remaining)} ₽
          </div>

          {/* Успеваем ли */}
          {report!.onTrack !== null && (
            <div
              className={`banner ${report!.onTrack ? 'banner-info' : 'banner-error'}`}
              style={{ marginTop: 12 }}
            >
              {report!.onTrack
                ? '✅ По реальному темпу успеваем к сроку.'
                : '⚠️ По реальному темпу к сроку НЕ успеваем. Пополняй банк или меняй срок.'}
            </div>
          )}

          {/* Сценарии */}
          <h3 style={{ marginTop: 20, color: 'var(--heading)' }}>Прогноз из твоих трофеев</h3>
          {!report!.enoughStats ? (
            <p style={{ color: 'var(--subtext)', fontSize: 13 }}>
              Мало данных ({closedTrades.length}/5 сделок). Закрывай позиции и веди дневник —
              прогноз появится из реальной статистики, не из гадания.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {report!.scenarios.map((s) => (
                <div
                  key={s.key}
                  className="card"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    opacity: s.monthsToGoal === null ? 0.5 : 1,
                  }}
                >
                  <div>
                    <b>{s.label}</b>
                    <div style={{ fontSize: 12, color: 'var(--subtext)' }}>
                      {s.monthlyReturnPct}% в месяц
                      {goal.monthlyDeposit
                        ? ` + взнос ${fmt(goal.monthlyDeposit)} ₽`
                        : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {s.monthsToGoal === null ? (
                      <span style={{ color: 'var(--subtext)' }}>не дойти</span>
                    ) : (
                      <>
                        <b>{s.monthsToGoal} мес.</b>
                        <div style={{ fontSize: 12, color: 'var(--subtext)' }}>≈ {s.date}</div>
                      </>
                    )}
                    {s.monthsToGoal !== null && !s.feasible && (
                      <div style={{ fontSize: 11, color: 'var(--danger)' }}>позже срока</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <button
        className="btn btn-ghost"
        style={{ marginTop: 16 }}
        onClick={() => {
          if (confirm('Удалить цель?')) {
            clearGoal();
            setGoal(null);
            setEditing(true);
          }
        }}
      >
        🗑 Удалить цель
      </button>
    </div>
  );
}