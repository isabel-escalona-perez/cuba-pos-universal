export function Dashboard() {
  return (
    <div style={{ padding: 12 }}>
      <h1 style={{ fontSize: 22, margin: '12px 0' }}>Dashboard</h1>
      <div class="grid-2">
        <div class="card">
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ventas hoy</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>0 CUP</div>
        </div>
        <div class="card">
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ticket promedio</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>0</div>
        </div>
        <div class="card">
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Productos en stock</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>—</div>
        </div>
        <div class="card">
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Diferencias de caja</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>0</div>
        </div>
      </div>
      <div class="card" style={{ marginTop: 12 }}>
        <h3>Próximos pasos</h3>
        <ul style={{ marginTop: 8, paddingLeft: 20, color: 'var(--muted)', lineHeight: 1.6 }}>
          <li>Completar catálogo de productos</li>
          <li>Abrir turno de caja</li>
          <li>Configurar impresora térmica</li>
          <li>Probar modo offline</li>
        </ul>
      </div>
    </div>
  );
}
