import { Preferences } from '@capacitor/preferences';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface CubaPOSDB extends DBSchema {
  settings: { key: string; value: any };
  products: {
    key: string;
    value: Product;
    indexes: { 'by-sku': string; 'by-barcode': string };
  };
  sales: { key: string; value: any };
  cashCounts: { key: string; value: any };
  inventoryMovements: { key: string; value: InventoryMovement };
  outbox: { key: string; value: any };
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category?: string;
  unit?: string;
  priceCUP: number;
  priceUSD: number;
  costCUP?: number;
  stock: number;
  minStock?: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  type: 'in' | 'out' | 'adjust';
  quantity: number;
  reason: string;
  note?: string;
  userId?: string;
  createdAt: number;
  synced?: boolean;
}

let dbPromise: Promise<IDBPDatabase<CubaPOSDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CubaPOSDB>('cuba-pos-v2', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('settings');
          const products = db.createObjectStore('products', { keyPath: 'id' });
          products.createIndex('by-sku', 'sku', { unique: false });
          products.createIndex('by-barcode', 'barcode', { unique: false });
          db.createObjectStore('sales', { keyPath: 'id' });
          db.createObjectStore('cashCounts', { keyPath: 'id' });
          db.createObjectStore('outbox', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('inventoryMovements')) {
            db.createObjectStore('inventoryMovements', { keyPath: 'id' });
          }
        }
      },
    });
  }
  return dbPromise;
}

// ---------- Onboarding / Settings ----------
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

// ---------- Outbox ----------
export async function addToOutbox(operation: any) {
  const db = await getDB();
  const id = operation.id || crypto.randomUUID();
  await db.put('outbox', { ...operation, id, createdAt: operation.createdAt || Date.now() });
}

export async function getOutbox() {
  const db = await getDB();
  return db.getAll('outbox');
}

export async function removeFromOutbox(id: string) {
  const db = await getDB();
  await db.delete('outbox', id);
}

// ---------- Products ----------
export async function getAllProducts(): Promise<Product[]> {
  const db = await getDB();
  return db.getAll('products');
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const db = await getDB();
  return db.get('products', id);
}

export async function saveProduct(product: Product) {
  const db = await getDB();
  product.updatedAt = Date.now();
  await db.put('products', product);
}

export async function deleteProduct(id: string) {
  const db = await getDB();
  await db.delete('products', id);
}

// ---------- Inventory Movements ----------
export async function addMovement(mov: InventoryMovement) {
  const db = await getDB();
  await db.put('inventoryMovements', mov);

  // Actualizar stock del producto
  const product = await db.get('products', mov.productId);
  if (product) {
    if (mov.type === 'in') product.stock += mov.quantity;
    else if (mov.type === 'out') product.stock -= mov.quantity;
    else if (mov.type === 'adjust') product.stock = mov.quantity; // ajuste absoluto
    product.updatedAt = Date.now();
    await db.put('products', product);
  }
}

export async function getMovementsByProduct(productId: string): Promise<InventoryMovement[]> {
  const db = await getDB();
  const all = await db.getAll('inventoryMovements');
  return all.filter(m => m.productId === productId).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAllMovements(): Promise<InventoryMovement[]> {
  const db = await getDB();
  const all = await db.getAll('inventoryMovements');
  return all.sort((a, b) => b.createdAt - a.createdAt);
}
