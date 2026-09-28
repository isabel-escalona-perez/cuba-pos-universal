import { useState, useEffect } from 'preact/hooks';
import { Network } from '@capacitor/network';

export function NetworkStatus() {
  const [status, setStatus] = useState<'online' | 'offline' | 'syncing'>('online');

  useEffect(() => {
    Network.getStatus().then(s => setStatus(s.connected ? 'online' : 'offline'));
    const handler = Network.addListener('networkStatusChange', s => {
      setStatus(s.connected ? 'online' : 'offline');
    });
    return () => { handler.then(h => h.remove()); };
  }, []);

  return (
    <div class={`network-bar status-${status}`} style={{
      padding: '4px 12px', fontSize: '12px', fontWeight: 600,
      background: status === 'online' ? '#dcfce7' : status === 'offline' ? '#fee2e2' : '#fef3c7',
      textAlign: 'center'
    }}>
      {status === 'online' && '● En línea'}
      {status === 'offline' && '● Sin conexión – trabajando offline'}
      {status === 'syncing' && '● Sincronizando…'}
    </div>
  );
}
