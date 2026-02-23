import { useState, useEffect } from 'react';
import { fetchStores, generatePlan } from './api';

const BASE = import.meta.env.VITE_API_URL || '/api';

// ── Style ─────────────────────────────────────────────────────────────────────
const s = {
  header: {
    background: 'linear-gradient(135deg, #16a34a, #15803d)',
    color: 'white', padding: '20px 16px 16px', textAlign: 'center',
    position: 'relative',
  },
  logo: { fontSize: 28, fontWeight: 700, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, opacity: 0.85, marginTop: 2 },
  helpBtn: {
    position: 'absolute', top: 18, right: 16,
    width: 32, height: 32, borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.6)',
    background: 'rgba(255,255,255,0.15)',
    color: 'white', fontWeight: 700, fontSize: 15,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
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
    boxSizing: 'border-box',
  },
  btn: (disabled) => ({
    width: '100%', padding: '14px', borderRadius: 14,
    background: disabled ? '#d1d5db' : 'linear-gradient(135deg, #16a34a, #15803d)',
    color: 'white', fontWeight: 700, fontSize: 16,
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s', marginBottom: 10,
  }),
  btnOutline: {
    width: '100%', padding: '13px', borderRadius: 14,
    background: 'white', border: '2px solid #16a34a',
    color: '#16a34a', fontWeight: 700, fontSize: 15,
    cursor: 'pointer', transition: 'all 0.15s', marginBottom: 10,
  },
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
  modeCard: { border: '1px solid #e5e7eb', borderRadius: 14, marginBottom: 10, overflow: 'hidden' },
  modeCardHeader: { padding: '10px 14px', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  modeLabel: { fontWeight: 600, fontSize: 14, color: '#374151' },
  modeEmoji: { fontSize: 18, marginRight: 8 },
  modeToggle: { display: 'flex', gap: 4 },
  modeBtn: (active, color) => ({
    padding: '6px 12px', borderRadius: 8, border: 'none',
    background: active ? color : '#e5e7eb',
    color: active ? 'white' : '#6b7280',
    fontWeight: active ? 700 : 400,
    fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
  }),
  // Modal
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },
  modal: {
    background: 'white', borderRadius: 20, padding: 24,
    maxWidth: 400, width: '100%', maxHeight: '85vh', overflowY: 'auto',
  },
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

// ── Modal Pomocy ──────────────────────────────────────────────────────────────
function HelpModal({ onClose }) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a' }}>🥦 Jak działa NutriCart?</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>

        <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.6, marginBottom: 16 }}>
          NutriCart to planer posiłków, który dobiera propozycje <strong>na podstawie produktów dostępnych w Twoich sklepach</strong>. Wpisujesz dzienne zapotrzebowanie kaloryczne, wybierasz sklepy i dostajesz gotowy plan na cały dzień.
        </p>

        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 6, fontSize: 14 }}>🛒 Gotowe produkty</div>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>
            Produkty prosto z półki sklepowej — bez gotowania, bez sprzętu. Możesz je zjeść od razu lub łatwo połączyć, np. <em>jogurt + płatki owsiane</em>, <em>chleb + wędlina</em>. Idealne na szybkie śniadanie lub przekąskę.
          </p>
        </div>

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: 6, fontSize: 14 }}>🍳 Przepisy</div>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>
            Gotowane dania z listy składników. Wymagają czasu i podstawowego sprzętu kuchennego (kuchenka, garnek, patelnia). Składniki przepisu są dobierane z produktów dostępnych w wybranych przez Ciebie sklepach.
          </p>
        </div>

        <div style={{ background: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: '#374151', marginBottom: 8, fontSize: 13 }}>Jak zacząć:</div>
          {[
            '1. Wybierz sklepy, w których robisz zakupy',
            '2. Podaj swoje dzienne zapotrzebowanie kaloryczne',
            '3. Dla każdego posiłku wybierz tryb: przepis lub gotowe produkty',
            '4. Kliknij „Wygeneruj plan dnia"',
            '5. Zapisz plan i zabierz listę zakupów do sklepu',
          ].map((step, i) => (
            <div key={i} style={{ fontSize: 13, color: '#4b5563', paddingBottom: 6, lineHeight: 1.5 }}>{step}</div>
          ))}
        </div>

        <button style={s.btn(false)} onClick={onClose}>Rozumiem, zaczynamy! 🚀</button>
      </div>
    </div>
  );
}

