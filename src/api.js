const BASE = import.meta?.env?.VITE_API_URL ?? "http://localhost:3001";
const KEY   = "gut_token";

function getToken() { return localStorage.getItem(KEY); }

function decodeSession() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp * 1000 < Date.now()) { localStorage.removeItem(KEY); return null; }
    return { user: { id: payload.id, email: payload.email } };
  } catch { return null; }
}

async function call(method, path, body) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return res.ok ? { data: json } : { error: json };
}

// ── Auth ───────────────────────────────────────────────────────────────────
export const auth = {
  getSession() {
    return { data: { session: decodeSession() } };
  },

  async signIn(email, password) {
    const { data, error } = await call("POST", "/auth/login", { email, password });
    if (error) return { error };
    localStorage.setItem(KEY, data.token);
    return { data: { session: { user: data.user } } };
  },

  async register(email, password) {
    const { data, error } = await call("POST", "/auth/register", { email, password });
    if (error) return { error };
    localStorage.setItem(KEY, data.token);
    return { data: { session: { user: data.user } } };
  },

  async signOut() {
    localStorage.removeItem(KEY);
  },

  forgotPassword: (email) => call("POST", "/auth/forgot-password", { email }),
  resetPassword:  (token, password) => call("POST", "/auth/reset-password", { token, password }),
};

// ── Problems ───────────────────────────────────────────────────────────────
export const problems = {
  list:       ()         => call("GET",    "/problems"),
  create:     (body)     => call("POST",   "/problems", body),
  update:     (id, body) => call("PATCH",  `/problems/${id}`, body),
  remove:     (id)       => call("DELETE", `/problems/${id}`),
  replaceAll: (items)    => call("POST",   "/problems/replace", items),
};
