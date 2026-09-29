import { useState, useEffect } from 'preact/hooks';
import {
  buildStats, BuiltStats, PeriodKey, StatKey, DEFAULT_VISIBLE_STATS,
  getSettings, saveSettings,
} from '../../lib/storage';
import { showToast } from '../../lib/toast';

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'week', label: '7 días' },
  { key: 'month', label: 'Mes' },
  { key: 'shift', label: 'Turno' },
  { key: 'all', label: 'Todo' },
];

const STAT_OPTIONS: { key: StatKey; label: string }[] = [
  { key: 'totalSales', label: 'Total vendido (CUP)' },
  { key: 'salesCount', label: 'Cantidad de ventas' },
  { key: 'avgTicket', label: 'Ticket promedio' },
  { key: 'totalDiscount', label: 'Descuentos' },
  { key: 'paidCUP', label: 'Cobrado en CUP' },
  { key: 'paidUSD', label: 'Cobrado en USD' },
  { key: 'topProducts', label: 'Productos más vendidos' },
  { key: 'byPayment', label: 'Por forma de pago' },
  { key: 'byCurrency', label: 'Por moneda' },
  { key: 'shiftSummary', label: 'Resumen del turno' },
  { key: 'lowStock', label: 'Stock bajo' },
  { key: 'inventoryValue', label: 'Valor de inventario' },
];

const PAY_LABELS: Record<string, string> = {
  efectivo_cup: 'Efectivo CUP',
  efectivo_usd: 'Efectivo USD',
  mixto: 'Pago mixto',
  cash: 'Efectivo',
};

