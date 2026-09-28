import { useState, useEffect } from 'preact/hooks';
import {
  Product,
  getAllProducts,
  saveProduct,
  deleteProduct,
  addMovement,
  getMovementsByProduct,
  InventoryMovement,
} from '../../lib/storage';
import { enqueue } from '../../offline/syncEngine';

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

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode || '').includes(search)
  );

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
      alert('Nombre y SKU son obligatorios');
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
  };

  const remove = async (p: Product) => {
    if (!confirm(`¿Eliminar "${p.name}"?`)) return;
    await deleteProduct(p.id);
    await load();
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
      alert('Selecciona un motivo');
      return;
    }
    if (movType !== 'adjust' && movQty <= 0) {
      alert('La cantidad debe ser mayor que 0');
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
  };

  const openHistory = async (p: Product) => {
    setSelected(p);
    const list = await getMovementsByProduct(p.id);
    setMovements(list);
    setView('history');
  };

  if (view === 'list') {
    return (
      <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
        <div class="card" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input class="input" placeholder="Buscar nombre, SKU o código…" value={search}
            onInput={e => setSearch((e.target as HTMLInputElement).value)} style={{ flex: 1 }} />
          <button class="btn" onClick={openNew}>+ Nuevo</button>
        </div>

        {filtered.length === 0 && (
          <div class="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
            {products.length === 0 ? 'No hay productos. Crea el primero.' : 'Sin resultados.'}
          </div>
        )}

        {filtered.map(p => (
          <div key={p.id} class="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <strong style={{ fontSize: 16 }}>{p.name}</strong>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                  SKU: {p.sku} {p.barcode ? `· ${p.barcode}` : ''}
                </div>
                <div style={{ marginTop: 6, fontSize: 14 }}>
                  <span style={{ fontWeight: 700, color: p.stock <= (p.minStock || 0) ? 'var(--danger)' : 'inherit' }}>
                    Stock: {p.stock} {p.unit || 'ud'}
                  </span>
                  {' · '}
                  {p.priceCUP} CUP / ${p.priceUSD}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <button class="btn btn-secondary" style={{ padding: '8px 12px', minHeight: 40, fontSize: 13 }}
                onClick={() => openEdit(p)}>Editar</button>
              <button class="btn btn-secondary" style={{ padding: '8px 12px', minHeight: 40, fontSize: 13 }}
                onClick={() => openMovement(p)}>Movimiento</button>
              <button class="btn btn-secondary" style={{ padding: '8px 12px', minHeight: 40, fontSize: 13 }}
                onClick={() => openHistory(p)}>Historial</button>
              <button class="btn btn-danger" style={{ padding: '8px 12px', minHeight: 40, fontSize: 13 }}
                onClick={() => remove(p)}>Eliminar</button>
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

          <label style={{ fontSize: 13 }}>Nombre *</label>
          <input class="input" value={form.name} onInput={e => setForm({ ...form, name: (e.target as HTMLInputElement).value })} style={{ marginBottom: 10 }} />

          <div class="grid-2" style={{ marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 13 }}>SKU *</label>
              <input class="input" value={form.sku} onInput={e => setForm({ ...form, sku: (e.target as HTMLInputElement).value })} />
            </div>
            <div>
              <label style={{ fontSize: 13 }}>Código de barras</label>
              <input class="input" value={form.barcode} onInput={e => setForm({ ...form, barcode: (e.target as HTMLInputElement).value })} />
            </div>
          </div>

          <div class="grid-2" style={{ marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 13 }}>Categoría</label>
              <input class="input" value={form.category} onInput={e => setForm({ ...form, category: (e.target as HTMLInputElement).value })} />
            </div>
            <div>
              <label style={{ fontSize: 13 }}>Unidad</label>
              <input class="input" value={form.unit} onInput={e => setForm({ ...form, unit: (e.target as HTMLInputElement).value })} />
            </div>
          </div>

          <div class="grid-2" style={{ marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 13 }}>Precio CUP</label>
              <input class="input" type="number" value={form.priceCUP}
                onInput={e => setForm({ ...form, priceCUP: parseFloat((e.target as HTMLInputElement).value) || 0 })} />
            </div>
            <div>
              <label style={{ fontSize: 13 }}>Precio USD</label>
              <input class="input" type="number" step="0.01" value={form.priceUSD}
                onInput={e => setForm({ ...form, priceUSD: parseFloat((e.target as HTMLInputElement).value) || 0 })} />
            </div>
          </div>

          <div class="grid-2" style={{ marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 13 }}>Costo CUP</label>
              <input class="input" type="number" value={form.costCUP}
                onInput={e => setForm({ ...form, costCUP: parseFloat((e.target as HTMLInputElement).value) || 0 })} />
            </div>
            <div>
              <label style={{ fontSize: 13 }}>Stock mínimo</label>
              <input class="input" type="number" value={form.minStock}
                onInput={e => setForm({ ...form, minStock: parseFloat((e.target as HTMLInputElement).value) || 0 })} />
            </div>
          </div>

          {!selected && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 13 }}>Stock inicial</label>
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
          <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Stock actual: <strong>{selected.stock}</strong></p>

          <div class="grid-3" style={{ marginBottom: 12 }}>
            {(['in', 'out', 'adjust'] as const).map(t => (
              <button key={t} class={`btn ${movType === t ? '' : 'btn-secondary'}`} style={{ padding: '10px', fontSize: 13 }}
                onClick={() => { setMovType(t); setMovReason(''); }}>
                {t === 'in' ? 'Entrada' : t === 'out' ? 'Salida' : 'Ajuste'}
              </button>
            ))}
          </div>

          <label style={{ fontSize: 13 }}>{movType === 'adjust' ? 'Nuevo stock' : 'Cantidad'}</label>
          <input class="input" type="number" min="0" value={movQty}
            onInput={e => setMovQty(parseFloat((e.target as HTMLInputElement).value) || 0)} style={{ marginBottom: 10 }} />

          <label style={{ fontSize: 13 }}>Motivo *</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {reasons.map(r => (
              <button key={r} class={`btn ${movReason === r ? '' : 'btn-secondary'}`} style={{ padding: '10px', fontSize: 14 }}
                onClick={() => setMovReason(r)}>{r}</button>
            ))}
          </div>

          <label style={{ fontSize: 13 }}>Nota (opcional)</label>
          <input class="input" value={movNote} onInput={e => setMovNote((e.target as HTMLInputElement).value)} style={{ marginBottom: 16 }} />

          <div style={{ display: 'flex', gap: 10 }}>
            <button class="btn btn-secondary" onClick={() => setView('list')}>Cancelar</button>
            <button class="btn btn-block" onClick={saveMovement}>Registrar movimiento</button>
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
            <button class="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={() => setView('list')}>Volver</button>
          </div>
          <p style={{ color: 'var(--muted)', margin: '8px 0 12px' }}>Stock actual: {selected.stock}</p>

          {movements.length === 0 && <p style={{ color: 'var(--muted)' }}>Sin movimientos.</p>}
          {movements.map(m => (
            <div key={m.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ color: m.type === 'in' ? 'var(--success)' : m.type === 'out' ? 'var(--danger)' : 'var(--warning)' }}>
                  {m.type === 'in' ? '+' : m.type === 'out' ? '−' : '='}{m.quantity}
                </strong>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {new Date(m.createdAt).toLocaleString('es-CU')}
                </span>
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
