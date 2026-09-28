// Уведомления SL/TP — Notification API + fallback.
// Проверяем после каждого скана, пока открыта вкладка (физика PWA).

const PERM_KEY = 'di_notif_permission_asked';
const SLTP_LOG_KEY = 'di_sltp_log_v1';

export type AlertType = 'SL' | 'TP1' | 'TP2';

export interface SLTPAlert {
  positionId: string;
  ticker: string;
  type: AlertType;
  price: number;
  level: number;
  at: string;
}

/** Запросить разрешение на уведомления (один раз). */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;

  try {
    const perm = await Notification.requestPermission();
    localStorage.setItem(PERM_KEY, '1');
    return perm;
  } catch {
    return 'denied';
  }
}

/** Получить текущий статус разрешения. */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

/** Запрашивали ли разрешение ранее? (для правильного сообщения после deny). */
export function wasPermissionAsked(): boolean {
  return localStorage.getItem(PERM_KEY) === '1';
}

/** Отправить уведомление (или вернуть false, если нельзя). */
export function sendNotification(title: string, body: string): boolean {
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    new Notification(title, {
      body,
      icon: '/wild-investor/icon-192.png',
    });
    return true;
  } catch {
    return false;
  }
}

/** Загрузить лог алертов — чтобы не дублировать. */
export function loadAlerts(): SLTPAlert[] {
  try {
    return JSON.parse(localStorage.getItem(SLTP_LOG_KEY) ?? '[]') as SLTPAlert[];
  } catch {
    return [];
  }
}

/** Сохранить алерт в лог (без дублей). */
export function pushAlert(alert: SLTPAlert): boolean {
  const log = loadAlerts();

  // Дедупликация: тот же тикер + тип + уровень за последние 12 часов
  const recent = log.find(
    (a) =>
      a.ticker === alert.ticker &&
      a.type === alert.type &&
      Math.abs(a.level - alert.level) < 0.01 &&
      Date.now() - new Date(a.at).getTime() < 12 * 60 * 60 * 1000,
  );
  if (recent) return false;

  log.unshift(alert);
  localStorage.setItem(SLTP_LOG_KEY, JSON.stringify(log.slice(0, 50)));
  return true;
}

/** Очистить лог алертов. */
export function clearAlerts(): void {
  localStorage.removeItem(SLTP_LOG_KEY);
}