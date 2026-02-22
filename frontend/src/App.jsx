import { useState, useEffect } from 'react';
import { fetchStores, generatePlan } from './api';

// ──────────────────────────────────────────────
// Styles (inline, zero dependencies)
// ──────────────────────────────────────────────
const s = {
  header: {
    background: 'linear-gradient(135deg, #16a34a, #15803d)',
    color: 'white',
    padding: '20px 16px 16px',
    textAlign: 'center',
  },
  logo: { fontSize: 28, fontWeight: 700, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, opacity: 0.85, marginTop: 2 },
  screen: { padding: 16 },
  label: { display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14, color: '#374151' },
  storeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 },
  storeBtn: (active) => ({
    padding: '12px 8px',
    borderRadius: 12,
    border: active ? '2px solid #16a34a' : '2px solid #e5e7eb',
    background: active ? '#f0fdf4' : 'white',
    color: active ? '#15803d' : '#374151',
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    fontSize: 14,
    transition: 'all 0.15s',
  }),
  input: {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: '2px solid #e5e7eb', fontSize: 18, fontWeight: 600,
    marginBottom: 20, outline: 'none', color: '#1a1a1a',
  },
  btn: (disabled) => ({
    width: '100%', padding: '14px', borderRadius: 14,
    background: disabled ? '#d1d5db' : 'linear-gradient(135deg, #16a34a, #15803d)',
    color: 'white', fontWeight: 700, fontSize: 16,
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
  }),
  error: {
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: 12, padding: 14, marginBottom: 16,
    color: '#dc2626', fontSize: 14,
  },
  warning: {
    background: '#fffbeb', border: '1px solid #fde68a',
    borderRadius: 12, padding: 14, marginBottom: 16,
    color: '#92400e', fontSize: 14,
  },
  summaryBox: {
    background: 'linear-gradient(135deg, #16a34a, #15803d)',
    borderRadius: 16, padding: 16, marginBottom: 20, color: 'white',
  },
  summaryTitle: { fontSize: 13, opacity: 0.85, marginBottom: 8 },
  summaryKcal: { fontSize: 36, fontWeight: 800, lineHeight: 1 },
  macros: { display: 'flex', gap: 12, marginTop: 12 },
  macro: { flex: 1, textAlign: 'center' },
  macroVal: { fontSize: 18, fontWeight: 700 },
  macroLbl: { fontSize: 11, opacity: 0.8 },
  mealCard: {
    background: 'white', borderRadius: 16,
    border: '1px solid #e5e7eb', marginBottom: 12,
    overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  mealHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 14px', background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
  },
  mealType: { fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5 },
  mealName: { fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginTop: 1 },
  mealKcal: { fontSize: 20, fontWeight: 800, color: '#16a34a' },
  mealKcalLbl: { fontSize: 10, color: '#6b7280' },
  ingredientList: { padding: '10px 14px' },
  ingredient: {
    display: 'flex', justifyContent: 'space-between',
    padding: '5px 0', borderBottom: '1px solid #f3f4f6',
    fontSize: 13, color: '#4b5563',
  },
  backBtn: {
    background: 'none', border: '2px solid #16a34a',
    color: '#16a34a', borderRadius: 12, padding: '12px',
    fontWeight: 700, fontSize: 15, cursor: 'pointer', width: '100%',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#1a1a1a' },
  divider: { height: 1, background: '#f3f4f6', margin: '20px 0' },
  spinner: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    padding: 40, flexDirection: 'column', gap: 12,
  },
};

// Unit formatter
function formatIngredient(ing) {
  const labels = { g: 'g', ml: 'ml', piece: 'szt', tbsp: 'łyżka', tsp: 'łyżeczka', cup: 'szklanka' };
  return `${ing.quantity} ${labels[ing.unit] || ing.unit} ${ing.product_name}`;
}

