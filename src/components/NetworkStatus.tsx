import { useState, useEffect } from 'preact/hooks';
import { Network } from '@capacitor/network';
import { getSyncStatus, onSyncStatusChange, attemptSync, SyncStatus } from '../offline/syncEngine';

export function NetworkStatus() {
  const [online, setOnline] = useState(true);
  const [sync, setSync] = useState<SyncStatus>(getSyncStatus());

  useEffect(() => {
    Network.getStatus().then(s => setOnline(s.connected));
    const h = Network.addListener('networkStatusChange', s => setOnline(s.connected));
    const unsub = onSyncStatusChange(setSync);
    return () => {
      h.then(x => x.remove());
      unsub();
    };
  }, []);

  let text = '● En línea';
  let bg = '#dcfce7';

  if (!online) {
    text = '● Sin conexión – trabajando offline';
    bg = '#fee2e2';
  } else if (sync === 'syncing') {
    text = '● Sincronizando…';
    bg = '#fef3c7';
  } else if (sync === 'error') {
    text = '● Error de sincronización (toca para reintentar)';
    bg = '#ffedd5';
  }

  return (
    <div
      onClick={() => online && attemptSync()}
      style={{
        padding: '4px 12px',
        fontSize: '12px',
        fontWeight: 600,
        background: bg,
        textAlign: 'center',
        cursor: online && sync === 'error' ? 'pointer' : 'default',
      }}
    >
      {text}
    </div>
  );
}
