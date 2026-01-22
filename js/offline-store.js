// Offline storage using localStorage for demo mode.
import { createId } from "./app.js";

const STORAGE_KEY = "step3d:sessions";

const loadAll = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Offline store parse failed", error);
    return {};
  }
};

const saveAll = (payload) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent("step3d-store-update"));
};

const mergeDeep = (target, source) => {
  const output = { ...target };
  Object.entries(source).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = mergeDeep(target[key] || {}, value);
    } else {
      output[key] = value;
    }
  });
  return output;
};

export const createOfflineStore = () => ({
  mode: "offline",
  async createSession(session) {
    const sessions = loadAll();
    sessions[session.id] = session;
    saveAll(sessions);
    return session;
  },
  async getSession(sessionId) {
    const sessions = loadAll();
    return sessions[sessionId] || null;
  },
  async updateSession(sessionId, updater) {
    const sessions = loadAll();
    const current = sessions[sessionId];
    if (!current) return null;
    const next = typeof updater === "function" ? updater(current) : mergeDeep(current, updater);
    sessions[sessionId] = next;
    saveAll(sessions);
    return next;
  },
  async subscribe(sessionId, callback) {
    const handler = async () => {
      const session = await this.getSession(sessionId);
      callback(session);
    };
    window.addEventListener("storage", handler);
    window.addEventListener("step3d-store-update", handler);
    handler();
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("step3d-store-update", handler);
    };
  },
  createPlayer({ name = "", teamId, role }) {
    return {
      id: createId(8),
      name,
      teamId,
      role,
      joinedAt: Date.now(),
    };
  },
});
