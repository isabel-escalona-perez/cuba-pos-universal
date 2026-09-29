import { useState, useEffect } from 'preact/hooks';
import { getSettings, saveSettings, AppSettings } from '../../lib/storage';
import { showToast } from '../../lib/toast';

export function Settings() {
  const [form, setForm] = useState<AppSettings>({
    businessName: '',
    businessPhone: '',
    rateUSDToCUP: 120,
    ticketFooter: 'Gracias por su compra',
  });

  useEffect(() => {
    getSettings().then(s => setForm({
      businessName: s.businessName || '',
      businessPhone: s.businessPhone || '',
      rateUSDToCUP: s.rateUSDToCUP || 120,
      ticketFooter: s.ticketFooter || 'Gracias por su compra',
    }));
  }, []);

  const save = async () => {
    await saveSettings({
      businessName: form.businessName?.trim(),
      businessPhone: form.businessPhone?.trim(),
      rateUSDToCUP: Number(form.rateUSDToCUP) || 120,
      ticketFooter: form.ticketFooter?.trim(),
    });
    showToast('Ajustes guardados', 'ok');
  };

  return (
    <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
      <div class="card">
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Ajustes</h1>

        <label class="muted">Nombre del negocio</label>
        <input class="input" value={form.businessName || ''}
          onInput={e => setForm({ ...form, businessName: (e.target as HTMLInputElement).value })}
          placeholder="Ej. Cafetería El Portal" style={{ marginBottom: 12 }} />

        <label class="muted">Teléfono</label>
        <input class="input" value={form.businessPhone || ''}
          onInput={e => setForm({ ...form, businessPhone: (e.target as HTMLInputElement).value })}
          placeholder="Opcional" style={{ marginBottom: 12 }} />

        <label class="muted">Tasa USD → CUP (ej. 120 o 24)</label>
        <input class="input" type="number" min="1" value={form.rateUSDToCUP || 120}
          onInput={e => setForm({ ...form, rateUSDToCUP: parseFloat((e.target as HTMLInputElement).value) || 120 })}
          style={{ marginBottom: 12 }} />

        <label class="muted">Pie del ticket</label>
        <input class="input" value={form.ticketFooter || ''}
          onInput={e => setForm({ ...form, ticketFooter: (e.target as HTMLInputElement).value })}
          style={{ marginBottom: 16 }} />

        <button class="btn btn-block" onClick={save}>Guardar ajustes</button>
      </div>

      <div class="card">
        <h3 style={{ fontSize: 15, marginBottom: 8 }}>Sobre esta app</h3>
        <p class="muted">
          Cuba POS Universal · Offline-first · Multimoneda CUP/USD · Compatible Android 5+.
          Los datos se guardan en este dispositivo y se sincronizan cuando haya conexión.
        </p>
      </div>
    </div>
  );
}
