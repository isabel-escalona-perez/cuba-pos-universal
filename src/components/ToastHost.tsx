import { useState, useEffect } from 'preact/hooks';
import type { ToastType } from '../lib/toast';

type Toast = { id: number; message: string; type: ToastType };

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message: string; type: ToastType };
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, message: detail.message, type: detail.type || 'ok' }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3200);
    };
    window.addEventListener('cuba-toast', handler);
    return () => window.removeEventListener('cuba-toast', handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div class="toast-host">
      {toasts.map(t => (
        <div key={t.id} class={`toast toast-${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
