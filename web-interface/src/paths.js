// Centralized base-path handling for API and OAuth routes under a subpath
// Defaults to "/padloper" for predictable subpath behavior
export const BASE_PATH = process.env.REACT_APP_BASE_PATH || "/padloper";

// Prefix any path (e.g., "/api/endpoint" or "/oauth/getUserData") with BASE_PATH
export function withBase(path) {
  if (!path) return BASE_PATH;
  return `${BASE_PATH}${path.startsWith('/') ? path : '/' + path}`;
}

export function authHeaders() {
  const token = (typeof localStorage !== 'undefined') ? localStorage.getItem('accessToken') : null;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

