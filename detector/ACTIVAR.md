# Activar el detector de originalidad

Guía para un agente o desarrollador. Haz **todos** los pasos en orden, en una rama nueva, y no despliegues hasta que el paso 6 pase completo. Si un paso falla, detente y avisa al usuario. No improvises.

Tiempo estimado: 20–30 minutos.

## 0. Antes de empezar (obligatorio)

1. Confirma con el usuario las decisiones de `detector/lib/policy.ts` y ajusta los valores:
   - `allowContinuation`: ¿un equipo puede continuar su propio proyecto anterior?
   - `confirmation`: `"organizador+admin"` (recomendado) u `"organizador"`.
   - `teamCanRespond`: ¿el equipo puede responder antes de la decisión?
   - `outcomes`: consecuencias que aplica la escuela.
2. Si eligen `confirmation: "organizador"`, haz también el paso 2b.
3. Verifica que todo pase **antes** de tocar la app:
   ```bash
   npm run detector:test        # compila, 12 pruebas de lógica y 29 de reglas
   ```

## 1. Rama y archivos

```bash
git switch -c activar-detector
git mv detector/lib lib/detector
git mv detector/components components/detector
git mv detector/tests/logic.test.ts tests/detector.logic.test.ts
git mv detector/tests/detector.rules.test.mjs tests/detector.rules.test.mjs
git mv detector/tests/e2e tests/detector-e2e
git mv detector/scripts/backfill.ts scripts/detector-backfill.ts
```

## 2. Cambios a archivos existentes

```bash
git apply --check detector/patches/*.patch && git apply detector/patches/*.patch
```

- `01-datos-y-formulario.patch`:
  - `lib/types.ts`: `declaration` y `originalityStatus` en `ProjectDoc`.
  - `lib/data.ts`: `writeAnchor` reemplaza a `writeFingerprint`, y `updateProjectInfo`/`saveSubmission` reciben `user`.
  - `components/project-form.tsx`: declaración de originalidad.
- `02-vistas.patch`:
  - `organizer-view.tsx`: pestaña «Originalidad» con casos, tarjeta del resumen, etiqueta de caso en «Proyectos», sello al cerrar etapas o publicar, y se quita la tarjeta vieja de visibilidad.
  - `project-view.tsx`: pestaña de casos y versiones para organizadores, aviso al equipo y marca para jueces.
- `03-reglas-y-pruebas.patch`:
  - `firestore.rules`: anclas, casos, historial, índice, pares de palabras, `createdAt` con hora del servidor, el equipo no toca `originalityStatus` y se cierran las huellas viejas.
  - `tests/firestore.rules.test.mjs`: adaptado a esas reglas.

**Si `git apply --check` falla** (porque esos archivos cambiaron después de crear los parches), aplica a mano lo que describe cada parche, usando los bloques `+`/`-` del archivo `.patch` como guía. Para `firestore.rules`, `detector/rules/firestore.rules` es la versión completa esperada. Compárala con `diff` y conserva cualquier regla nueva del archivo actual.

### 2b. Solo si el organizador confirma sin admin

En `firestore.rules` (ya parchado), dentro de `match /cases/{cid}`:

```
function canConfirm() {
  return request.resource.data.decision.by == request.auth.uid
    && request.resource.data.decision.at == request.time;
}
```

y agrega esta línea dentro de `validTransition`:

```
|| (from in [por_revisar, esperando_equipo, en_revision] && to == confirmado && canConfirm())
```

En `tests/detector.rules.test.mjs` cambia a `assertSucceeds` las dos verificaciones que esperan que quien propone no pueda confirmar. Haz lo mismo en «el organizador propone y no puede confirmar solo» y en «quien propone no puede confirmar aunque sea admin».

## 3. Configuración

