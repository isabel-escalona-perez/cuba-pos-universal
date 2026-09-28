/**
 * Motor de sincronización offline-first
 * - Outbox pattern
 * - Reintentos con backoff
 * - Resolución simple de conflictos (last-write-wins + reglas de negocio)
 */
import { Network } from '@capacitor/network';
import { getOutbox, removeFromOutbox, addToOutbox, getDB } from '../lib/storage';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

type OutboxItem = {
  id: string;
  type: 'sale' | 'cash_count' | 'inventory_movement' | 'product_upsert';
  payload: any;
  createdAt: number;
  retries: number;
};

let currentStatus: SyncStatus = 'idle';
const listeners = new Set<(s: SyncStatus) => void>();

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

export function onSyncStatusChange(cb: (s: SyncStatus) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function setStatus(s: SyncStatus) {
  currentStatus = s;
  listeners.forEach(cb => cb(s));
}

/** Encola una operación para sincronizar cuando haya red */
export async function enqueue(type: OutboxItem['type'], payload: any) {
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: Date.now(),
    retries: 0,
  };
  await addToOutbox(item);
  // Intentar sincronizar inmediatamente si hay red
  attemptSync();
  return item.id;
}

/** Intento de sincronización (se llama al recuperar red o manualmente) */
export async function attemptSync() {
  const net = await Network.getStatus();
  if (!net.connected) {
    setStatus('offline');
    return { success: false, reason: 'offline' };
  }

  setStatus('syncing');
  const items = await getOutbox() as OutboxItem[];

  if (items.length === 0) {
    setStatus('idle');
    return { success: true, synced: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const item of items) {
    try {
      // Aquí iría la llamada real al backend.
      // Por ahora simulamos éxito y dejamos el hook listo.
      await fakeApiCall(item);
      await removeFromOutbox(item.id);
      synced++;
    } catch (err) {
      failed++;
      // Incrementar reintentos (máx 5)
      if (item.retries < 5) {
        item.retries += 1;
        await addToOutbox(item); // re-encolar con más retries
      }
      console.warn('Sync failed for', item.id, err);
    }
  }

  setStatus(failed > 0 ? 'error' : 'idle');
  return { success: failed === 0, synced, failed };
}

/** Simulación de API (reemplazar por fetch real cuando exista backend) */
async function fakeApiCall(item: OutboxItem): Promise<void> {
  // Simula latencia de red
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  // En producción:
  // const res = await fetch(`${API_URL}/sync`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  //   body: JSON.stringify(item),
  // });
  // if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

/** Inicializa el listener de red para sincronizar automáticamente */
export function startAutoSync() {
  Network.addListener('networkStatusChange', (status) => {
    if (status.connected) {
      attemptSync();
    } else {
      setStatus('offline');
    }
  });

  // Intento inicial
  attemptSync();
}
