// Модалка экспорта/импорта — как у KG и ЗИ.
import { useRef, useState } from 'react';
import {
  downloadAsFile, copyToClipboard,
  validateSnapshot, importSnapshot, shareData,
} from '../core/dataTransfer';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

type Tab = 'export' | 'import';

export default function DataTransfer({ open, onClose, onImported }: Props) {
  const [tab, setTab] = useState<Tab>('export');
  const [status, setStatus] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [importText, setImportText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const showStatus = (type: 'ok' | 'error', text: string) => {
    setStatus({ type, text });
    setTimeout(() => setStatus(null), 4000);
  };

  const handleDownload = () => {
    downloadAsFile();
    showStatus('ok', '✅ Файл скачан');
  };

  const handleShare = async () => {
    const r = await shareData();
    if (r.ok) {
      showStatus(
        'ok',
        r.method === 'share' ? '✅ Открыто меню «Поделиться»' : '✅ Файл скачан',
      );
    } else {
      showStatus('error', r.error ?? 'Ошибка');
    }
  };

  const handleCopy = async () => {
    const r = await copyToClipboard();
    if (r.ok) showStatus('ok', '✅ JSON скопирован');
    else showStatus('error', r.error ?? 'Ошибка');
  };

  const handleImport = () => {
    const v = validateSnapshot(importText);
    if (!v.ok || !v.snapshot) {
      showStatus('error', v.error ?? 'Ошибка');
      return;
    }
    if (!confirm('Импорт перезапишет текущие данные. Продолжить?')) return;
    const r = importSnapshot(v.snapshot);
    showStatus('ok', `✅ Импортировано: ${r.imported} ключей`);
    setImportText('');
    onImported?.();
    setTimeout(() => {
      if (confirm('Перезагрузить?')) location.reload();
    }, 800);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result));
    reader.readAsText(file);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 1000, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, background: 'var(--card-bg)',
          borderRadius: 16, padding: 20, color: 'var(--text)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>💾 Перенос данных</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: 20,
              cursor: 'pointer', color: 'var(--subtext)',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            className={`btn ${tab === 'export' ? 'btn-primary' : ''}`}
            onClick={() => setTab('export')}
            style={{ flex: 1 }}
          >
            📤 Экспорт
          </button>
          <button
            className={`btn ${tab === 'import' ? 'btn-primary' : ''}`}
            onClick={() => setTab('import')}
            style={{ flex: 1 }}
          >
            📥 Импорт
          </button>
        </div>

        {tab === 'export' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              className="btn btn-primary btn-large"
              onClick={handleShare}
            >
              📤 Поделиться
            </button>
            <button
              className="btn btn-large"
              onClick={handleDownload}
            >
              💾 Скачать файл
            </button>
            <button
              className="btn btn-large"
              onClick={handleCopy}
            >
              📋 Скопировать JSON
            </button>
            <p style={{ fontSize: 12, color: 'var(--subtext)', margin: 0 }}>
              Сохрани файл — пригодится при переносе на другое устройство
              или после чистки кэша.
            </p>
          </div>
        )}

        {tab === 'import' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              className="btn btn-large"
              onClick={() => fileRef.current?.click()}
            >
              📁 Загрузить из файла
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
            <textarea
              className="input"
              placeholder="Вставь JSON сюда или загрузи файл"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              style={{ minHeight: 100 }}
            />
            <button
              className="btn btn-primary btn-large"
              disabled={!importText.trim()}
              onClick={handleImport}
            >
              📥 Импортировать
            </button>
          </div>
        )}

        {status && (
          <div
            className={`banner banner-${status.type === 'ok' ? 'info' : 'error'}`}
            style={{ marginTop: 12 }}
          >
            {status.text}
          </div>
        )}
      </div>
    </div>
  );
}