```bash
# El detector ya no se excluye de la compilación
node -e 'const f="tsconfig.json";const fs=require("fs");fs.writeFileSync(f,fs.readFileSync(f,"utf8").replace(`"exclude": ["node_modules", "detector"]`,`"exclude": ["node_modules"]`))'

npm pkg delete scripts.detector:test
npm pkg set 'scripts.test:rules=npx -y firebase-tools@15 emulators:exec --project demo-code --only firestore "node --test --test-concurrency=1 tests/firestore.rules.test.mjs tests/detector.rules.test.mjs"'
npm pkg set 'scripts.test:detector=npx -y tsx@4.23.15 --test tests/detector.logic.test.ts'
npm pkg set 'scripts.detector:backfill=npx -y tsx@4.23.15 scripts/detector-backfill.ts'
```

En `tests/detector.rules.test.mjs` no hay nada que cambiar: lee `firestore.rules` por defecto.

## 4. Limpieza de la carpeta

```bash
mkdir -p docs
git mv detector/README.md docs/detector.md
git rm -r -q detector/patches detector/rules detector/ACTIVAR.md detector/tsconfig.json
rm -rf detector    # debe quedar vacía; si queda algo, revisa antes de borrar
```

Actualiza `AGENTS.md`: cambia la sección «Detector de originalidad (en desarrollo, NO activo)» por «Detector de originalidad: activo, documentación en docs/detector.md». En `README.md`, reemplaza la sección «Originalidad» por un resumen de `docs/detector.md`.

## 5. Compilar y probar

```bash
npm run build                # debe compilar sin errores
npx tsc --noEmit && npx eslint .
npm run test:detector        # 12 pruebas
npm run test:rules           # 22 + 29 pruebas
```

## 6. Prueba de punta a punta (emulador, nunca producción)

```bash
# Terminal 1
npm run emulators
# Terminal 2: app contra el emulador (proyecto demo-code)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-code NEXT_PUBLIC_USE_EMULATORS=true npx next build
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-code NEXT_PUBLIC_USE_EMULATORS=true npx next start -p 3100
# Terminal 3
npx -y tsx@4.23.15 tests/detector-e2e/seed.ts
mkdir -p /tmp/pw && cp tests/detector-e2e/flow.mjs /tmp/pw/ && (cd /tmp/pw && npm init -y >/dev/null && npm i playwright-core@1)
node /tmp/pw/flow.mjs          # usa Chrome instalado (CHROME=ruta si es otro)
```

Debe terminar con `29 correctas, 0 con problema`. Para repetirla, vacía el emulador:

```bash
curl -X DELETE "http://127.0.0.1:8085/emulator/v1/projects/demo-code/databases/(default)/documents"
curl -X DELETE "http://127.0.0.1:9099/emulator/v1/projects/demo-code/accounts"
```

Vuelve a construir sin las variables del emulador antes de desplegar (`npm run build`).

## 7. Desplegar (pide confirmación al usuario antes de este paso)

En este orden:

```bash
npm run deploy:rules                      # reglas nuevas en code-94fbe
npm run detector:backfill -- --dry        # cuántos proyectos sellará
npm run detector:backfill                 # sella los eventos existentes
git add -A && git commit -m "Activar detector de originalidad"
git push -u origin activar-detector       # y abrir PR; al fusionar a main, Vercel despliega
```

Las reglas van primero porque la app nueva escribe en colecciones que las reglas anteriores rechazan, y el backfill necesita que existan los índices. Si la app sale antes que las reglas, guardar un proyecto sigue funcionando (el ancla falla sin bloquear al equipo), pero el detector no tendrá datos.

## Revertir

1. `git revert` del commit de activación y desplegar.
2. Restaurar las reglas anteriores: `git show <commit-anterior>:firestore.rules > firestore.rules && npm run deploy:rules`.
3. Los datos que creó el detector (`anchors`, `cases`, `originalityIndex`, `originalityShingles`) no afectan a la app anterior y pueden quedarse. Si se quieren borrar, hazlo desde la consola de Firebase.
