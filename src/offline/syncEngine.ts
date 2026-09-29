/**
 * Motor de sincronización offline-first
 */
import { Network } from '@capacitor/network';
import { getOutbox, removeFromOutbox, addToOutbox } from '../lib/storage';
import { newId } from '../lib/id';

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

export async function enqueue(type: OutboxItem['type'], payload: any) {
  const item: OutboxItem = {
    id: newId(),
    type,
    payload,
    createdAt: Date.now(),
    retries: 0,
  };
  await addToOutbox(item);
  attemptSync();
  return item.id;
}

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
      await fakeApiCall(item);
      await removeFromOutbox(item.id);
      synced++;
    } catch (err) {
      failed++;
      if (item.retries < 5) {
        item.retries += 1;
        await addToOutbox(item);
      }
      console.warn('Sync failed for', item.id, err);
    }
  }

  setStatus(failed > 0 ? 'error' : 'idle');
  return { success: failed === 0, synced, failed };
}

async function fakeApiCall(_item: OutboxItem): Promise<void> {
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
}

export function startAutoSync() {
  Network.addListener('networkStatusChange', (status) => {
    if (status.connected) {
      attemptSync();
    } else {
      setStatus('offline');
    }
  });
  attemptSync();
}
