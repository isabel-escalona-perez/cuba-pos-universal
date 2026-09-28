import { useState, useMemo } from 'preact/hooks';
import { enqueue } from '../../offline/syncEngine';

const CUP_DENOMS = [
  { value: 1000, label: '1000 CUP' },
  { value: 500, label: '500 CUP' },
  { value: 200, label: '200 CUP' },
  { value: 100, label: '100 CUP' },
  { value: 50, label: '50 CUP' },
  { value: 20, label: '20 CUP' },
  { value: 10, label: '10 CUP' },
  { value: 5, label: '5 CUP' },
  { value: 3, label: '3 CUP' },
  { value: 1, label: '1 CUP' },
  { value: 0.05, label: '5 cent' },
  { value: 0.01, label: '1 cent' },
];

const USD_DENOMS = [
  { value: 100, label: '100 USD' },
  { value: 50, label: '50 USD' },
  { value: 20, label: '20 USD' },
  { value: 10, label: '10 USD' },
  { value: 5, label: '5 USD' },
  { value: 1, label: '1 USD' },
  { value: 0.25, label: '25 ¢' },
  { value: 0.10, label: '10 ¢' },
  { value: 0.05, label: '5 ¢' },
  { value: 0.01, label: '1 ¢' },
];

export function CashCounter() {
  const [currency, setCurrency] = useState<'CUP' | 'USD'>('CUP');
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [expected, setExpected] = useState(0);

  const denoms = currency === 'CUP' ? CUP_DENOMS : USD_DENOMS;

  const total = useMemo(() => {
    return denoms.reduce((sum, d) => sum + (counts[d.value] || 0) * d.value, 0);
  }, [counts, currency]);

  const diff = total - expected;
  const status = Math.abs(diff) < 0.01 ? 'ok' : Math.abs(diff) < 50 ? 'warn' : 'bad';

  const setQty = (value: number, qty: number) => {
    setCounts(prev => ({ ...prev, [value]: Math.max(0, qty) }));
  };

  const save = async () => {
    const count = {
      id: crypto.randomUUID(),
      currency,
      total,
      expected,
      difference: diff,
      denominations: { ...counts },
      createdAt: Date.now(),
    };
    await enqueue('cash_count', count);
    alert(`Arqueo guardado offline\nTotal: ${total.toFixed(2)} ${currency}\nDiferencia: ${diff.toFixed(2)}`);
  };

  return (
    <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
      <div class="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18 }}>Arqueo de caja</h2>
          <div class="grid-2" style={{ width: 140 }}>
            <button class={`btn ${currency === 'CUP' ? '' : 'btn-secondary'}`} style={{ padding: '8px' }}
              onClick={() => { setCurrency('CUP'); setCounts({}); }}>CUP</button>
            <button class={`btn ${currency === 'USD' ? '' : 'btn-secondary'}`} style={{ padding: '8px' }}
              onClick={() => { setCurrency('USD'); setCounts({}); }}>USD</button>
          </div>
        </div>

        <div style={{ margin: '12px 0' }}>
          <label style={{ fontSize: 14 }}>Monto esperado del turno</label>
          <input class="input" type="number" value={expected || ''}
            onInput={e => setExpected(parseFloat((e.target as HTMLInputElement).value) || 0)}
            placeholder="0.00" />
        </div>
      </div>

      <div class="card">
        {denoms.map(d => (
          <div key={d.value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ width: 90, fontWeight: 600 }}>{d.label}</span>
            <button class="btn btn-secondary" style={{ padding: '8px 14px', minHeight: 40 }}
              onClick={() => setQty(d.value, (counts[d.value] || 0) - 1)}>−</button>
            <input class="input" style={{ width: 70, textAlign: 'center', minHeight: 40 }}
              type="number" min="0" value={counts[d.value] || 0}
              onInput={e => setQty(d.value, parseInt((e.target as HTMLInputElement).value) || 0)} />
            <button class="btn btn-secondary" style={{ padding: '8px 14px', minHeight: 40 }}
              onClick={() => setQty(d.value, (counts[d.value] || 0) + 1)}>+</button>
            <span style={{ marginLeft: 'auto', fontWeight: 600 }}>
              {((counts[d.value] || 0) * d.value).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      <div class="card" style={{
        background: status === 'ok' ? '#dcfce7' : status === 'warn' ? '#fef3c7' : '#fee2e2'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
          <span>Total contado</span>
          <span>{total.toFixed(2)} {currency}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span>Diferencia</span>
          <span style={{ fontWeight: 700, color: status === 'ok' ? 'var(--success)' : status === 'warn' ? 'var(--warning)' : 'var(--danger)' }}>
            {diff >= 0 ? '+' : ''}{diff.toFixed(2)} {currency}
          </span>
        </div>
        <button class="btn btn-block" style={{ marginTop: 16 }} onClick={save}>
          Guardar arqueo
        </button>
      </div>
    </div>
  );
}
