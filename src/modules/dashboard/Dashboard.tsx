import { useState, useEffect } from 'preact/hooks';
import { getDashboardStats, getLowStockProducts, Product, getSettings } from '../../lib/storage';

export function Dashboard() {
  const [totalCUP, setTotalCUP] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [avgTicket, setAvgTicket] = useState(0);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [businessName, setBusinessName] = useState('Cuba POS');
  const [shiftOpen, setShiftOpen] = useState(false);

  const load = async () => {
    const s = await getSettings();
    const rate = s.rateUSDToCUP || 120;
    if (s.businessName) setBusinessName(s.businessName);
    const stats = await getDashboardStats(rate);
    setTotalCUP(stats.totalCUP);
    setSalesCount(stats.salesCount);
    setAvgTicket(stats.avgTicket);
    setShiftOpen(!!stats.openShift);
    setLowStock(await getLowStockProducts());
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 4, overflow: 'auto', height: 'calc(100% - 60px)' }}>
      <div style={{ padding: '12px 12px 0' }}>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>{businessName}</h1>
        <p class="muted">Resumen de hoy · {shiftOpen ? 'Turno abierto' : 'Turno cerrado'}</p>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="muted">Ventas de hoy</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{totalCUP.toFixed(0)} CUP</div>
        </div>
        <div class="card">
          <div class="muted">Cantidad de ventas</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{salesCount}</div>
        </div>
        <div class="card">
          <div class="muted">Ticket promedio</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{avgTicket.toFixed(0)} CUP</div>
        </div>
        <div class="card">
          <div class="muted">Stock bajo</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: lowStock.length ? 'var(--danger)' : 'inherit' }}>
            {lowStock.length}
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style={{ fontSize: 16, marginBottom: 10 }}>Acciones rápidas</h3>
        <div class="grid-2">
          <a href="/pos" class="btn" style={{ textDecoration: 'none' }}>Vender</a>
          <a href="/cash" class="btn btn-secondary" style={{ textDecoration: 'none' }}>Arquear caja</a>
          <a href="/inventory" class="btn btn-secondary" style={{ textDecoration: 'none' }}>Inventario</a>
          <a href="/settings" class="btn btn-secondary" style={{ textDecoration: 'none' }}>Ajustes</a>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div class="card">
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Productos con stock bajo</h3>
          {lowStock.slice(0, 8).map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{p.name}</span>
              <span class="badge badge-danger">{p.stock} / mín {p.minStock || 0}</span>
            </div>
          ))}
        </div>
      )}

      {salesCount === 0 && lowStock.length === 0 && (
        <div class="card empty-state">
          <p>Aún no hay ventas hoy.</p>
          <p class="muted">Abre el turno en POS y registra la primera venta.</p>
          <a href="/pos" class="btn" style={{ textDecoration: 'none', display: 'inline-flex' }}>Ir a vender</a>
        </div>
      )}
    </div>
  );
}
