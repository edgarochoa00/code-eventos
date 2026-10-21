# C.O.D.E · Evaluación de proyectos escolares

Web app pensada primero para celular para organizar eventos de proyectos. Los equipos registran su proyecto y suben su prototipo y su producto final, los jueces califican con una rúbrica y el organizador publica los resultados. Incluye detección de similitud contra todos los proyectos históricos, modo claro y oscuro, y un panel de superadmin.

Stack: Next.js 16 (App Router) · React 19 · Tailwind 4 · Firebase (Auth + Firestore) · proyecto `code-94fbe`.

## Arranque

```bash
npm install
npm run dev            # http://localhost:3000
```

Las variables están en `.env.local` (plantilla en `.env.example`). En Vercel se configuran como variables de entorno del proyecto.

| Script | Para qué |
| --- | --- |
| `npm run test:rules` | Prueba `firestore.rules` en el emulador (necesita Java) |
| `npm run emulators` + `npm run dev:emulators` | App local contra Auth/Firestore simulados, sin tocar datos reales |
| `npm run deploy:rules` | Publica reglas e índices en `code-94fbe` |

Storage es opcional y requiere el plan Blaze. Si lo activas, corre `firebase deploy --only storage` y pon `NEXT_PUBLIC_ENABLE_STORAGE=true`. Sin Storage solo se guarda la huella SHA-256 de cada archivo, y los equipos comparten sus archivos con enlaces.

## Permisos

### En la plataforma (Administración → `/admin`)

| Permiso | Quién | Qué puede hacer |
| --- | --- | --- |
| Superadmin | `edgarochoa0173@gmail.com` (fijo en `lib/types.ts` y `firestore.rules`) | Todo. Es el único que da o quita permisos y suspende cuentas |
| Admin | Lo asigna el superadmin | Administra todos los eventos, jueces y organizadores, y ve a todos los usuarios |
| Organizador | Lo asigna el superadmin | Puede crear sus propios eventos |
| Usuario | Todos los demás | Registra proyectos y califica si lo agregan como juez |
| Suspendido | Lo asigna el superadmin | No puede usar la app |

Los permisos se guardan en `staff/{correo}` y funcionan aunque la persona todavía no tenga cuenta: se aplican cuando se registre con ese correo.

### En cada evento

| Rol | Cómo se obtiene | Qué puede hacer |
| --- | --- | --- |
| Organizador | Crea el evento, lo agregan en «Jueces → Organizadores» o es admin | Abre y cierra etapas, invita jueces, edita la rúbrica, ve calificaciones y originalidad, publica resultados |
| Juez | Su correo está en la lista de jueces | Califica de 0 a 10 por criterio con comentario |
| Alumno | Entra con el código o un compañero lo agrega | Registra su proyecto, entrega prototipo y producto final mientras la etapa esté abierta, ve su resultado |

## Originalidad (`lib/similarity.ts`)

Cada proyecto guarda una huella permanente en `fingerprints/{projectId}` y se compara contra todo el historial con cuatro señales:

- **Frases y vocabulario**: MinHash sobre el texto (detecta copias aunque cambie el nombre).
- **Enlaces**: mismo repositorio, video o Drive. Se guarda solo el hash, nunca la URL.
- **Archivos**: mismo SHA-256, es decir, una copia exacta.

Niveles: alto ≥ 75 %, medio ≥ 45 %, bajo ≥ 25 %. Si un proyecto tiene menos de 25 palabras útiles y no tiene enlaces ni archivos, aparece como «Sin datos aún» en lugar de «Original».

Quién ve el análisis (se configura en Evento → Ajustes → Originalidad):

- **Organizadores**: siempre.
- **Jueces**: siempre, o solo cuando se abre la evaluación.
- **Equipos**: nunca (predeterminado), al publicar resultados o desde una fecha. Solo ven su propio porcentaje y el motivo, nunca el nombre de los otros proyectos.

## Modo oscuro

El botón de luna/sol del encabezado cambia el tema y la elección se guarda en el navegador. La primera vez se usa el tema del sistema. Los colores son variables CSS en `app/globals.css` (`ink`, `paper`, `surface`, `night`, `coal`, `lime`), así que el diseño no cambia: solo los valores.

## Estructura

```
app/
  page.tsx                      Portada
  login/                        Entrar / crear cuenta / Google
  panel/                        Mis proyectos, para evaluar, organizo, unirse con código
  admin/                        Superadmin: usuarios, permisos, jueces y eventos
  eventos/nuevo/                Crear evento (organizador, admin o superadmin)
  eventos/[id]/                 Vista según rol (organizador, juez, alumno)
  eventos/[id]/proyectos/[pid]/ Detalle, entregas, evaluar, originalidad, resultados
components/                     UI, formularios, tema
lib/
  access.tsx     Permiso global del usuario
  data.ts        Lecturas y escrituras de Firestore, resultados
  similarity.ts  Huellas y comparación anti-plagio
tests/           Pruebas de firestore.rules
```

## Cuentas demo por rol

`node scripts/demo-roles.mjs crear` crea en `code-94fbe` una cuenta por rol, el evento «DEMO · Expo de Proyectos» (código `DEMO26`) y un proyecto con similitud alta contra un evento histórico. `node scripts/demo-roles.mjs borrar` elimina todo eso. Usa la sesión del Firebase CLI; la contraseña es `CodeDemo2026!` (o la de `DEMO_PASSWORD`).

| Rol | Correo |
| --- | --- |
| Admin | demo.admin@example.com |
| Organizador (crea eventos) | demo.organizador@example.com |
| Coorganizador del evento | demo.coorganizador@example.com |
| Juez | demo.juez@example.com |
| Alumno líder | demo.alumno@example.com |
| Integrante | demo.integrante@example.com |
| Alumno sin proyecto | demo.nuevo@example.com |
| Suspendido | demo.suspendido@example.com |
