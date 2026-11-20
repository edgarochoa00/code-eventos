import { deleteApp, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const [projectId, mode, ...extra] = process.argv.slice(2);
if (!projectId || !/^[a-z][a-z0-9-]+$/.test(projectId) || (mode && mode !== "--apply") || extra.length) {
  throw new Error("Uso: node scripts/remove-legacy-results.mjs <proyecto-firebase> [--apply]");
}

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
if (Boolean(emulator) !== projectId.startsWith("demo-")) {
  throw new Error("Usa un proyecto demo con el emulador y un ID real solamente con credenciales de ese proyecto.");
}

const apply = mode === "--apply";
const app = initializeApp({ projectId });
const db = getFirestore(app);
async function clearCopies(query, field) {
  let count = 0;
  let batch = db.batch();
  let pending = 0;
  for await (const snapshot of query.select(field).stream()) {
    if (snapshot.get(field) == null) continue;
    count++;
    if (!apply) continue;
    batch.update(snapshot.ref, { [field]: FieldValue.delete() }, { lastUpdateTime: snapshot.updateTime });
    pending++;
    if (pending === 200) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending) await batch.commit();
  return count;
}

try {
  const clearedEvents = await clearCopies(db.collection("events"), "results");
  const clearedProjects = await clearCopies(db.collectionGroup("projects"), "feedback");
  console.log({ projectId, mode: apply ? "aplicado" : "simulación", eventos: clearedEvents, proyectos: clearedProjects });
} finally {
  await deleteApp(app);
}
