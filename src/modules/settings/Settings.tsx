import { useState } from 'preact/hooks';

export function Settings() {
  const [msg, setMsg] = useState('');

  return (
    <div style={{ padding: 12 }}>
      <h1 style={{ fontSize: 22, margin: '12px 0' }}>Ajustes</h1>
      <div class="card">
        <h3>Configuración general</h3>
        <p style={{ color: 'var(--muted)', margin: '8px 0 16px', fontSize: 14 }}>
          Todas las opciones del autodiagnóstico y módulos se pueden cambiar aquí.
        </p>
        <button class="btn btn-secondary btn-block" style={{ marginBottom: 8 }}
          onClick={() => setMsg('En una versión completa se reabre el asistente fiscal.')}>
          Re-ejecutar autodiagnóstico fiscal
        </button>
        <button class="btn btn-secondary btn-block" style={{ marginBottom: 8 }}
          onClick={() => setMsg('Tasas 1×24 / 1×120 / flotante BCC configurables.')}>
          Monedas y tasas de cambio
        </button>
        <button class="btn btn-secondary btn-block" style={{ marginBottom: 8 }}
          onClick={() => setMsg('Módulos activables: inventario, POS, arqueo, contabilidad formal, lealtad…')}>
          Módulos activos
        </button>
        <button class="btn btn-secondary btn-block"
          onClick={() => setMsg('Preparación de interfaces Transfermóvil y EnZona lista.')}>
          Pasarelas de pago (stubs)
        </button>
        {msg && <p style={{ marginTop: 16, color: 'var(--primary)' }}>{msg}</p>}
      </div>
    </div>
  );
}
