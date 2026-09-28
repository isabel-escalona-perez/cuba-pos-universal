import { Preferences } from '@capacitor/preferences';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface CubaPOSDB extends DBSchema {
  settings: { key: string; value: any };
  products: { key: string; value: any };
  sales: { key: string; value: any };
  cashCounts: { key: string; value: any };
  outbox: { key: string; value: any };
}

let dbPromise: Promise<IDBPDatabase<CubaPOSDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CubaPOSDB>('cuba-pos-v1', 1, {
      upgrade(db) {
        db.createObjectStore('settings');
        db.createObjectStore('products', { keyPath: 'id' });
        db.createObjectStore('sales', { keyPath: 'id' });
        db.createObjectStore('cashCounts', { keyPath: 'id' });
        db.createObjectStore('outbox', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export async function isOnboardingCompleted(): Promise<boolean> {
  const { value } = await Preferences.get({ key: 'onboarding_done' });
  return value === 'true';
}

export async function setOnboardingCompleted() {
  await Preferences.set({ key: 'onboarding_done', value: 'true' });
}

export async function saveFiscalProfile(profile: any) {
  const db = await getDB();
  await db.put('settings', profile, 'fiscal_profile');
  await Preferences.set({ key: 'fiscal_profile', value: JSON.stringify(profile) });
}

export async function getSettings() {
  const db = await getDB();
  return (await db.get('settings', 'app_settings')) || {};
}

export async function saveSettings(settings: any) {
  const db = await getDB();
  await db.put('settings', settings, 'app_settings');
}

export async function addToOutbox(operation: any) {
  const db = await getDB();
  const id = operation.id || crypto.randomUUID();
  await db.put('outbox', { ...operation, id, createdAt: Date.now() }, id);
}

export async function getOutbox() {
  const db = await getDB();
  return db.getAll('outbox');
}
