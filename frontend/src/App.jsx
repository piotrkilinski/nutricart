import { useState, useEffect } from 'react';
import { fetchStores, generatePlan } from './api';

// ── Style ─────────────────────────────────────────────────────────────────────
const s = {
  header: {
    background: 'linear-gradient(135deg, #16a34a, #15803d)',
    color: 'white', padding: '20px 16px 16px', textAlign: 'center',
  },
  logo: { fontSize: 28, fontWeight: 700, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, opacity: 0.85, marginTop: 2 },
  screen: { padding: 16 },
  label: { display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14, color: '#374151' },
  storeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 },
  storeBtn: (active) => ({
    padding: '12px 8px', borderRadius: 12,
    border: active ? '2px solid #16a34a' : '2px solid #e5e7eb',
    background: active ? '#f0fdf4' : 'white',
    color: active ? '#15803d' : '#374151',
    fontWeight: active ? 700 : 400,
    cursor: 'pointer', fontSize: 14, transition: 'all 0.15s',
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
    transition: 'all 0.15s', marginBottom: 10,
  }),
  error: {
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: 12, padding: 14, marginBottom: 16, color: '#dc2626', fontSize: 14,
  },
  summaryBox: {
    background: 'linear-gradient(135deg, #16a34a, #15803d)',
    borderRadius: 16, padding: 16, marginBottom: 20, color: 'white',
  },
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
    padding: '12px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
  },
  mealType: { fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5 },
  mealMode: { fontSize: 10, color: '#9ca3af', marginTop: 1 },
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
    fontWeight: 700, fontSize: 15, cursor: 'pointer', width: '100%', marginBottom: 12,
  },
  divider: { height: 1, background: '#f3f4f6', margin: '16px 0' },
  sectionTitle: { fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#1a1a1a' },

  // Mode selector
  modeCard: {
    border: '1px solid #e5e7eb', borderRadius: 14,
    marginBottom: 10, overflow: 'hidden',
  },
  modeCardHeader: {
    padding: '10px 14px', background: '#f9fafb',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  modeLabel: { fontWeight: 600, fontSize: 14, color: '#374151' },
  modeEmoji: { fontSize: 18, marginRight: 8 },
  modeToggle: {
    display: 'flex', gap: 4,
  },
  modeBtn: (active, color) => ({
    padding: '6px 12px', borderRadius: 8, border: 'none',
    background: active ? color : '#e5e7eb',
    color: active ? 'white' : '#6b7280',
    fontWeight: active ? 700 : 400,
    fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
  }),
};

const SLOTS = [
  { key: 'breakfast', label: 'Śniadanie', emoji: '🌅' },
  { key: 'lunch',     label: 'Obiad',     emoji: '☀️' },
  { key: 'dinner',    label: 'Kolacja',   emoji: '🌙' },
  { key: 'snack',     label: 'Przekąska', emoji: '🍎' },
];

const UNIT_LABELS = { g: 'g', ml: 'ml', piece: 'szt', tbsp: 'łyżka', tsp: 'łyżeczka', cup: 'szklanka' };

function formatIngredient(ing) {
  const unit = UNIT_LABELS[ing.unit] || ing.unit;
  return `${ing.quantity} ${unit} ${ing.product_name}`;
}

// ── Settings Screen ───────────────────────────────────────────────────────────

function SettingsScreen({ onGenerate }) {
  const [stores, setStores] = useState([]);
  const [selected, setSelected] = useState([]);
  const [calories, setCalories] = useState('2000');
  const [modes, setModes] = useState({
    breakfast: 'products', lunch: 'products', dinner: 'products', snack: 'products'
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStores()
      .then(d => { setStores(d); setFetching(false); })
      .catch(() => { setError('Błąd ładowania sklepów'); setFetching(false); });
  }, []);

  const toggleStore = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const setMode = (slot, mode) =>
    setModes(prev => ({ ...prev, [slot]: mode }));

  const handleGenerate = async () => {
    if (!selected.length) return setError('Wybierz przynajmniej jeden sklep');
    if (!calories || Number(calories) < 500) return setError('Podaj prawidłową liczbę kalorii (min 500)');
    setError('');
    setLoading(true);
    try {
      const plan = await generatePlan(selected, Number(calories), modes);
      onGenerate(plan);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.screen}>
      {error && <div style={s.error}>{error}</div>}

      <label style={s.label}>Twoje sklepy</label>
      {fetching ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Ładowanie...</div>
      ) : (
        <div style={s.storeGrid}>
          {stores.map(store => (
            <button key={store.id} style={s.storeBtn(selected.includes(store.id))}
              onClick={() => toggleStore(store.id)}>
              {selected.includes(store.id) ? '✓ ' : ''}{store.name}
            </button>
          ))}
        </div>
      )}

      <div style={s.divider} />

      <label style={s.label}>Dzienne zapotrzebowanie kaloryczne</label>
      <input style={s.input} type="number" value={calories}
        onChange={e => setCalories(e.target.value)} min={500} max={5000} />

      <div style={s.divider} />

      <label style={s.label}>Tryb dla każdego posiłku</label>
      <div style={{ marginBottom: 20 }}>
        {SLOTS.map(({ key, label, emoji }) => (
          <div key={key} style={s.modeCard}>
            <div style={s.modeCardHeader}>
              <div>
                <span style={s.modeEmoji}>{emoji}</span>
                <span style={s.modeLabel}>{label}</span>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, marginLeft: 26 }}>
                  {modes[key] === 'meal'
                    ? 'Przepis + ewentualne dopełnienie gotowym produktem'
                    : 'Gotowe produkty dobrane kaloryjnie'}
                </div>
              </div>
              <div style={s.modeToggle}>
                <button style={s.modeBtn(modes[key] === 'meal', '#16a34a')}
                  onClick={() => setMode(key, 'meal')}>
                  🍳 Przepis
                </button>
                <button style={s.modeBtn(modes[key] === 'products', '#2563eb')}
                  onClick={() => setMode(key, 'products')}>
                  🛒 Produkty
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button style={s.btn(loading || !selected.length)}
        onClick={handleGenerate} disabled={loading || !selected.length}>
        {loading ? '⏳ Generuję plan...' : '🥗 Wygeneruj plan dnia'}
      </button>
    </div>
  );
}

// ── Plan Screen ───────────────────────────────────────────────────────────────

// Pojedyncza karta posiłku z własnym stanem zwinięcia
function MealCard({ meal }) {
  const [open, setOpen] = useState(false);

  const modeLabel = meal.mode === 'products'
    ? (meal.source === 'snack_meal' ? '🍱 gotowy zestaw' : '🛒 gotowe produkty')
    : (meal.topping_added ? '🍳 przepis + dodatek' : '🍳 przepis');

  return (
    <div style={s.mealCard}>
      {/* Nagłówek — zawsze widoczny, klikalne */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          ...s.mealHeader,
          cursor: 'pointer',
          borderBottom: open ? '1px solid #e5e7eb' : 'none',
          userSelect: 'none',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.mealType}>{meal.type_label}</div>
          <div style={s.modeLabel}>{modeLabel}</div>
          <div style={{
            ...s.mealName,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {meal.name || 'Zestaw produktów'}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
          <div style={s.mealKcal}>{meal.total_calories}</div>
          <div style={s.mealKcalLbl}>kcal</div>
        </div>
        {/* Chevron */}
        <div style={{
          marginLeft: 10, color: '#9ca3af', fontSize: 20, flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          lineHeight: 1,
        }}>▾</div>
      </div>

      {/* Szczegóły — tylko gdy otwarte */}
      {open && (
        meal.error ? (
          <div style={{ padding: '12px 14px', color: '#dc2626', fontSize: 13 }}>
            ⚠ {meal.error}
          </div>
        ) : (
          <div style={s.ingredientList}>
            {(meal.ingredients || []).map((ing, j) => (
              <div key={j} style={s.ingredient}>
                <span>{formatIngredient(ing)}</span>
                <span style={{ color: '#9ca3af' }}>{ing.calories} kcal</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12, paddingTop: 8, fontSize: 12, color: '#9ca3af' }}>
              <span>B: {meal.total_protein}g</span>
              <span>W: {meal.total_carbs}g</span>
              <span>T: {meal.total_fat}g</span>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function PlanScreen({ plan, onBack }) {
  return (
    <div style={s.screen}>
      <button style={s.backBtn} onClick={onBack}>← Wróć i zmień ustawienia</button>

      <div style={s.summaryBox}>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>Łącznie dzisiaj</div>
        <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
          {plan.total_calories} <span style={{ fontSize: 18 }}>kcal</span>
          <span style={{ fontSize: 14, opacity: 0.7, marginLeft: 8 }}>
            (cel: {plan.target_calories})
          </span>
        </div>
        <div style={s.macros}>
          {[
            { v: plan.total_protein, l: 'Białko' },
            { v: plan.total_carbs,   l: 'Węglowodany' },
            { v: plan.total_fat,     l: 'Tłuszcze' },
          ].map(({ v, l }) => (
            <div key={l} style={s.macro}>
              <div style={s.macroVal}>{v}g</div>
              <div style={s.macroLbl}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={s.sectionTitle}>Plan posiłków</div>

      {plan.meals.map((meal, i) => (
        <MealCard key={i} meal={meal} />
      ))}
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [plan, setPlan] = useState(null);

  return (
    <div>
      <style>{`
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
