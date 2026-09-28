import { useState, useEffect } from 'preact/hooks';
import { getAllProducts, Product } from '../../lib/storage';
import { enqueue } from '../../offline/syncEngine';

interface CartItem {
  id: string;
  name: string;
  priceCUP: number;
  priceUSD: number;
  qty: number;
}

export function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currency, setCurrency] = useState<'CUP' | 'USD'>('CUP');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getAllProducts().then(list => setProducts(list.filter(p => p.active !== false)));
  }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode || '').includes(search)
  );

  const add = (p: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === p.id);
      if (existing) {
        return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, {
        id: p.id,
        name: p.name,
        priceCUP: p.priceCUP,
        priceUSD: p.priceUSD,
        qty: 1,
      }];
    });
  };

  const total = cart.reduce((s, i) => s + (currency === 'CUP' ? i.priceCUP : i.priceUSD) * i.qty, 0);

  const pay = async () => {
    if (cart.length === 0) return;
    const sale = {
      id: crypto.randomUUID(),
      items: cart,
      currency,
      total,
      createdAt: Date.now(),
      paymentMethod: 'cash',
    };
    await enqueue('sale', sale);
    alert(`Venta registrada offline\nTotal: ${total.toFixed(2)} ${currency}\nSe sincronizará al recuperar conexión`);
    setCart([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 60px)' }}>
      <div class="card" style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
          <h2 style={{ fontSize: 18 }}>Punto de Venta</h2>
          <div class="grid-2" style={{ width: 140 }}>
            <button class={`btn ${currency === 'CUP' ? '' : 'btn-secondary'}`} style={{ padding: '8px' }}
              onClick={() => setCurrency('CUP')}>CUP</button>
            <button class={`btn ${currency === 'USD' ? '' : 'btn-secondary'}`} style={{ padding: '8px' }}
              onClick={() => setCurrency('USD')}>USD</button>
          </div>
        </div>

        <input class="input" placeholder="Buscar producto…" value={search}
          onInput={e => setSearch((e.target as HTMLInputElement).value)} style={{ marginBottom: 12 }} />

        <div class="grid-2" style={{ marginBottom: 16 }}>
          {filtered.length === 0 && (
            <p style={{ color: 'var(--muted)', gridColumn: '1 / -1' }}>
              {products.length === 0 ? 'No hay productos. Ve a Inventario y crea algunos.' : 'Sin resultados.'}
            </p>
          )}
          {filtered.map(p => (
            <button key={p.id} class="btn btn-secondary" style={{ flexDirection: 'column', height: 80 }}
              onClick={() => add(p)}>
              <span>{p.name}</span>
              <small>{currency === 'CUP' ? `${p.priceCUP} CUP` : `$${p.priceUSD}`} · Stock: {p.stock}</small>
            </button>
          ))}
        </div>

        <h3 style={{ marginBottom: 8 }}>Carrito</h3>
        {cart.length === 0 && <p style={{ color: 'var(--muted)' }}>Vacío</p>}
        {cart.map(i => (
          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span>{i.name} × {i.qty}</span>
            <strong>{((currency === 'CUP' ? i.priceCUP : i.priceUSD) * i.qty).toFixed(2)} {currency}</strong>
          </div>
        ))}
      </div>

      <div class="card" style={{ marginTop: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
          <span>Total</span>
          <span>{total.toFixed(2)} {currency}</span>
        </div>
        <button class="btn btn-block" onClick={pay} disabled={cart.length === 0}>
          Cobrar (efectivo / stubs TM / EnZona)
        </button>
      </div>
    </div>
  );
}