// ── Settings Screen ───────────────────────────────────────────────────────────
function SettingsScreen({ onGenerate, onShowHelp }) {
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

  // Sprawdź czy jest zapisany plan
  const hasSaved = !!localStorage.getItem('nutricart_plan');

  return (
    <div style={s.screen}>
      {error && <div style={s.error}>{error}</div>}

      {hasSaved && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
          padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>📋 Masz zapisany plan</span>
          <button onClick={() => onGenerate(JSON.parse(localStorage.getItem('nutricart_plan')))} style={{
            background: '#f59e0b', color: 'white', border: 'none',
            borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
          }}>Zobacz</button>
        </div>
      )}

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

// ── MealCard ──────────────────────────────────────────────────────────────────
function MealCard({ meal, onRegenerate, regenerating }) {
  const [open, setOpen] = useState(false);

  const modeLabel = meal.mode === 'products'
    ? (meal.source === 'snack_meal' ? '🍱 gotowy zestaw' : '🛒 gotowe produkty')
    : (meal.topping_added ? '🍳 przepis + dodatek' : '🍳 przepis');

  return (
    <div style={s.mealCard}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={s.mealType}>{meal.type_label}</div>
            {/* Przycisk przegeneruj — przy nazwie pory dnia */}
            <button
              onClick={e => { e.stopPropagation(); onRegenerate(meal.slot); }}
              disabled={regenerating === meal.slot}
              title="Wygeneruj inny posiłek"
              style={{
                width: 28, height: 28, borderRadius: 8,
                border: '1.5px solid #16a34a',
                background: regenerating === meal.slot ? '#f0fdf4' : 'white',
                color: regenerating === meal.slot ? '#d1d5db' : '#16a34a',
                fontSize: 14, fontWeight: 700,
                cursor: regenerating === meal.slot ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, padding: 0,
                boxShadow: '0 1px 3px rgba(22,163,74,0.15)',
                animation: regenerating === meal.slot ? 'spin 0.8s linear infinite' : 'none',
              }}
            >{regenerating === meal.slot ? '⏳' : '↺'}</button>
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{modeLabel}</div>
          <div style={{
            ...s.mealName,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {meal.name || 'Zestaw produktów'}
          </div>
          {!open && !meal.error && (
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
              B: {meal.total_protein}g · W: {meal.total_carbs}g · T: {meal.total_fat}g
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
          <div style={s.mealKcal}>{meal.total_calories}</div>
          <div style={s.mealKcalLbl}>kcal</div>
        </div>
        <div style={{
          marginLeft: 10, color: '#9ca3af', fontSize: 20, flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s', lineHeight: 1,
        }}>▾</div>
      </div>

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
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>{ing.calories} kcal</span>
                  {ing.stores?.length > 0 && (
                    <div style={{ fontSize: 10, color: '#d1d5db', marginTop: 1 }}>
                      {ing.stores.join(', ')}
                    </div>
                  )}
                </div>
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

// ── Raport zakupów ────────────────────────────────────────────────────────────
const SLOT_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
const SLOT_ICONS = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };

function ShoppingReport({ plan, onBack, onClear }) {
  // Stan checkboxów — ładowany z localStorage
  const STORAGE_KEY = 'nutricart_checked';
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  });

  function toggleCheck(key) {
    setChecked(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  // Zbierz wszystkie składniki ze wszystkich posiłków (deduplikowane po nazwie)
  const allItems = [];
  const seen = new Set();
  for (const meal of (plan.meals || [])) {
    for (const ing of (meal.ingredients || [])) {
      const key = ing.product_name + '|' + ing.quantity + '|' + ing.unit;
      if (seen.has(key)) continue;
      seen.add(key);
      allItems.push({ ing, meal });
    }
  }

  const date = plan.savedAt
    ? new Date(plan.savedAt).toLocaleDateString('pl-PL',
        { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  const modeLabel = (meal) => meal.mode === 'products'
    ? (meal.source === 'snack_meal' ? '🍱 gotowy zestaw' : '🛒 gotowe produkty')
    : (meal.topping_added ? '🍳 przepis + dodatek' : '🍳 przepis');

  return (
    <div style={s.screen}>
      <button style={s.backBtn} onClick={onBack}>← Wróć do planu</button>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>
          📋 Raport planu
        </div>
        {date && <div style={{ fontSize: 12, color: '#9ca3af' }}>Zapisano: {date}</div>}
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
          {plan.total_calories} kcal · cel: {plan.target_calories} kcal
        </div>
      </div>

      {/* ── CZĘŚĆ 1: Posiłki rozwinięte ── */}
      <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a', marginBottom: 12 }}>
        🍽 Plan posiłków
      </div>

      {SLOT_ORDER.map(slot => {
        const meal = (plan.meals || []).find(m => m.slot === slot);
        if (!meal) return null;
        return (
          <div key={slot} style={{
            background: 'white', borderRadius: 14, border: '1px solid #e5e7eb',
            marginBottom: 12, overflow: 'hidden',
          }}>
            {/* Nagłówek posiłku */}
            <div style={{
              background: '#f9fafb', padding: '10px 14px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>{SLOT_ICONS[slot]}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>{meal.type_label}</span>
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{modeLabel(meal)}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 2 }}>
                  {meal.name || 'Zestaw produktów'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>{meal.total_calories}</div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>kcal</div>
              </div>
            </div>
            {/* Składniki posiłku */}
            <div style={{ padding: '8px 14px 10px' }}>
              {(meal.ingredients || []).map((ing, j) => (
                <div key={j} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '4px 0', borderBottom: j < meal.ingredients.length - 1 ? '1px solid #f3f4f6' : 'none',
                  fontSize: 13, color: '#4b5563',
                }}>
                  <span>{formatIngredient(ing)}</span>
                  <span style={{ color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>{ing.calories} kcal</span>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, paddingTop: 8, fontSize: 11, color: '#9ca3af' }}>
                <span>B: {meal.total_protein}g</span>
                <span>W: {meal.total_carbs}g</span>
                <span>T: {meal.total_fat}g</span>
              </div>
            </div>
          </div>
        );
      })}

      <div style={s.divider} />

      {/* ── CZĘŚĆ 2: Lista zakupów z checkboxami ── */}
      <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>
        🛍 Lista zakupów
      </div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>
        Dotknij pozycji aby zaznaczyć jako kupione — stan jest zapamiętany
      </div>

      {allItems.map(({ ing, meal }, idx) => {
        const key = ing.product_name + '|' + ing.quantity + '|' + ing.unit;
        const done = !!checked[key];
        const stores = ing.stores || [];
        return (
          <div
            key={idx}
            onClick={() => toggleCheck(key)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 12px', borderRadius: 12,
              border: `1px solid ${done ? '#bbf7d0' : '#e5e7eb'}`,
              background: done ? '#f0fdf4' : 'white',
              marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s',
              userSelect: 'none',
            }}
          >
            {/* Checkbox */}
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
              border: `2px solid ${done ? '#16a34a' : '#d1d5db'}`,
              background: done ? '#16a34a' : 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: 'white', fontWeight: 700,
              transition: 'all 0.15s',
            }}>
              {done ? '✓' : ''}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 13, color: done ? '#6b7280' : '#1a1a1a',
                fontWeight: 500,
                textDecoration: done ? 'line-through' : 'none',
              }}>
                {ing.product_name}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                {ing.quantity} {UNIT_LABELS[ing.unit] || ing.unit} · {ing.calories} kcal
                {stores.length > 0 && (
                  <span style={{
                    marginLeft: 6, background: '#dcfce7', color: '#15803d',
                    borderRadius: 4, padding: '1px 5px', fontSize: 10,
                  }}>
                    {stores.join(', ')}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#d1d5db', marginTop: 1 }}>
                {meal.type_label}{meal.name ? ` · ${meal.name}` : ''}
              </div>
            </div>
          </div>
        );
      })}

      <div style={s.divider} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => {
          setChecked({});
          localStorage.removeItem(STORAGE_KEY);
        }} style={{
          flex: 1, padding: '11px', borderRadius: 12,
          border: '1px solid #e5e7eb', background: '#f9fafb',
          color: '#6b7280', fontSize: 13, cursor: 'pointer', fontWeight: 600,
        }}>
          ☐ Odznacz wszystko
        </button>
        <button onClick={onClear} style={{
          flex: 1, padding: '11px', borderRadius: 12,
          border: '1px solid #fecaca', background: '#fef2f2',
          color: '#dc2626', fontSize: 13, cursor: 'pointer', fontWeight: 600,
        }}>
          🗑 Usuń plan
        </button>
      </div>
    </div>
  );
}

// ── Plan Screen ───────────────────────────────────────────────────────────────
function PlanScreen({ plan, setPlan, onBack }) {
  const [regenerating, setRegenerating] = useState(null);
  const [saved, setSaved] = useState(!!localStorage.getItem('nutricart_plan'));
  const [showReport, setShowReport] = useState(false);

  // Przelicz sumy po zmianie planu
  const totals = {
    calories: plan.meals.reduce((s, m) => s + (m.total_calories || 0), 0),
    protein:  Math.round(plan.meals.reduce((s, m) => s + (m.total_protein || 0), 0) * 10) / 10,
    carbs:    Math.round(plan.meals.reduce((s, m) => s + (m.total_carbs || 0), 0) * 10) / 10,
    fat:      Math.round(plan.meals.reduce((s, m) => s + (m.total_fat || 0), 0) * 10) / 10,
  };

  async function handleRegenerate(slot) {
    setRegenerating(slot);
    try {
      const otherCal = plan.meals
        .filter(m => m.slot !== slot)
        .reduce((s, m) => s + (m.total_calories || 0), 0);
      // Ile kalorii ma dostać ten slot: cel minus pozostałe
      const slotTarget = Math.max(100, plan.target_calories - otherCal);

      const meal = plan.meals.find(m => m.slot === slot);
      const slotMode = meal?.mode || 'products';

      // Proporcje wg slotu — odwróć formułę żeby API wyliczyło właściwy target
      const slotRatio = { breakfast: 0.25, lunch: 0.35, dinner: 0.30, snack: 0.10 };
      const ratio = slotRatio[slot] || 0.25;
      // target_calories dla całego dnia tak żeby slot dostał slotTarget
      const syntheticTotal = Math.round(slotTarget / ratio);

      const res = await fetch(`${BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_ids: plan.store_ids,
          target_calories: syntheticTotal,
          modes: { breakfast: slotMode, lunch: slotMode, dinner: slotMode, snack: slotMode },
        })
      });
      const newPlan = await res.json();
      const newMeal = newPlan.meals?.find(m => m.slot === slot);
      if (newMeal) {
        const updatedMeals = plan.meals.map(m => m.slot === slot ? newMeal : m);
        setPlan(prev => {
          const updated = { ...prev, meals: updatedMeals };
          // Jeśli plan był zapisany — zaktualizuj też zapis w localStorage
          if (localStorage.getItem('nutricart_plan')) {
            const existing = JSON.parse(localStorage.getItem('nutricart_plan'));
            localStorage.setItem('nutricart_plan', JSON.stringify({
              ...existing,
              meals: updatedMeals,
              total_calories: updatedMeals.reduce((s, m) => s + (m.total_calories || 0), 0),
            }));
          }
          return updated;
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRegenerating(null);
    }
  }

  function handleSave() {
    const toSave = { ...plan, savedAt: Date.now(), total_calories: totals.calories };
    localStorage.setItem('nutricart_plan', JSON.stringify(toSave));
    setSaved(true);
  }

  function handleClear() {
    localStorage.removeItem('nutricart_plan');
    setSaved(false);
    setShowReport(false);
  }

  if (showReport) {
    const savedPlan = JSON.parse(localStorage.getItem('nutricart_plan') || '{}');
    return <ShoppingReport plan={savedPlan} onBack={() => setShowReport(false)} onClear={handleClear} />;
  }

  return (
    <div style={s.screen}>
      <button style={s.backBtn} onClick={onBack}>← Wróć i zmień ustawienia</button>

      <div style={s.summaryBox}>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>Łącznie dzisiaj</div>
        <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
          {totals.calories} <span style={{ fontSize: 18 }}>kcal</span>
          <span style={{ fontSize: 14, opacity: 0.7, marginLeft: 8 }}>
            (cel: {plan.target_calories})
          </span>
        </div>
        <div style={s.macros}>
          {[
            { v: totals.protein, l: 'Białko' },
            { v: totals.carbs,   l: 'Węglowodany' },
            { v: totals.fat,     l: 'Tłuszcze' },
          ].map(({ v, l }) => (
            <div key={l} style={s.macro}>
              <div style={s.macroVal}>{v}g</div>
              <div style={s.macroLbl}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Przyciski zapisu */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={handleSave} style={{
          flex: 1, padding: '11px', borderRadius: 12,
          background: saved ? '#f0fdf4' : 'linear-gradient(135deg, #16a34a, #15803d)',
          color: saved ? '#15803d' : 'white',
          border: saved ? '2px solid #16a34a' : 'none',
          fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          {saved ? '✓ Zapisano' : '💾 Zapisz plan'}
        </button>
        {saved && (
          <button onClick={() => setShowReport(true)} style={{
            flex: 1, padding: '11px', borderRadius: 12,
            background: '#fffbeb', border: '2px solid #f59e0b',
            color: '#92400e', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            🛍 Lista zakupów
          </button>
        )}
      </div>

      <div style={s.sectionTitle}>Plan posiłków</div>

      {plan.meals.map((meal, i) => (
        <MealCard
          key={`${meal.slot}-${i}`}
          meal={meal}
          onRegenerate={handleRegenerate}
          regenerating={regenerating}
        />
      ))}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [plan, setPlan] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div>
      <style>{`
        input:focus { border-color: #16a34a !important; }
        button:active { opacity: 0.85; }
        * { box-sizing: border-box; }
      `}</style>
      <div style={s.header}>
        <div style={s.logo}>🥦 NutriCart</div>
        <div style={s.subtitle}>Inteligentny planer posiłków</div>
        <button style={s.helpBtn} onClick={() => setShowHelp(true)}>?</button>
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {plan
        ? <PlanScreen plan={plan} setPlan={setPlan} onBack={() => setPlan(null)} />
        : <SettingsScreen onGenerate={setPlan} onShowHelp={() => setShowHelp(true)} />
      }
    </div>
  );
}
