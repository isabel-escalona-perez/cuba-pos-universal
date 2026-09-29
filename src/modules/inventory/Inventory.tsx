import { useState, useEffect } from 'preact/hooks';
import {
  Product, getAllProducts, saveProduct, deleteProduct,
  addMovement, getMovementsByProduct, InventoryMovement,
} from '../../lib/storage';
import { enqueue } from '../../offline/syncEngine';
import { showToast } from '../../lib/toast';
import { newId } from '../../lib/id';

type View = 'list' | 'form' | 'movement' | 'history';

type OptionalField =
  | 'sku'
  | 'barcode'
  | 'category'
  | 'unit'
  | 'priceCUP'
  | 'priceUSD'
  | 'costCUP'
  | 'stock'
  | 'minStock';

const FIELD_LABELS: Record<OptionalField, string> = {
  sku: 'SKU / código interno',
  barcode: 'Código de barras',
  category: 'Categoría',
  unit: 'Unidad (ud, kg…)',
  priceCUP: 'Precio CUP',
  priceUSD: 'Precio USD',
  costCUP: 'Costo CUP',
  stock: 'Stock inicial',
  minStock: 'Stock mínimo',
};

const DEFAULT_FIELDS: OptionalField[] = ['sku', 'priceCUP', 'stock'];

const REASONS_IN = ['Compra', 'Devolución de cliente', 'Ajuste positivo', 'Transferencia recibida', 'Otro'];
const REASONS_OUT = ['Venta', 'Merma', 'Daño', 'Robo', 'Uso interno', 'Muestra', 'Devolución a proveedor', 'Otro'];
const REASONS_ADJUST = ['Inventario físico', 'Corrección', 'Otro'];

