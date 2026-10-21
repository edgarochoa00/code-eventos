<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Detector de originalidad (en desarrollo, NO activo)

El detector nuevo (anclas con fecha, casos con revisión humana y confirmación de dos personas) vive completo en `detector/`. **No está conectado a la app**: `tsconfig.json` lo excluye y nada lo importa. La app sigue usando el detector anterior (`lib/similarity.ts`, colección `fingerprints`).

- No muevas, importes ni actives nada de `detector/` a menos que el usuario lo pida explícitamente (por ejemplo, «activa el detector»).
- Cuando lo pida, sigue `detector/ACTIVAR.md` paso a paso, empezando por el paso 0: confirmar las decisiones de `detector/lib/policy.ts` con el usuario.
- Qué hace y por qué: `detector/README.md`.
- Para comprobar que sigue funcionando sin activarlo: `npm run detector:test`.
- Si cambias `lib/types.ts`, `lib/data.ts`, `components/project-form.tsx`, `app/eventos/[id]/organizer-view.tsx`, `app/eventos/[id]/proyectos/[pid]/project-view.tsx`, `firestore.rules` o `tests/firestore.rules.test.mjs`, los parches de `detector/patches/` pueden dejar de aplicarse (compruébalo con `git apply --check detector/patches/*.patch`). Avísale al usuario; ACTIVAR.md explica cómo aplicarlos a mano.
