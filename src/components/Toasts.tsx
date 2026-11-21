import { create } from 'zustand';
import { uid } from '../lib/format';
import { IconClose } from './Icons';
import { CoinImg } from './ui';

interface Toast {
  id: string;
  title: string;
  body: string;
  image?: string;
  tone?: 'up' | 'down' | 'info';
}

export const useToasts = create<{ list: Toast[] }>(() => ({ list: [] }));

export function toast(t: Omit<Toast, 'id'>, ttl = 8000) {
  const id = uid();
  useToasts.setState((s) => ({ list: [...s.list.slice(-3), { ...t, id }] }));
  setTimeout(() => dismiss(id), ttl);
}
const dismiss = (id: string) => useToasts.setState((s) => ({ list: s.list.filter((x) => x.id !== id) }));

export function Toasts() {
  const list = useToasts((s) => s.list);
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.tone ?? ''}`}>
          {t.image && <CoinImg src={t.image} alt={t.title} size={28} />}
          <div className="grow">
            <div className="bold">{t.title}</div>
            <div className="muted small">{t.body}</div>
          </div>
          <button className="btn-ghost" style={{ color: 'var(--text-3)' }} onClick={() => dismiss(t.id)} aria-label="dismiss">
            <IconClose size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
