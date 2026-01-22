import { firebaseEnabled } from "./firebase-config.js";
import { createFirebaseStore } from "./firebase-store.js";
import { createOfflineStore } from "./offline-store.js";

let storeInstance = null;

export const getStore = () => {
  if (storeInstance) return storeInstance;
  storeInstance = firebaseEnabled ? createFirebaseStore() : createOfflineStore();
  return storeInstance;
};
