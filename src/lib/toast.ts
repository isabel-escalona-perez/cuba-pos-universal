export type ToastType = 'ok' | 'error' | 'info';

export function showToast(message: string, type: ToastType = 'ok') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cuba-toast', { detail: { message, type } }));
  }
}
