// Firebase realtime implementation (optional).
import { firebaseConfig } from "./firebase-config.js";

const loadFirebase = async () => {
  const appModule = await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js");
  const dbModule = await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js");
  return { appModule, dbModule };
};

export const createFirebaseStore = () => {
  let app = null;
  let database = null;
  let dbApi = null;
  const ensure = async () => {
    if (database) return { database, dbApi };
    const { appModule, dbModule } = await loadFirebase();
    app = appModule.initializeApp(firebaseConfig);
    database = dbModule.getDatabase(app);
    dbApi = dbModule;
    return { database, dbApi };
  };

  const sessionRef = async (sessionId) => {
    const { database, dbApi } = await ensure();
    return dbApi.ref(database, `sessions/${sessionId}`);
  };

  return {
    mode: "firebase",
    async createSession(session) {
      const ref = await sessionRef(session.id);
      const { dbApi } = await ensure();
      await dbApi.set(ref, session);
      return session;
    },
    async getSession(sessionId) {
      const ref = await sessionRef(sessionId);
      const { dbApi } = await ensure();
      const snapshot = await dbApi.get(ref);
      return snapshot.exists() ? snapshot.val() : null;
    },
    async updateSession(sessionId, updater) {
      const existing = await this.getSession(sessionId);
      if (!existing) return null;
      const next = typeof updater === "function" ? updater(existing) : { ...existing, ...updater };
      const ref = await sessionRef(sessionId);
      const { dbApi } = await ensure();
      await dbApi.set(ref, next);
      return next;
    },
    async subscribe(sessionId, callback) {
      const ref = await sessionRef(sessionId);
      const { dbApi } = await ensure();
      const handler = (snapshot) => callback(snapshot.val());
      dbApi.onValue(ref, handler);
      return () => dbApi.off(ref, "value", handler);
    },
  };
};
