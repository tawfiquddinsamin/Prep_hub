import { API } from "./config";
const TOKEN = "prephub_token";
const NAME = "prephub_name";

export const getToken = () => localStorage.getItem(TOKEN);
export const getName = () => localStorage.getItem(NAME) || "";
export function setSession(token, name) {
  localStorage.setItem(TOKEN, token);
  localStorage.setItem(NAME, name || "");
}
export function logout() {
  localStorage.removeItem(TOKEN);
  localStorage.removeItem(NAME);
}

export async function api(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {          // token missing or expired
    logout();
    window.location.reload();
    throw new Error("Please log in again");
  }
  if (!res.ok) {
    let msg = "Request failed";
    try { msg = (await res.json()).detail || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}