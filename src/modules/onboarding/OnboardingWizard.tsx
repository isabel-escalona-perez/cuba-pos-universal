import { useState } from 'preact/hooks';
import { saveFiscalProfile, setOnboardingCompleted } from '../../lib/storage';

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [data, setData] = useState({
    actorType: '',
    exceedsThreshold: null as boolean | null,
    hasFormalAccounting: '',
    existingSoftware: '',
    mainCurrency: '',
    exchangeRate: ''
  });

  const next = () => setStep(s => Math.min(6, s + 1) as Step);
  const prev = () => setStep(s => Math.max(1, s - 1) as Step);

  const finish = async () => {
    const needsFormal = data.exceedsThreshold === true;
    await saveFiscalProfile({
      ...data,
      accountingMode: needsFormal ? 'formal' : 'simple_register',
      modules: {
        inventory: true,
        pos: true,
        cash: true,
        formalAccounting: needsFormal,
        simpleRegister: !needsFormal
      }
    });
    await setOnboardingCompleted();
    onComplete();
  };

  return (
    <div class="card" style={{ maxWidth: 520, margin: '24px auto' }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Configuración inicial</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
        Paso {step} de 6 · Autodiagnóstico fiscal ONAT
      </p>

      {step === 1 && (
        <>
          <h3>Tipo de actor económico</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {['mipyme_privada', 'mipyme_estatal', 'mipyme_mixta', 'CNA', 'TCP'].map(t => (
              <button key={t} class={`btn ${data.actorType === t ? '' : 'btn-secondary'}`}
                onClick={() => setData({ ...data, actorType: t })}>
                {t.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h3>¿Ingresos anuales estimados ≥ 500 000 CUP?</h3>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: '8px 0 16px' }}>
            Resolución 272/2024 del MFP. Determina si necesita contabilidad formal.
          </p>
          <div class="grid-2">
            <button class={`btn ${data.exceedsThreshold === true ? '' : 'btn-secondary'}`}
              onClick={() => setData({ ...data, exceedsThreshold: true })}>Sí</button>
            <button class={`btn ${data.exceedsThreshold === false ? '' : 'btn-secondary'}`}
              onClick={() => setData({ ...data, exceedsThreshold: false })}>No</button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h3>¿Lleva contabilidad formal actualmente?</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {['Sí', 'No', 'No sé'].map(v => (
              <button key={v} class={`btn ${data.hasFormalAccounting === v ? '' : 'btn-secondary'}`}
                onClick={() => setData({ ...data, hasFormalAccounting: v })}>{v}</button>
            ))}
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <h3>¿Utiliza algún software certificado?</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {['Versat Sarasola', 'ZOOM LC Odoo', 'Siscont5', 'Otro', 'Ninguno'].map(v => (
              <button key={v} class={`btn ${data.existingSoftware === v ? '' : 'btn-secondary'}`}
                onClick={() => setData({ ...data, existingSoftware: v })}>{v}</button>
            ))}
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <h3>Moneda principal de operación</h3>
          <div class="grid-3" style={{ marginTop: 12 }}>
            {['CUP', 'USD', 'Ambas'].map(v => (
              <button key={v} class={`btn ${data.mainCurrency === v ? '' : 'btn-secondary'}`}
                onClick={() => setData({ ...data, mainCurrency: v })}>{v}</button>
            ))}
          </div>
        </>
      )}

      {step === 6 && (
        <>
          <h3>Tasa de cambio aplicable</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {[
              { id: '1x24', label: '1 × 24 (personas jurídicas)' },
              { id: '1x120', label: '1 × 120 (personas físicas)' },
              { id: 'floating', label: 'Flotante BCC (actualizable)' },
              { id: 'custom', label: 'Personalizada' }
            ].map(o => (
              <button key={o.id} class={`btn ${data.exchangeRate === o.id ? '' : 'btn-secondary'}`}
                onClick={() => setData({ ...data, exchangeRate: o.id })}>{o.label}</button>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
        {step > 1 && <button class="btn btn-secondary" onClick={prev}>Atrás</button>}
        {step < 6
          ? <button class="btn btn-block" onClick={next} disabled={
              (step === 1 && !data.actorType) ||
              (step === 2 && data.exceedsThreshold === null) ||
              (step === 3 && !data.hasFormalAccounting) ||
              (step === 4 && !data.existingSoftware) ||
              (step === 5 && !data.mainCurrency)
            }>Siguiente</button>
          : <button class="btn btn-block" onClick={finish} disabled={!data.exchangeRate}>
              Finalizar y entrar a la app
            </button>
        }
      </div>
    </div>
  );
}
