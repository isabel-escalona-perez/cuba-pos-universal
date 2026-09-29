import { Preferences } from '@capacitor/preferences';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

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

export interface SaleItem {
  id: string;
  name: string;
  priceCUP: number;
  priceUSD: number;
  qty: number;
}

export interface Sale {
  id: string;
  shiftId?: string;
  items: SaleItem[];
  currency: 'CUP' | 'USD';
  subtotal: number;
  discount: number;
  total: number;
  paidCUP: number;
  paidUSD: number;
  changeCUP: number;
  paymentMethod: string;
  createdAt: number;
}

export interface Shift {
  id: string;
  openedAt: number;
  closedAt?: number;
  openingFloatCUP: number;
  openingFloatUSD: number;
  status: 'open' | 'closed';
  notes?: string;
}

export interface AppSettings {
  businessName?: string;
  businessPhone?: string;
  rateUSDToCUP?: number;
  ticketFooter?: string;
}

interface CubaPOSDB extends DBSchema {
  settings: { key: string; value: any };
  products: {
    key: string;
    value: Product;
    indexes: { 'by-sku': string; 'by-barcode': string };
  };
  sales: { key: string; value: Sale };
  cashCounts: { key: string; value: any };
  inventoryMovements: { key: string; value: InventoryMovement };
  shifts: { key: string; value: Shift };
  outbox: { key: string; value: any };
}

let dbPromise: Promise<IDBPDatabase<CubaPOSDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CubaPOSDB>('cuba-pos-v3', 3, {
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
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('shifts')) {
            db.createObjectStore('shifts', { keyPath: 'id' });
          }
        }
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

export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  return ((await db.get('settings', 'app_settings')) as AppSettings) || {};
}

export async function saveSettings(settings: AppSettings) {
  const db = await getDB();
  const current = await getSettings();
  await db.put('settings', { ...current, ...settings }, 'app_settings');
}

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

export async function addMovement(mov: InventoryMovement) {
  const db = await getDB();
  await db.put('inventoryMovements', mov);
  const product = await db.get('products', mov.productId);
  if (product) {
    if (mov.type === 'in') product.stock += mov.quantity;
    else if (mov.type === 'out') product.stock = Math.max(0, product.stock - mov.quantity);
    else if (mov.type === 'adjust') product.stock = mov.quantity;
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
  return (await db.getAll('inventoryMovements')).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getOpenShift(): Promise<Shift | undefined> {
  const db = await getDB();
  const all = await db.getAll('shifts');
  return all.find(s => s.status === 'open');
}

export async function openShift(openingFloatCUP: number, openingFloatUSD = 0): Promise<Shift> {
  const existing = await getOpenShift();
  if (existing) return existing;
  const shift: Shift = {
    id: crypto.randomUUID(),
    openedAt: Date.now(),
    openingFloatCUP,
    openingFloatUSD,
    status: 'open',
  };
  const db = await getDB();
  await db.put('shifts', shift);
  return shift;
}

export async function closeShift(shiftId: string): Promise<void> {
  const db = await getDB();
  const shift = await db.get('shifts', shiftId);
  if (shift) {
    shift.status = 'closed';
    shift.closedAt = Date.now();
    await db.put('shifts', shift);
  }
}

export async function saveSale(sale: Sale) {
  const db = await getDB();
  await db.put('sales', sale);
}

export async function getAllSales(): Promise<Sale[]> {
  const db = await getDB();
  return (await db.getAll('sales')).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSalesForShift(shiftId: string): Promise<Sale[]> {
  const all = await getAllSales();
  return all.filter(s => s.shiftId === shiftId);
}

export async function getTodaySales(): Promise<Sale[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const all = await getAllSales();
  return all.filter(s => s.createdAt >= start.getTime());
}

export async function getShiftSalesTotalCUP(shiftId: string, rate = 120): Promise<number> {
  const sales = await getSalesForShift(shiftId);
  return sales.reduce((sum, s) => {
    if (s.currency === 'CUP') return sum + s.total;
    return sum + s.total * rate;
  }, 0);
}

export async function deductStockForSale(items: SaleItem[]) {
  for (const item of items) {
    await addMovement({
      id: crypto.randomUUID(),
      productId: item.id,
      type: 'out',
      quantity: item.qty,
      reason: 'Venta',
      createdAt: Date.now(),
    });
  }
}

export async function getLowStockProducts(): Promise<Product[]> {
  const products = await getAllProducts();
  return products.filter(p => p.active !== false && p.stock <= (p.minStock ?? 0));
}

export async function getDashboardStats(rate = 120) {
  const today = await getTodaySales();
  const salesCount = today.length;
  const totalCUP = today.reduce((sum, s) => {
    if (s.currency === 'CUP') return sum + s.total;
    return sum + s.total * rate;
  }, 0);
  const avgTicket = salesCount > 0 ? totalCUP / salesCount : 0;
  const lowStock = await getLowStockProducts();
  const openShift = await getOpenShift();
  return { salesCount, totalCUP, avgTicket, lowStockCount: lowStock.length, openShift };
}
