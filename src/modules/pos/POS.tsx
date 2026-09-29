import { useState, useEffect } from 'preact/hooks';
import {
  getAllProducts, Product, getOpenShift, openShift, saveSale, Sale,
  deductStockForSale, getSettings,
} from '../../lib/storage';
import { enqueue } from '../../offline/syncEngine';
import { showToast } from '../../lib/toast';
import { newId } from '../../lib/id';

interface CartItem {
  id: string;
  name: string;
  priceCUP: number;
  priceUSD: number;
  qty: number;
  stock: number;
}

export function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currency, setCurrency] = useState<'CUP' | 'USD'>('CUP');
  const [search, setSearch] = useState('');
  const [shiftOpen, setShiftOpen] = useState(false);
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [floatCUP, setFloatCUP] = useState(0);
  const [opening, setOpening] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [paidCUP, setPaidCUP] = useState(0);
  const [paidUSD, setPaidUSD] = useState(0);
  const [rate, setRate] = useState(120);
  const [businessName, setBusinessName] = useState('Cuba POS');
  const [lastReceipt, setLastReceipt] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);

  const reload = async () => {
    try {
      const list = await getAllProducts();
      setProducts(list.filter(p => p.active !== false));
      const shift = await getOpenShift();
      setShiftOpen(!!shift);
      if (!shift) setShowOpenShift(true);
      const s = await getSettings();
      if (s.rateUSDToCUP) setRate(s.rateUSDToCUP);
      if (s.businessName) setBusinessName(s.businessName);
    } catch (e) {
      console.error(e);
      showToast('Error al cargar datos', 'error');
    }
  };

  useEffect(() => { reload(); }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode || '').includes(search)
  );

  const add = (p: Product) => {
    if (p.stock <= 0) {
      showToast('Sin stock de este producto', 'error');
      return;
    }
    setCart(prev => {
      const existing = prev.find(i => i.id === p.id);
      if (existing) {
        if (existing.qty + 1 > p.stock) {
          showToast('No hay suficiente stock', 'error');
          return prev;
        }
        return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, {
        id: p.id, name: p.name, priceCUP: p.priceCUP, priceUSD: p.priceUSD,
        qty: 1, stock: p.stock,
      }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      const next = i.qty + delta;
      if (next <= 0) return i;
      if (next > i.stock) {
        showToast('No hay suficiente stock', 'error');
        return i;
      }
      return { ...i, qty: next };
    }).filter(i => i.qty > 0));
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

  const subtotal = cart.reduce((s, i) => s + (currency === 'CUP' ? i.priceCUP : i.priceUSD) * i.qty, 0);
  const total = Math.max(0, subtotal - discount);

  const doOpenShift = async () => {
    if (opening) return;
    setOpening(true);
    try {
      // Fondo 0 es válido
      const amount = Number(floatCUP);
      const safe = Number.isFinite(amount) && amount >= 0 ? amount : 0;
      await openShift(safe, 0);
      setShiftOpen(true);
      setShowOpenShift(false);
      showToast(safe === 0 ? 'Turno abierto (sin fondo)' : `Turno abierto · fondo ${safe} CUP`, 'ok');
    } catch (e) {
      console.error('openShift error', e);
      showToast('No se pudo abrir el turno. Reintenta.', 'error');
    } finally {
      setOpening(false);
    }
  };

  const openPay = () => {
    if (!shiftOpen) {
      setShowOpenShift(true);
      showToast('Primero abre el turno de caja', 'info');
      return;
    }
    if (cart.length === 0) return;
    setDiscount(0);
    setPaidCUP(currency === 'CUP' ? total : 0);
    setPaidUSD(currency === 'USD' ? total : 0);
    setShowPay(true);
  };

  const paidTotalInSaleCurrency = () => {
    if (currency === 'CUP') return paidCUP + paidUSD * rate;
    return paidUSD + (rate > 0 ? paidCUP / rate : 0);
  };

  const changeAmount = Math.max(0, paidTotalInSaleCurrency() - total);

  const confirmPay = async () => {
    if (paidTotalInSaleCurrency() + 0.001 < total) {
      showToast('El pago no cubre el total', 'error');
      return;
    }
    try {
      const shift = await getOpenShift();
      const sale: Sale = {
        id: newId(),
        shiftId: shift?.id,
        items: cart.map(c => ({
          id: c.id, name: c.name, priceCUP: c.priceCUP, priceUSD: c.priceUSD, qty: c.qty,
        })),
        currency,
        subtotal,
        discount,
        total,
        paidCUP,
        paidUSD,
        changeCUP: currency === 'CUP' ? changeAmount : changeAmount * rate,
        paymentMethod: paidCUP > 0 && paidUSD > 0 ? 'mixto' : paidUSD > 0 ? 'efectivo_usd' : 'efectivo_cup',
        createdAt: Date.now(),
      };

      await saveSale(sale);
      await deductStockForSale(sale.items);
      await enqueue('sale', sale);

      const lines = [
        businessName,
        new Date(sale.createdAt).toLocaleString('es-CU'),
        '------------------------',
        ...sale.items.map(i => `${i.qty}x ${i.name}`),
        '------------------------',
        discount > 0 ? `Descuento: -${discount.toFixed(2)}` : '',
        `TOTAL: ${total.toFixed(2)} ${currency}`,
        paidCUP > 0 ? `Pagado CUP: ${paidCUP.toFixed(2)}` : '',
        paidUSD > 0 ? `Pagado USD: ${paidUSD.toFixed(2)}` : '',
        changeAmount > 0 ? `Cambio: ${changeAmount.toFixed(2)} ${currency}` : '',
        'Gracias por su compra',
      ].filter(Boolean).join('\n');

      setLastReceipt(lines);
      setCart([]);
      setShowPay(false);
      setShowReceipt(true);
      await reload();
      showToast(`Venta OK · ${total.toFixed(2)} ${currency}`, 'ok');
    } catch (e) {
      console.error(e);
      showToast('Error al guardar la venta', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 60px)' }}>
      <div
        class={shiftOpen ? 'shift-banner' : 'shift-banner closed'}
        onClick={() => { if (!shiftOpen) setShowOpenShift(true); }}
        style={{ cursor: shiftOpen ? 'default' : 'pointer' }}
      >
        {shiftOpen
          ? '● Turno abierto – puedes vender'
          : '○ Turno cerrado – toca aquí para abrir (fondo 0 permitido)'}
      </div>

      <div class="card" style={{ flex: 1, overflow: 'auto', marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
          <h2 style={{ fontSize: 18 }}>Punto de venta</h2>
          <div class="grid-2" style={{ width: 130 }}>
            <button type="button" class={`btn btn-sm ${currency === 'CUP' ? '' : 'btn-secondary'}`} onClick={() => setCurrency('CUP')}>CUP</button>
            <button type="button" class={`btn btn-sm ${currency === 'USD' ? '' : 'btn-secondary'}`} onClick={() => setCurrency('USD')}>USD</button>
          </div>
        </div>

        {!shiftOpen && (
          <button type="button" class="btn btn-block" style={{ marginBottom: 12 }} onClick={() => setShowOpenShift(true)}>
            Abrir turno de caja
          </button>
        )}

        <input class="input" placeholder="Buscar producto, SKU o código…" value={search}
          onInput={e => setSearch((e.target as HTMLInputElement).value)} style={{ marginBottom: 10 }} />

        <div class="grid-2" style={{ marginBottom: 12 }}>
          {filtered.length === 0 && (
            <div class="empty-state" style={{ gridColumn: '1 / -1' }}>
              {products.length === 0
                ? 'No hay productos. Ve a Inventario y crea algunos.'
                : 'Sin resultados para esa búsqueda.'}
            </div>
          )}
          {filtered.map(p => (
            <button type="button" key={p.id} class="btn btn-secondary" style={{ flexDirection: 'column', height: 78, opacity: p.stock <= 0 ? 0.5 : 1 }}
              onClick={() => add(p)}>
              <span style={{ fontSize: 14 }}>{p.name}</span>
              <small>
                {currency === 'CUP' ? `${p.priceCUP} CUP` : `$${p.priceUSD}`}
                {' · '}
                <span style={{ color: p.stock <= (p.minStock || 0) ? 'var(--danger)' : 'inherit' }}>
                  Stock {p.stock}
                </span>
              </small>
            </button>
          ))}
        </div>

        <h3 style={{ marginBottom: 6, fontSize: 15 }}>Carrito</h3>
        {cart.length === 0 && <p class="muted">Toca un producto para agregarlo</p>}
        {cart.map(i => (
          <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{i.name}</div>
              <div class="muted">{(currency === 'CUP' ? i.priceCUP : i.priceUSD).toFixed(2)} c/u</div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onClick={() => changeQty(i.id, -1)}>−</button>
            <strong style={{ minWidth: 24, textAlign: 'center' }}>{i.qty}</strong>
            <button type="button" class="btn btn-secondary btn-sm" onClick={() => changeQty(i.id, 1)}>+</button>
            <button type="button" class="btn btn-danger btn-sm" onClick={() => removeItem(i.id)}>×</button>
          </div>
        ))}
      </div>

      <div class="card" style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
          <span>Total</span>
          <span>{total.toFixed(2)} {currency}</span>
        </div>
        <button type="button" class="btn btn-block" onClick={openPay} disabled={cart.length === 0}>
          Cobrar
        </button>
      </div>

      {showOpenShift && (
        <div class="modal-backdrop">
          <div class="modal-sheet" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Abrir turno de caja</h2>
            <p class="muted" style={{ marginBottom: 12 }}>
              Indica el fondo de caja (efectivo inicial). Puedes dejar <strong>0</strong> si no hay fondo.
            </p>
            <label class="muted">Fondo en CUP</label>
            <input
              class="input"
              type="number"
              min="0"
              inputMode="decimal"
              value={String(floatCUP)}
              onInput={e => {
                const v = (e.target as HTMLInputElement).value;
                if (v === '' || v === '-') {
                  setFloatCUP(0);
                  return;
                }
                const n = parseFloat(v);
                setFloatCUP(Number.isFinite(n) && n >= 0 ? n : 0);
              }}
              style={{ marginBottom: 14 }}
            />
            <button type="button" class="btn btn-block" onClick={doOpenShift} disabled={opening}>
              {opening ? 'Abriendo…' : 'Abrir turno'}
            </button>
            {shiftOpen && (
              <button type="button" class="btn btn-secondary btn-block" style={{ marginTop: 8 }} onClick={() => setShowOpenShift(false)}>Cancelar</button>
            )}
          </div>
        </div>
      )}

      {showPay && (
        <div class="modal-backdrop">
          <div class="modal-sheet">
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Cobrar</h2>
            <p style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{total.toFixed(2)} {currency}</p>
            <label class="muted">Descuento ({currency})</label>
            <input class="input" type="number" min="0" value={discount || ''}
              onInput={e => setDiscount(Math.max(0, parseFloat((e.target as HTMLInputElement).value) || 0))}
              style={{ marginBottom: 10 }} />
            <label class="muted">Paga en CUP</label>
            <input class="input" type="number" min="0" value={paidCUP || ''}
              onInput={e => setPaidCUP(parseFloat((e.target as HTMLInputElement).value) || 0)}
              style={{ marginBottom: 10 }} />
            <label class="muted">Paga en USD</label>
            <input class="input" type="number" min="0" step="0.01" value={paidUSD || ''}
              onInput={e => setPaidUSD(parseFloat((e.target as HTMLInputElement).value) || 0)}
              style={{ marginBottom: 10 }} />
            <p class="muted" style={{ marginBottom: 8 }}>Tasa usada: 1 USD = {rate} CUP</p>
            <div style={{
              padding: 12, borderRadius: 10, marginBottom: 12,
              background: changeAmount >= 0 && paidTotalInSaleCurrency() >= total ? '#dcfce7' : '#fee2e2',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Cambio</span>
                <span>{changeAmount.toFixed(2)} {currency}</span>
              </div>
            </div>
            <div class="grid-2">
              <button type="button" class="btn btn-secondary" onClick={() => setShowPay(false)}>Volver</button>
              <button type="button" class="btn" onClick={confirmPay}>Confirmar venta</button>
            </div>
          </div>
        </div>
      )}

      {showReceipt && (
        <div class="modal-backdrop">
          <div class="modal-sheet">
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Ticket</h2>
            <pre style={{
              whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13,
              background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12,
            }}>{lastReceipt}</pre>
            <button type="button" class="btn btn-block" onClick={() => {
              if (navigator.clipboard) navigator.clipboard.writeText(lastReceipt).then(() => showToast('Ticket copiado', 'ok'));
              setShowReceipt(false);
            }}>Copiar y cerrar</button>
            <button type="button" class="btn btn-secondary btn-block" style={{ marginTop: 8 }} onClick={() => setShowReceipt(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
