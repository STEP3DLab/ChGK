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
  const values = new Uint32Array(length);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(values);
  } else {
    for (let i = 0; i < length; i += 1) {
      values[i] = Math.floor(Math.random() * chars.length);
    }
  }
  return Array.from(values, (value) => chars[value % chars.length]).join("");
};

export const getBaseUrl = () => {
  const { origin, pathname } = window.location;
  const trimmed = pathname.endsWith("/") ? pathname : pathname.replace(/\/[^/]*$/, "/");
  return `${origin}${trimmed}`;
};

export const copyToClipboard = async (text) => {
  if (!navigator.clipboard) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();
    try {
      const ok = document.execCommand("copy");
      textarea.remove();
      return ok;
    } catch (error) {
      console.warn("Clipboard fallback failed", error);
      textarea.remove();
      return false;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.warn("Clipboard copy failed", error);
    return false;
  }
};

export const saveLocal = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("Local storage write failed", error);
    return false;
  }
};

export const loadLocal = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
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
  if (toast._hideTimer) {
    clearTimeout(toast._hideTimer);
  }
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.setAttribute("aria-label", message);
  toast.classList.add("show");
  toast._hideTimer = setTimeout(() => {
    toast.classList.remove("show");
    toast._hideTimer = null;
  }, 2200);
};

export const normalizeSessionId = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);

export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
