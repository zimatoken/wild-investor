// Экспорт/импорт всех данных ДИ в JSON.
// По образцу KG и ЗИ: один файл, все ключи, версия.

export const DI_DATA_VERSION = 1;
export const DI_APP_ID = 'wild-investor';

/** Все ключи localStorage, которые принадлежат ДИ. */
const DI_KEYS = [
  'di_scan_v1',
  'di_portfolio_v1',
  'di_lab_v1',
  'di_bank_v1',
  'di_theme',
  'di_inbox_v1',
  'di_notif_permission_asked',
  'di_sltp_log_v1',
  'di_goal_v1',
  'di_market_v1',
];

export interface DISnapshot {
  version: number;
  app: string;
  exportedAt: string;
  data: Record<string, string>;
}

/** Собрать всё ДИ в один snapshot. */
export function exportAll(): DISnapshot {
  const data: Record<string, string> = {};
  for (const key of DI_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return {
    version: DI_DATA_VERSION,
    app: DI_APP_ID,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/** Скачать как файл. */
export function downloadAsFile(): void {
  const snap = exportAll();
  const json = JSON.stringify(snap, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wild-investor-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Скопировать в буфер. */
export async function copyToClipboard(): Promise<{ ok: boolean; error?: string }> {
  try {
    const json = JSON.stringify(exportAll(), null, 2);
    await navigator.clipboard.writeText(json);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Проверить snapshot из строки. */
export function validateSnapshot(text: string): { ok: boolean; snapshot?: DISnapshot; error?: string } {
  try {
    const parsed = JSON.parse(text) as DISnapshot;
    if (parsed.app !== DI_APP_ID) return { ok: false, error: 'Это не файл Дикого Инвестора' };
    if (typeof parsed.version !== 'number') return { ok: false, error: 'Нет версии' };
    if (!parsed.data || typeof parsed.data !== 'object') return { ok: false, error: 'Нет данных' };
    return { ok: true, snapshot: parsed };
  } catch (e) {
    return { ok: false, error: 'Неверный JSON' };
  }
}

/** Поделиться через Web Share API (телефоны). Fallback: скачивание файла. */
export async function shareData(): Promise<{
  ok: boolean;
  method?: 'share' | 'download';
  error?: string;
}> {
  const json = JSON.stringify(exportAll(), null, 2);
  const filename = `wild-investor-${new Date().toISOString().slice(0, 10)}.json`;

  // Web Share API доступен только в HTTPS и на мобильных
  if (typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
    try {
      const file = new File([json], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Дикий Инвестор — бэкап' });
        return { ok: true, method: 'share' };
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        return { ok: false, error: 'Отменено' };
      }
      // при других ошибках — падаем на скачивание
    }
  }

  downloadAsFile();
  return { ok: true, method: 'download' };
}

/** Импорт snapshot: перезаписать все ключи ДИ. */
export function importSnapshot(snap: DISnapshot): { imported: number } {
  let imported = 0;
  for (const [key, value] of Object.entries(snap.data)) {
    if (DI_KEYS.includes(key)) {
      localStorage.setItem(key, value);
      imported++;
    }
  }
  return { imported };
}