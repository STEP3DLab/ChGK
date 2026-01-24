// Shared utilities and bootstrapping logic.
export const STORAGE_KEYS = {
  lastSession: "step3d:lastSession",
  user: "step3d:user",
  host: "step3d:host",
};

export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

export const onReady = (cb) => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cb, { once: true });
  } else {
    cb();
  }
};

export const createId = (length = 6) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

export const getBaseUrl = () => {
  const { origin, pathname } = window.location;
  const trimmed = pathname.endsWith("/") ? pathname : pathname.replace(/\/[^/]*$/, "/");
  return `${origin}${trimmed}`;
};

export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.warn("Clipboard copy failed", error);
    return false;
  }
};

export const saveLocal = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const loadLocal = (key, fallback = null) => {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Local storage parse failed", error);
    return fallback;
  }
};

export const setStoredUser = (payload) => saveLocal(STORAGE_KEYS.user, payload);
export const getStoredUser = () => loadLocal(STORAGE_KEYS.user, null);
export const setStoredHost = (payload) => saveLocal(STORAGE_KEYS.host, payload);
export const getStoredHost = () => loadLocal(STORAGE_KEYS.host, null);

export const formatTime = (seconds) => {
  const clamped = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(clamped / 60);
  const rest = clamped % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
};

export const setBadge = (text) => {
  const badge = qs("[data-status-badge]");
  if (!badge) return;
  const dot = badge.querySelector(".status-dot");
  if (dot) {
    badge.textContent = "";
    badge.append(dot);
    const label = document.createElement("span");
    label.textContent = text;
    badge.append(label);
    return;
  }
  badge.textContent = text;
};

export const showToast = (message, tone = "info") => {
  const toast = qs("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
};