export function Stats() {
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [stats, setStats] = useState<BuiltStats | null>(null);
  const [rate, setRate] = useState(120);
  const [visible, setVisible] = useState<StatKey[]>(DEFAULT_VISIBLE_STATS);
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async (p: PeriodKey = period) => {
    setLoading(true);
    try {
      const s = await getSettings();
      const r = s.rateUSDToCUP || 120;
      setRate(r);
      const vis = s.visibleStats && s.visibleStats.length > 0 ? s.visibleStats : DEFAULT_VISIBLE_STATS;
      setVisible(vis);
      setStats(await buildStats(p, r));
    } catch (e) {
      console.error(e);
      showToast('Error al cargar estadísticas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load('today'); }, []);

  const changePeriod = async (p: PeriodKey) => {
    setPeriod(p);
    await load(p);
  };

  const toggleStat = (key: StatKey) => {
    setVisible(prev =>
      prev.indexOf(key) >= 0 ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const saveVisible = async () => {
    await saveSettings({ visibleStats: visible });
    setShowConfig(false);
    showToast('Preferencias de estadísticas guardadas', 'ok');
  };

  const show = (key: StatKey) => visible.indexOf(key) >= 0;

  return (
    <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
      <div class="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h1 style={{ fontSize: 18, margin: 0 }}>Estadísticas</h1>
          <button type="button" class="btn btn-secondary btn-sm" onClick={() => setShowConfig(true)}>
            Elegir datos
          </button>
        </div>
        <p class="muted" style={{ marginTop: 6 }}>Elige el período y qué números quieres ver.</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {PERIODS.map(p => (
            <button
              type="button"
              key={p.key}
              class={`btn btn-sm ${period === p.key ? '' : 'btn-secondary'}`}
              onClick={() => changePeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div class="card empty-state">Cargando…</div>
      )}

      {!loading && stats && (
        <>
          <div class="grid-2">
            {show('totalSales') && (
              <div class="card">
                <div class="muted">Total vendido</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.totalCUP.toFixed(0)} CUP</div>
              </div>
            )}
            {show('salesCount') && (
              <div class="card">
                <div class="muted">Ventas</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.salesCount}</div>
              </div>
            )}
            {show('avgTicket') && (
              <div class="card">
                <div class="muted">Ticket promedio</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.avgTicket.toFixed(0)} CUP</div>
              </div>
            )}
            {show('totalDiscount') && (
              <div class="card">
                <div class="muted">Descuentos</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.totalDiscount.toFixed(0)} CUP</div>
              </div>
            )}
            {show('paidCUP') && (
              <div class="card">
                <div class="muted">Cobrado CUP</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.paidCUP.toFixed(0)}</div>
              </div>
            )}
            {show('paidUSD') && (
              <div class="card">
                <div class="muted">Cobrado USD</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.paidUSD.toFixed(2)}</div>
              </div>
            )}
            {show('inventoryValue') && (
              <div class="card">
                <div class="muted">Valor inventario</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.inventoryValueCUP.toFixed(0)} CUP</div>
              </div>
            )}
          </div>

          {show('shiftSummary') && stats.shiftInfo && (
            <div class="card">
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Turno actual</h3>
              {stats.shiftInfo.open ? (
                <>
                  <p>Estado: <span class="badge badge-ok">Abierto</span></p>
                  <p class="muted">Desde: {stats.shiftInfo.openedAt ? new Date(stats.shiftInfo.openedAt).toLocaleString('es-CU') : '—'}</p>
                  <p>Fondo: {stats.shiftInfo.floatCUP ?? 0} CUP</p>
                  <p>Ventas del turno: {stats.shiftInfo.salesCount} · {(stats.shiftInfo.salesCUP || 0).toFixed(0)} CUP</p>
                </>
              ) : (
                <p class="muted">No hay turno abierto.</p>
              )}
            </div>
          )}

          {show('byCurrency') && (
            <div class="card">
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Por moneda</h3>
              <div class="grid-2">
                <div>
                  <div class="muted">CUP</div>
                  <strong>{stats.byCurrency.CUP.toFixed(0)}</strong>
                  <span class="muted"> · {stats.byCurrency.countCUP} ventas</span>
                </div>
                <div>
                  <div class="muted">USD</div>
                  <strong>{stats.byCurrency.USD.toFixed(2)}</strong>
                  <span class="muted"> · {stats.byCurrency.countUSD} ventas</span>
                </div>
              </div>
              <p class="muted" style={{ marginTop: 8 }}>Tasa usada: 1 USD = {rate} CUP</p>
            </div>
          )}

          {show('byPayment') && (
            <div class="card">
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Por forma de pago</h3>
              {stats.byPayment.length === 0 && <p class="muted">Sin datos en este período.</p>}
              {stats.byPayment.map(p => (
                <div key={p.method} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span>{PAY_LABELS[p.method] || p.method} · {p.count}</span>
                  <strong>{p.amountCUP.toFixed(0)} CUP</strong>
                </div>
              ))}
            </div>
          )}

          {show('topProducts') && (
            <div class="card">
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Más vendidos</h3>
              {stats.topProducts.length === 0 && <p class="muted">Sin ventas en este período.</p>}
              {stats.topProducts.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span>{i + 1}. {p.name} × {p.qty}</span>
                  <strong>{p.amountCUP.toFixed(0)} CUP</strong>
                </div>
              ))}
            </div>
          )}

          {show('lowStock') && (
            <div class="card">
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Stock bajo</h3>
              {stats.lowStock.length === 0 && <p class="muted">Ningún producto bajo el mínimo.</p>}
              {stats.lowStock.slice(0, 15).map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span>{p.name}</span>
                  <span class="badge badge-danger">{p.stock} / {p.minStock || 0}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showConfig && (
        <div class="modal-backdrop">
          <div class="modal-sheet">
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>¿Qué estadísticas mostrar?</h2>
            <p class="muted" style={{ marginBottom: 12 }}>Marca las que quieres ver en esta pantalla.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '50vh', overflow: 'auto' }}>
              {STAT_OPTIONS.map(opt => {
                const on = visible.indexOf(opt.key) >= 0;
                return (
                  <label
                    key={opt.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10, fontWeight: 600, fontSize: 14,
                      background: on ? '#ccfbf1' : '#fff',
                      border: on ? '1px solid #0f766e' : '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleStat(opt.key)}
                      style={{ width: 18, height: 18 }}
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
            <div class="grid-2" style={{ marginTop: 14 }}>
              <button type="button" class="btn btn-secondary" onClick={() => setShowConfig(false)}>Cancelar</button>
              <button type="button" class="btn" onClick={saveVisible}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
