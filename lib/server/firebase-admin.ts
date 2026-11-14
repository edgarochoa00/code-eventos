import "server-only";

import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function adminApp() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("Falta configurar Firebase en el servidor.");
  if (process.env.NEXT_PUBLIC_USE_EMULATORS === "true") {
    if (process.env.NODE_ENV === "production" || !projectId.startsWith("demo-")) {
      throw new Error("Los emuladores requieren un proyecto demo local.");
    }
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";
  }
  // App Hosting proporciona credenciales de servicio; no se incluyen claves en el cliente.
  return getApps().find((candidate) => candidate.name === "team-enrollment")
    ?? initializeApp({ projectId }, "team-enrollment");
}

export function adminServices() {
  const app = adminApp();
  return { auth: getAuth(app), db: getFirestore(app) };
}

export function adminStorageBucket(bucketName: string) {
  return getStorage(adminApp()).bucket(bucketName);
}
