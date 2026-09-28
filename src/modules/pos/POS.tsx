import { useState } from 'preact/hooks';

interface CartItem {
  id: string;
  name: string;
  priceCUP: number;
  priceUSD: number;
  qty: number;
}

const SAMPLE_PRODUCTS = [
  { id: '1', name: 'Agua 500ml', priceCUP: 50, priceUSD: 0.5 },
  { id: '2', name: 'Café cubano', priceCUP: 80, priceUSD: 0.8 },
  { id: '3', name: 'Sándwich', priceCUP: 250, priceUSD: 2.5 },
  { id: '4', name: 'Refresco', priceCUP: 120, priceUSD: 1.2 },
];

export function POS() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currency, setCurrency] = useState<'CUP' | 'USD'>('CUP');

  const add = (p: typeof SAMPLE_PRODUCTS[0]) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === p.id);
      if (existing) {
        return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...p, qty: 1 }];
    });
  };

  const total = cart.reduce((s, i) => s + (currency === 'CUP' ? i.priceCUP : i.priceUSD) * i.qty, 0);

  const pay = () => {
    if (cart.length === 0) return;
    alert(`Venta registrada offline\nTotal: ${total.toFixed(2)} ${currency}\n(Se sincronizará al recuperar conexión)`);
    setCart([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 60px)' }}>
      <div class="card" style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18 }}>Punto de Venta</h2>
          <div class="grid-2" style={{ width: 140 }}>
            <button class={`btn ${currency === 'CUP' ? '' : 'btn-secondary'}`} style={{ padding: '8px' }}
              onClick={() => setCurrency('CUP')}>CUP</button>
            <button class={`btn ${currency === 'USD' ? '' : 'btn-secondary'}`} style={{ padding: '8px' }}
              onClick={() => setCurrency('USD')}>USD</button>
          </div>
        </div>

        <div class="grid-2" style={{ marginBottom: 16 }}>
          {SAMPLE_PRODUCTS.map(p => (
            <button key={p.id} class="btn btn-secondary" style={{ flexDirection: 'column', height: 80 }}
              onClick={() => add(p)}>
              <span>{p.name}</span>
              <small>{currency === 'CUP' ? `${p.priceCUP} CUP` : `$${p.priceUSD}`}</small>
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