// ──────────────────────────────────────────────
// Screen: Ustawienia (wybor sklepow + kalorie)
// ──────────────────────────────────────────────
function SettingsScreen({ onGenerate }) {
  const [stores, setStores] = useState([]);
  const [selected, setSelected] = useState([]);
  const [calories, setCalories] = useState('2000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchStores()
      .then(data => { setStores(data); setFetching(false); })
      .catch(() => { setError('Nie można załadować sklepów. Sprawdź połączenie.'); setFetching(false); });
  }, []);

  const toggle = (id) => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const handleGenerate = async () => {
    if (!selected.length) return setError('Wybierz przynajmniej jeden sklep');
    if (!calories || Number(calories) < 500) return setError('Podaj prawidłową liczbę kalorii (min 500)');
    setError('');
    setLoading(true);
    try {
      const plan = await generatePlan(selected, Number(calories));
      onGenerate(plan);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={s.screen}>
        {error && <div style={s.error}>{error}</div>}

        <p style={s.label}>Twoje sklepy</p>
        {fetching ? (
          <div style={s.spinner}><Spinner /><span style={{ color: '#6b7280' }}>Ładowanie...</span></div>
        ) : (
          <div style={s.storeGrid}>
            {stores.map(store => (
              <button
                key={store.id}
                style={s.storeBtn(selected.includes(store.id))}
                onClick={() => toggle(store.id)}
              >
                {selected.includes(store.id) ? '✓ ' : ''}{store.name}
              </button>
            ))}
          </div>
        )}

        <div style={s.divider} />

        <label style={s.label}>Dzienne zapotrzebowanie kaloryczne</label>
        <input
          style={s.input}
          type="number"
          value={calories}
          onChange={e => setCalories(e.target.value)}
          min={500}
          max={5000}
          placeholder="np. 2000"
        />

        <button
          style={s.btn(loading || !selected.length)}
          onClick={handleGenerate}
          disabled={loading || !selected.length}
        >
          {loading ? '⏳ Generuję plan...' : '🥗 Wygeneruj plan dnia'}
        </button>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────
// Screen: Plan dnia
// ──────────────────────────────────────────────
function PlanScreen({ plan, onBack }) {
  return (
    <div style={s.screen}>
      <button style={s.backBtn} onClick={onBack}>← Wróć i zmień ustawienia</button>

      {plan.warning && <div style={s.warning}>⚠️ {plan.warning}</div>}

      <div style={s.summaryBox}>
        <div style={s.summaryTitle}>Łącznie dzisiaj</div>
        <div style={s.summaryKcal}>{plan.total_calories} <span style={{ fontSize: 18 }}>kcal</span></div>
        <div style={s.macros}>
          <div style={s.macro}>
            <div style={s.macroVal}>{plan.total_protein}g</div>
            <div style={s.macroLbl}>Białko</div>
          </div>
          <div style={s.macro}>
            <div style={s.macroVal}>{plan.total_carbs}g</div>
            <div style={s.macroLbl}>Węglowodany</div>
          </div>
          <div style={s.macro}>
            <div style={s.macroVal}>{plan.total_fat}g</div>
            <div style={s.macroLbl}>Tłuszcze</div>
          </div>
        </div>
      </div>

      <div style={s.sectionTitle}>Plan posiłków</div>
      {plan.meals.map((meal, i) => (
        <div key={i} style={s.mealCard}>
          <div style={s.mealHeader}>
            <div>
              <div style={s.mealType}>{meal.type_label}</div>
              <div style={s.mealName}>{meal.name}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={s.mealKcal}>{meal.total_calories}</div>
              <div style={s.mealKcalLbl}>kcal</div>
            </div>
          </div>
          <div style={s.ingredientList}>
            {meal.ingredients.map((ing, j) => (
              <div key={j} style={s.ingredient}>
                <span>{formatIngredient(ing)}</span>
                <span style={{ color: '#9ca3af' }}>{ing.calories} kcal</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Prosty spinner
function Spinner() {
  return (
    <div style={{
      width: 32, height: 32, border: '3px solid #e5e7eb',
      borderTop: '3px solid #16a34a', borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  );
}

// ──────────────────────────────────────────────
// Root App
// ──────────────────────────────────────────────
export default function App() {
  const [plan, setPlan] = useState(null);

  return (
    <div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: #16a34a !important; }
        button:active { opacity: 0.85; }
      `}</style>
      <div style={s.header}>
        <div style={s.logo}>🥦 NutriCart</div>
        <div style={s.subtitle}>Inteligentny planer posiłków</div>
      </div>
      {plan
        ? <PlanScreen plan={plan} onBack={() => setPlan(null)} />
        : <SettingsScreen onGenerate={setPlan} />
      }
    </div>
  );
}
