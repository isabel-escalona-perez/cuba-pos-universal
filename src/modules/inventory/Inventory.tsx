import { useState, useEffect } from 'preact/hooks';
import {
  Product, getAllProducts, saveProduct, deleteProduct,
  addMovement, getMovementsByProduct, InventoryMovement,
} from '../../lib/storage';
import { enqueue } from '../../offline/syncEngine';
import { showToast } from '../../lib/toast';

type View = 'list' | 'form' | 'movement' | 'history';

const REASONS_IN = ['Compra', 'Devolución de cliente', 'Ajuste positivo', 'Transferencia recibida', 'Otro'];
const REASONS_OUT = ['Venta', 'Merma', 'Daño', 'Robo', 'Uso interno', 'Muestra', 'Devolución a proveedor', 'Otro'];
const REASONS_ADJUST = ['Inventario físico', 'Corrección', 'Otro'];

export function Inventory() {
  const [view, setView] = useState<View>('list');
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);

  const [form, setForm] = useState({
    name: '', sku: '', barcode: '', category: '', unit: 'ud',
    priceCUP: 0, priceUSD: 0, costCUP: 0, stock: 0, minStock: 0,
  });

  const [movType, setMovType] = useState<'in' | 'out' | 'adjust'>('in');
  const [movQty, setMovQty] = useState(1);
  const [movReason, setMovReason] = useState('');
  const [movNote, setMovNote] = useState('');

  const load = async () => {
    const list = await getAllProducts();
    setProducts(list.sort((a, b) => a.name.localeCompare(b.name)));
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

  const openNew = () => {
    setSelected(null);
    setForm({ name: '', sku: '', barcode: '', category: '', unit: 'ud', priceCUP: 0, priceUSD: 0, costCUP: 0, stock: 0, minStock: 0 });
    setView('form');
  };

  const openEdit = (p: Product) => {
    setSelected(p);
    setForm({
      name: p.name, sku: p.sku, barcode: p.barcode || '', category: p.category || '',
      unit: p.unit || 'ud', priceCUP: p.priceCUP, priceUSD: p.priceUSD,
      costCUP: p.costCUP || 0, stock: p.stock, minStock: p.minStock || 0,
    });
    setView('form');
  };

  const save = async () => {
    if (!form.name.trim() || !form.sku.trim()) {
      showToast('Nombre y SKU son obligatorios', 'error');
      return;
    }
    const product: Product = {
      id: selected?.id || crypto.randomUUID(),
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim() || undefined,
      category: form.category.trim() || undefined,
      unit: form.unit,
      priceCUP: Number(form.priceCUP) || 0,
      priceUSD: Number(form.priceUSD) || 0,
      costCUP: Number(form.costCUP) || 0,
      stock: selected ? selected.stock : Number(form.stock) || 0,
      minStock: Number(form.minStock) || 0,
      active: true,
      createdAt: selected?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    await saveProduct(product);
    await enqueue('product_upsert', product);
    await load();
    setView('list');
    showToast(selected ? 'Producto actualizado' : 'Producto creado', 'ok');
  };

  const remove = async (p: Product) => {
    if (!confirm(`¿Eliminar "${p.name}"?`)) return;
    await deleteProduct(p.id);
    await load();
    showToast('Producto eliminado', 'info');
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
    const mov: InventoryMovement = {
      id: crypto.randomUUID(),
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
  };

  const openHistory = async (p: Product) => {
    setSelected(p);
    setMovements(await getMovementsByProduct(p.id));
    setView('history');
  };

  if (view === 'list') {
    return (
      <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
        <div class="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input class="input" placeholder="Buscar nombre, SKU o código…" value={search}
              onInput={e => setSearch((e.target as HTMLInputElement).value)} style={{ flex: 1 }} />
            <button class="btn" onClick={openNew}>+ Nuevo</button>
          </div>
          <button class={`btn btn-sm ${onlyLow ? '' : 'btn-secondary'}`} onClick={() => setOnlyLow(v => !v)}>
            {onlyLow ? '● Solo stock bajo' : '○ Mostrar solo stock bajo'}
          </button>
        </div>

        {filtered.length === 0 && (
          <div class="card empty-state">
            {products.length === 0 ? 'No hay productos. Crea el primero.' : 'Sin resultados.'}
            {products.length === 0 && (
              <button class="btn" onClick={openNew}>Crear producto</button>
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
              <button class="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Editar</button>
              <button class="btn btn-secondary btn-sm" onClick={() => openMovement(p)}>Movimiento</button>
              <button class="btn btn-secondary btn-sm" onClick={() => openHistory(p)}>Historial</button>
              <button class="btn btn-danger btn-sm" onClick={() => remove(p)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (view === 'form') {
    return (
      <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
        <div class="card">
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>{selected ? 'Editar producto' : 'Nuevo producto'}</h2>
          <label class="muted">Nombre *</label>
          <input class="input" value={form.name} onInput={e => setForm({ ...form, name: (e.target as HTMLInputElement).value })} style={{ marginBottom: 10 }} />
          <div class="grid-2" style={{ marginBottom: 10 }}>
            <div>
              <label class="muted">SKU *</label>
              <input class="input" value={form.sku} onInput={e => setForm({ ...form, sku: (e.target as HTMLInputElement).value })} />
            </div>
            <div>
              <label class="muted">Código de barras</label>
              <input class="input" value={form.barcode} onInput={e => setForm({ ...form, barcode: (e.target as HTMLInputElement).value })} />
            </div>
          </div>
          <div class="grid-2" style={{ marginBottom: 10 }}>
            <div>
              <label class="muted">Categoría</label>
              <input class="input" value={form.category} onInput={e => setForm({ ...form, category: (e.target as HTMLInputElement).value })} />
            </div>
            <div>
              <label class="muted">Unidad</label>
              <input class="input" value={form.unit} onInput={e => setForm({ ...form, unit: (e.target as HTMLInputElement).value })} />
            </div>
          </div>
          <div class="grid-2" style={{ marginBottom: 10 }}>
            <div>
              <label class="muted">Precio CUP</label>
              <input class="input" type="number" value={form.priceCUP}
                onInput={e => setForm({ ...form, priceCUP: parseFloat((e.target as HTMLInputElement).value) || 0 })} />
            </div>
            <div>
              <label class="muted">Precio USD</label>
              <input class="input" type="number" step="0.01" value={form.priceUSD}
                onInput={e => setForm({ ...form, priceUSD: parseFloat((e.target as HTMLInputElement).value) || 0 })} />
            </div>
          </div>
          <div class="grid-2" style={{ marginBottom: 10 }}>
            <div>
              <label class="muted">Costo CUP</label>
              <input class="input" type="number" value={form.costCUP}
                onInput={e => setForm({ ...form, costCUP: parseFloat((e.target as HTMLInputElement).value) || 0 })} />
            </div>
            <div>
              <label class="muted">Stock mínimo</label>
              <input class="input" type="number" value={form.minStock}
                onInput={e => setForm({ ...form, minStock: parseFloat((e.target as HTMLInputElement).value) || 0 })} />
            </div>
          </div>
          {!selected && (
            <div style={{ marginBottom: 10 }}>
              <label class="muted">Stock inicial</label>
              <input class="input" type="number" value={form.stock}
                onInput={e => setForm({ ...form, stock: parseFloat((e.target as HTMLInputElement).value) || 0 })} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button class="btn btn-secondary" onClick={() => setView('list')}>Cancelar</button>
            <button class="btn btn-block" onClick={save}>Guardar</button>
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
              <button key={t} class={`btn btn-sm ${movType === t ? '' : 'btn-secondary'}`}
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
              <button key={r} class={`btn btn-sm ${movReason === r ? '' : 'btn-secondary'}`} onClick={() => setMovReason(r)}>{r}</button>
            ))}
          </div>
          <label class="muted">Nota (opcional)</label>
          <input class="input" value={movNote} onInput={e => setMovNote((e.target as HTMLInputElement).value)} style={{ marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button class="btn btn-secondary" onClick={() => setView('list')}>Cancelar</button>
            <button class="btn btn-block" onClick={saveMovement}>Registrar</button>
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
            <button class="btn btn-secondary btn-sm" onClick={() => setView('list')}>Volver</button>
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
