// public/assets/js/api.js

export async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include", // PHP sessions
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  // Read as text first (so we can show helpful debug if server returns HTML)
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (_) {
    data = null;
  }

  return { res, data, raw };
}

export function qs(id) {
  return document.getElementById(id);
}

export function setText(id, value) {
  const el = qs(id);
  if (el) el.textContent = value ?? "";
}