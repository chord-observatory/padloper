// Centralized base-path handling for API and OAuth routes under a subpath
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

// Prefix any path (e.g., "/api/endpoint" or "/oauth/getUserData") with BASE_PATH
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

export function authHeaders() {
  const token = (typeof localStorage !== 'undefined') ? localStorage.getItem('accessToken') : null;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}
