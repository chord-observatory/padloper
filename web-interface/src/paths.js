// Centralized base-path handling for API routes under a subpath
// Normalize env to ensure only "/padloper" is used by default, and guard
// against accidental "/" which would escape the subpath.
function normalizeBasePath(input) {
  let bp = input || "/padloper";
  if (bp === "/") bp = "/padloper"; // enforce subpath
  // trim trailing slash except for root
  if (bp.length > 1 && bp.endsWith('/')) bp = bp.slice(0, -1);
  return bp;
}

export const BASE_PATH = normalizeBasePath(process.env.REACT_APP_BASE_PATH);

// Prefix any path (e.g., "/api/endpoint") with BASE_PATH
export function withBase(path) {
  if (!path) return BASE_PATH;
  return `${BASE_PATH}${path.startsWith('/') ? path : '/' + path}`;
}

// Helper: ensure non-OK responses raise with useful text, then parse JSON
export async function requireOkJson(res) {
  if (!res.ok) {
    let text = '';
    try { text = await res.text(); } catch (e) {}
    const where = res.url || 'request';
    throw new Error(`${where} ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// The signed-in user, as established by the backend from the authenticating
// proxy (Authelia): `{login, logout_url}`, or `{}` if not signed in.
export async function getCurrentUser() {
  try {
    const res = await fetch(withBase('/api/whoami'));
    return res.ok ? await res.json() : {};
  } catch (err) {
    console.error('Failed to load the signed-in user:', err);
    return {};
  }
}

// End the padloper session, then sign out of the proxy too; otherwise the
// next request would sign straight back in.
export async function signOut() {
  let logoutUrl = '/authelia/logout';
  try {
    const res = await fetch(withBase('/api/logout'), { method: 'POST' });
    const data = await res.json();
    if (data && data.logout_url) logoutUrl = data.logout_url;
  } catch (err) {
    console.error('Error signing out:', err);
  }
  window.location.assign(logoutUrl);
}

// Parse a JSON response, turning HTTP errors and `{error: ...}` bodies (which a
// few older routes return with status 200) into a thrown Error whose message
// is fit to show to the user.
async function parseJsonOrThrow(res) {
  let data = null;
  try { data = await res.json(); } catch (_) { data = null; }
  if (!res.ok || (data && data.error)) {
    const msg = (data && data.error) ? String(data.error)
      : `${res.status} ${res.statusText || 'Request failed'}`;
    throw new Error(msg);
  }
  return data || {};
}

// GET a JSON API endpoint under the base path.
export async function getJson(path) {
  const res = await fetch(withBase(path));
  return parseJsonOrThrow(res);
}

// POST `fields` as form data to an API endpoint under the base path and
// return the parsed JSON body.
export async function postForm(path, fields) {
  const formData = new FormData();
  Object.entries(fields || {}).forEach(([key, value]) => formData.append(key, value));
  const res = await fetch(withBase(path), { method: 'POST', body: formData });
  return parseJsonOrThrow(res);
}