function makeSku(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9ÁÉÍÓÚÑ]/gi, '')
    .slice(0, 8) || 'PROD';
  return `${base}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export function Inventory() {
  const [view, setView] = useState<View>('list');
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [saving, setSaving] = useState(false);

  const [enabledFields, setEnabledFields] = useState<Record<OptionalField, boolean>>({
    sku: true,
    barcode: false,
    category: false,
    unit: false,
    priceCUP: true,
    priceUSD: false,
    costCUP: false,
    stock: true,
    minStock: false,
  });

  const [form, setForm] = useState({
    name: '', sku: '', barcode: '', category: '', unit: 'ud',
    priceCUP: 0, priceUSD: 0, costCUP: 0, stock: 0, minStock: 0,
  });

  const [movType, setMovType] = useState<'in' | 'out' | 'adjust'>('in');
  const [movQty, setMovQty] = useState(1);
  const [movReason, setMovReason] = useState('');
  const [movNote, setMovNote] = useState('');

  const load = async () => {
    try {
      const list = await getAllProducts();
      setProducts(list.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error(e);
      showToast('Error al cargar productos', 'error');
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const match =
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode || '').includes(search);
    if (!match) return false;
    if (onlyLow && p.stock > (p.minStock || 0)) return false;
    return true;
  });

  const toggleField = (key: OptionalField) => {
    setEnabledFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const openNew = () => {
    setSelected(null);
    setForm({ name: '', sku: '', barcode: '', category: '', unit: 'ud', priceCUP: 0, priceUSD: 0, costCUP: 0, stock: 0, minStock: 0 });
    setEnabledFields({
      sku: true,
      barcode: false,
      category: false,
      unit: false,
      priceCUP: true,
      priceUSD: false,
      costCUP: false,
      stock: true,
      minStock: false,
    });
    setView('form');
  };

  const openEdit = (p: Product) => {
    setSelected(p);
    setForm({
      name: p.name, sku: p.sku, barcode: p.barcode || '', category: p.category || '',
      unit: p.unit || 'ud', priceCUP: p.priceCUP, priceUSD: p.priceUSD,
      costCUP: p.costCUP || 0, stock: p.stock, minStock: p.minStock || 0,
    });
    // En edición se muestran todos los campos relevantes
    setEnabledFields({
      sku: true, barcode: true, category: true, unit: true,
      priceCUP: true, priceUSD: true, costCUP: true, stock: false, minStock: true,
    });
    setView('form');
  };

  const save = async () => {
    if (saving) return;
    const name = form.name.trim();
    if (!name) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }

    setSaving(true);
    try {
      let sku = enabledFields.sku ? form.sku.trim() : '';
      if (!sku) sku = makeSku(name);

      const product: Product = {
        id: selected?.id || newId(),
        name,
        sku,
        barcode: enabledFields.barcode && form.barcode.trim() ? form.barcode.trim() : undefined,
        category: enabledFields.category && form.category.trim() ? form.category.trim() : undefined,
        unit: enabledFields.unit ? (form.unit.trim() || 'ud') : 'ud',
        priceCUP: enabledFields.priceCUP ? (Number(form.priceCUP) || 0) : (selected?.priceCUP || 0),
        priceUSD: enabledFields.priceUSD ? (Number(form.priceUSD) || 0) : (selected?.priceUSD || 0),
        costCUP: enabledFields.costCUP ? (Number(form.costCUP) || 0) : (selected?.costCUP || 0),
        stock: selected
          ? selected.stock
          : (enabledFields.stock ? (Number(form.stock) || 0) : 0),
        minStock: enabledFields.minStock ? (Number(form.minStock) || 0) : (selected?.minStock || 0),
        active: true,
        createdAt: selected?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await saveProduct(product);
      await enqueue('product_upsert', product);
      await load();
      setView('list');
      showToast(selected ? 'Producto actualizado' : 'Producto guardado', 'ok');
    } catch (e) {
      console.error('save product', e);
      showToast('No se pudo guardar. Reintenta.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`¿Eliminar "${p.name}"?`)) return;
    try {
      await deleteProduct(p.id);
      await load();
      showToast('Producto eliminado', 'info');
    } catch (e) {
      showToast('No se pudo eliminar', 'error');
    }
  };

  const openMovement = (p: Product) => {
    setSelected(p);
    setMovType('in');
    setMovQty(1);
    setMovReason('');
    setMovNote('');
    setView('movement');
  };

  const saveMovement = async () => {
    if (!selected || !movReason) {
      showToast('Selecciona un motivo', 'error');
      return;
    }
    if (movType !== 'adjust' && movQty <= 0) {
      showToast('La cantidad debe ser mayor que 0', 'error');
      return;
    }
    try {
      const mov: InventoryMovement = {
        id: newId(),
        productId: selected.id,
        type: movType,
        quantity: Number(movQty),
        reason: movReason,
        note: movNote || undefined,
        createdAt: Date.now(),
      };
      await addMovement(mov);
      await enqueue('inventory_movement', mov);
      await load();
      setView('list');
      showToast('Movimiento registrado', 'ok');
    } catch (e) {
      console.error(e);
      showToast('Error al registrar movimiento', 'error');
    }
  };

  const openHistory = async (p: Product) => {
    setSelected(p);
    setMovements(await getMovementsByProduct(p.id));
    setView('history');
  };

  const setNum = (key: keyof typeof form, raw: string) => {
    const n = parseFloat(raw);
    setForm({ ...form, [key]: Number.isFinite(n) ? n : 0 });
  };

  if (view === 'list') {
    return (
      <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
        <div class="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input class="input" placeholder="Buscar nombre, SKU o código…" value={search}
              onInput={e => setSearch((e.target as HTMLInputElement).value)} style={{ flex: 1 }} />
            <button type="button" class="btn" onClick={openNew}>+ Nuevo</button>
          </div>
          <button type="button" class={`btn btn-sm ${onlyLow ? '' : 'btn-secondary'}`} onClick={() => setOnlyLow(v => !v)}>
            {onlyLow ? '● Solo stock bajo' : '○ Mostrar solo stock bajo'}
          </button>
        </div>

        {filtered.length === 0 && (
          <div class="card empty-state">
            {products.length === 0 ? 'No hay productos. Crea el primero.' : 'Sin resultados.'}
            {products.length === 0 && (
              <button type="button" class="btn" onClick={openNew}>Crear producto</button>
            )}
          </div>
        )}

        {filtered.map(p => (
          <div key={p.id} class="card" style={{ padding: 12 }}>
            <strong style={{ fontSize: 16 }}>{p.name}</strong>
            <div class="muted" style={{ marginTop: 2 }}>
              SKU: {p.sku}{p.barcode ? ` · ${p.barcode}` : ''}{p.category ? ` · ${p.category}` : ''}
            </div>
            <div style={{ marginTop: 6, fontSize: 14 }}>
              <span style={{ fontWeight: 700, color: p.stock <= (p.minStock || 0) ? 'var(--danger)' : 'inherit' }}>
                Stock: {p.stock} {p.unit || 'ud'}
              </span>
              {p.stock <= (p.minStock || 0) && <span class="badge badge-danger" style={{ marginLeft: 8 }}>Bajo</span>}
              {' · '}{p.priceCUP} CUP / ${p.priceUSD}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <button type="button" class="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Editar</button>
              <button type="button" class="btn btn-secondary btn-sm" onClick={() => openMovement(p)}>Movimiento</button>
              <button type="button" class="btn btn-secondary btn-sm" onClick={() => openHistory(p)}>Historial</button>
              <button type="button" class="btn btn-danger btn-sm" onClick={() => remove(p)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (view === 'form') {
    const isNew = !selected;
    return (
      <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
        <div class="card">
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>{selected ? 'Editar producto' : 'Nuevo producto'}</h2>

          <label class="muted">Nombre *</label>
          <input
            class="input"
            value={form.name}
            placeholder="Ej. Agua 500ml"
            onInput={e => setForm({ ...form, name: (e.target as HTMLInputElement).value })}
            style={{ marginBottom: 12 }}
          />

          {isNew && (
            <div style={{ marginBottom: 14, padding: 12, background: '#f8fafc', borderRadius: 10, border: '1px solid var(--border)' }}>
              <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>¿Qué datos quieres rellenar?</p>
              <p class="muted" style={{ marginBottom: 10 }}>Marca solo lo que necesites. El resto se completa solo.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(Object.keys(FIELD_LABELS) as OptionalField[]).map(key => (
                  <label
                    key={key}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: enabledFields[key] ? '#ccfbf1' : '#fff',
                      border: enabledFields[key] ? '1px solid #0f766e' : '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={enabledFields[key]}
                      onChange={() => toggleField(key)}
                      style={{ width: 18, height: 18 }}
                    />
                    {FIELD_LABELS[key]}
                  </label>
                ))}
              </div>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                style={{ marginTop: 10 }}
                onClick={() => {
                  const all = {} as Record<OptionalField, boolean>;
                  (Object.keys(FIELD_LABELS) as OptionalField[]).forEach(k => { all[k] = true; });
                  setEnabledFields(all);
                }}
              >
                Marcar todos
              </button>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                style={{ marginTop: 10, marginLeft: 8 }}
                onClick={() => {
                  const next = {} as Record<OptionalField, boolean>;
                  (Object.keys(FIELD_LABELS) as OptionalField[]).forEach(k => {
                    next[k] = DEFAULT_FIELDS.indexOf(k) >= 0;
                  });
                  setEnabledFields(next);
                }}
              >
                Solo esenciales
              </button>
            </div>
          )}

          {enabledFields.sku && (
            <div style={{ marginBottom: 10 }}>
              <label class="muted">SKU {isNew ? '(opcional; si vacío se genera solo)' : '*'}</label>
              <input class="input" value={form.sku}
                onInput={e => setForm({ ...form, sku: (e.target as HTMLInputElement).value })} />
            </div>
          )}

          {enabledFields.barcode && (
            <div style={{ marginBottom: 10 }}>
              <label class="muted">Código de barras</label>
              <input class="input" value={form.barcode}
                onInput={e => setForm({ ...form, barcode: (e.target as HTMLInputElement).value })} />
            </div>
          )}

          {(enabledFields.category || enabledFields.unit) && (
            <div class="grid-2" style={{ marginBottom: 10 }}>
              {enabledFields.category && (
                <div>
                  <label class="muted">Categoría</label>
                  <input class="input" value={form.category}
                    onInput={e => setForm({ ...form, category: (e.target as HTMLInputElement).value })} />
                </div>
              )}
              {enabledFields.unit && (
                <div>
                  <label class="muted">Unidad</label>
                  <input class="input" value={form.unit}
                    onInput={e => setForm({ ...form, unit: (e.target as HTMLInputElement).value })} />
                </div>
              )}
            </div>
          )}

          {(enabledFields.priceCUP || enabledFields.priceUSD) && (
            <div class="grid-2" style={{ marginBottom: 10 }}>
              {enabledFields.priceCUP && (
                <div>
                  <label class="muted">Precio CUP</label>
                  <input class="input" type="number" min="0" inputMode="decimal" value={form.priceCUP}
                    onInput={e => setNum('priceCUP', (e.target as HTMLInputElement).value)} />
                </div>
              )}
              {enabledFields.priceUSD && (
                <div>
                  <label class="muted">Precio USD</label>
                  <input class="input" type="number" min="0" step="0.01" inputMode="decimal" value={form.priceUSD}
                    onInput={e => setNum('priceUSD', (e.target as HTMLInputElement).value)} />
                </div>
              )}
            </div>
          )}

          {(enabledFields.costCUP || enabledFields.minStock) && (
            <div class="grid-2" style={{ marginBottom: 10 }}>
              {enabledFields.costCUP && (
                <div>
                  <label class="muted">Costo CUP</label>
                  <input class="input" type="number" min="0" inputMode="decimal" value={form.costCUP}
                    onInput={e => setNum('costCUP', (e.target as HTMLInputElement).value)} />
                </div>
              )}
              {enabledFields.minStock && (
                <div>
                  <label class="muted">Stock mínimo</label>
                  <input class="input" type="number" min="0" inputMode="numeric" value={form.minStock}
                    onInput={e => setNum('minStock', (e.target as HTMLInputElement).value)} />
                </div>
              )}
            </div>
          )}

          {isNew && enabledFields.stock && (
            <div style={{ marginBottom: 10 }}>
              <label class="muted">Stock inicial</label>
              <input class="input" type="number" min="0" inputMode="numeric" value={form.stock}
                onInput={e => setNum('stock', (e.target as HTMLInputElement).value)} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" class="btn btn-secondary" onClick={() => setView('list')} disabled={saving}>Cancelar</button>
            <button type="button" class="btn btn-block" onClick={save} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'movement' && selected) {
    const reasons = movType === 'in' ? REASONS_IN : movType === 'out' ? REASONS_OUT : REASONS_ADJUST;
    return (
      <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
        <div class="card">
          <h2 style={{ fontSize: 18 }}>Movimiento · {selected.name}</h2>
          <p class="muted" style={{ marginBottom: 12 }}>Stock actual: <strong>{selected.stock}</strong></p>
          <div class="grid-3" style={{ marginBottom: 12 }}>
            {(['in', 'out', 'adjust'] as const).map(t => (
              <button type="button" key={t} class={`btn btn-sm ${movType === t ? '' : 'btn-secondary'}`}
                onClick={() => { setMovType(t); setMovReason(''); }}>
                {t === 'in' ? 'Entrada' : t === 'out' ? 'Salida' : 'Ajuste'}
              </button>
            ))}
          </div>
          <label class="muted">{movType === 'adjust' ? 'Nuevo stock' : 'Cantidad'}</label>
          <input class="input" type="number" min="0" value={movQty}
            onInput={e => setMovQty(parseFloat((e.target as HTMLInputElement).value) || 0)} style={{ marginBottom: 10 }} />
          <label class="muted">Motivo *</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {reasons.map(r => (
              <button type="button" key={r} class={`btn btn-sm ${movReason === r ? '' : 'btn-secondary'}`} onClick={() => setMovReason(r)}>{r}</button>
            ))}
          </div>
          <label class="muted">Nota (opcional)</label>
          <input class="input" value={movNote} onInput={e => setMovNote((e.target as HTMLInputElement).value)} style={{ marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" class="btn btn-secondary" onClick={() => setView('list')}>Cancelar</button>
            <button type="button" class="btn btn-block" onClick={saveMovement}>Registrar</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'history' && selected) {
    return (
      <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
        <div class="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 18 }}>Historial · {selected.name}</h2>
            <button type="button" class="btn btn-secondary btn-sm" onClick={() => setView('list')}>Volver</button>
          </div>
          <p class="muted" style={{ margin: '8px 0 12px' }}>Stock actual: {selected.stock}</p>
          {movements.length === 0 && <p class="muted">Sin movimientos.</p>}
          {movements.map(m => (
            <div key={m.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ color: m.type === 'in' ? 'var(--success)' : m.type === 'out' ? 'var(--danger)' : 'var(--warning)' }}>
                  {m.type === 'in' ? '+' : m.type === 'out' ? '−' : '='}{m.quantity}
                </strong>
                <span class="muted">{new Date(m.createdAt).toLocaleString('es-CU')}</span>
              </div>
              <div style={{ fontSize: 13 }}>{m.reason}{m.note ? ` · ${m.note}` : ''}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
