const BASE = import.meta.env.VITE_API_URL || '/api';

export async function fetchStores() {
  const res = await fetch(`${BASE}/stores`);
  return res.json();
}

export async function generatePlan(store_ids, target_calories, modes = {}) {
  const res = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store_ids, target_calories, modes })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Błąd serwera');
  }
  return res.json();
}
