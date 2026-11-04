# C.O.D.E · Evaluación de proyectos escolares

Web app pensada primero para celular para organizar eventos de proyectos. El organizador define el nombre del evento, sus entregas y la rúbrica; los equipos registran su proyecto, los jueces califican y el organizador publica los resultados. Incluye detección de similitud contra todos los proyectos históricos, modo claro y oscuro, y un panel de superadmin.

Stack: Next.js 16 (App Router) · React 19 · Tailwind 4 · Firebase (Auth + Firestore, proyecto `code-94fbe`) · Supabase Storage (archivos).

Cada evento tiene nombre, instrucciones y criterios propios, definidos por el organizador al crearlo. Por ejemplo, **Carteles** y **Prototipos** se crean como dos eventos independientes, cada uno con su código, jueces y resultados. Cada evento admite una entrega y una segunda opcional, ambas con nombre libre. No se precargan criterios de evaluación; las categorías empiezan en General y se pueden personalizar. Los eventos anteriores conservan sus entregas y rúbricas.

## Arranque

```bash
npm install
npm run dev            # http://localhost:3000
```

Las variables locales están en `.env.local` (plantilla en `.env.example`). En Firebase App Hosting se configuran en `apphosting.yaml`; la clave privada de Supabase se referencia desde Secret Manager.

| Script | Para qué |
| --- | --- |
| `npm run test:storage` | Prueba permisos y límites de archivos con servicios simulados, sin datos reales |
| `npm run test:rules` | Prueba `firestore.rules` en el emulador (necesita Java) |
| `npm run emulators` + `npm run dev:emulators` | App local contra Auth/Firestore simulados, sin tocar datos reales |
| `npm run deploy:rules` | Publica reglas e índices en `code-94fbe` |

Las entregas nuevas requieren archivos subidos directamente: hasta **30 MB por archivo y 10 archivos por entrega**. No se aceptan enlaces externos. Firebase conserva las cuentas y los datos; Supabase Storage guarda los archivos en un bucket privado. Consulta [la configuración de archivos](docs/SUPABASE_STORAGE.md) para conectar el proyecto. Los archivos antiguos de Firebase Storage conservan compatibilidad de descarga.

## Publicar en Firebase

El backend de App Hosting es `feria2027`, en el proyecto `code-94fbe`. `firebase.json` también conecta `feria2027.web.app` con su servicio de Cloud Run.

```bash
npx -y firebase-tools@15 deploy --only apphosting --project code-94fbe
npm run deploy:rules
npx -y firebase-tools@15 deploy --only hosting --project code-94fbe
```

Usa una cuenta de Firebase con acceso al proyecto (`--account CORREO` si tienes varias sesiones). El secreto `SUPABASE_SERVICE_ROLE_KEY` debe existir y permitir acceso al backend. `.env.local` no se publica. Al actualizar los permisos, sigue también la [puesta en marcha de eventos existentes](docs/PERMISOS.md#puesta-en-marcha).

## Permisos

### En la plataforma (Administración → `/admin`)

| Permiso | Quién | Qué puede hacer |
| --- | --- | --- |
| Superadmin | `edgarochoa0173@gmail.com` (fijo en `lib/types.ts` y `firestore.rules`) | Administra la plataforma; es el único que da o quita permisos y suspende cuentas. No concursa ni califica |
| Admin | Lo asigna el superadmin | Administra todos los eventos y ve a todos los usuarios. No concursa ni califica mientras tenga este permiso |
| Organizador | Lo asigna el superadmin | Puede crear sus propios eventos |
| Usuario | Todos los demás | Registra proyectos y califica si lo agregan como juez |
| Suspendido | Lo asigna el superadmin | No puede usar la app |

Los permisos se guardan en `staff/{correo}` y funcionan aunque la persona todavía no tenga cuenta: se aplican cuando se registre con ese correo.

### En cada evento

| Rol | Cómo se obtiene | Qué puede hacer |
| --- | --- | --- |
| Organizador | Crea el evento, lo agregan en «Jueces → Organizadores» o es admin | Abre y cierra etapas, invita jueces, edita la rúbrica, ve calificaciones y originalidad, publica resultados |
| Juez | Su correo está en la lista de jueces, sin administrar ni concursar en ese evento | Califica de 0 a 10 por criterio con comentario, únicamente en sus categorías o proyectos asignados y etapas habilitadas |
| Alumno | Entra con el código o un compañero lo agrega | Registra su proyecto, presenta las entregas definidas por el organizador mientras estén abiertas y ve su resultado. Solo el líder agrega o quita integrantes |

Conflictos de interés que se bloquean (en la interfaz y en `firestore.rules`):

- Quien concursa en un evento no puede ser juez ni organizador de ese evento, y viceversa.
- Un juez nunca califica un proyecto del que forma parte.
- El organizador no edita el contenido ni las entregas de los equipos; solo escribe la retroalimentación al publicar resultados.
- Organizador y juez son incompatibles en el mismo evento. Los admins y el superadmin siempre actúan como administración, aunque aparezcan en una lista antigua de jueces o integrantes.
- Con resultados publicados no se pueden cambiar calificaciones, información ni entregas, ni descartar calificaciones o borrar proyectos. Para corregirlos, primero hay que ocultar los resultados.
- Las asignaciones de jueces también se comprueban en Firestore. Los proyectos no asignados se pueden consultar, pero no calificar. Se mantiene la evaluación de presentaciones en vivo aunque no haya archivo entregado.

Los eventos nuevos crean automáticamente un registro privado en `events/{id}/access/participants`. Los eventos existentes muestran al superadmin el botón **Actualizar permisos del evento**. La actualización conserva proyectos, roles y calificaciones; prepara el registro para comprobar conflictos también al asignar un rol. Hasta actualizarlo se bloquean altas/bajas de proyectos, cambios de integrantes o roles y evaluación de jueces. Las entregas existentes siguen disponibles. Consulta [la política y puesta en marcha](docs/PERMISOS.md).

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

### Detector nuevo (en desarrollo, no activo)

En `detector/` está listo un detector que no decide si hay plagio: guarda versiones con fecha que nadie puede alterar, abre casos con evidencia por tipo y pide revisión humana con dos personas para confirmar. No está conectado a la app. Para activarlo, sigue `detector/ACTIVAR.md`; para probarlo sin activarlo, `npm run detector:test`.

## Modo oscuro

El botón de luna/sol del encabezado cambia el tema y la elección se guarda en el navegador. La primera vez se usa el tema del sistema. Los colores son variables CSS en `app/globals.css` (`ink`, `paper`, `surface`, `night`, `coal`, `lime`), así que el diseño no cambia: solo los valores.

## Información del servicio

Términos (`/terminos`), aviso de privacidad (`/privacidad`), cookies y almacenamiento (`/cookies`) y versiones (`/versiones`) se muestran con `components/legal-page.tsx`. Los textos están en `lib/legal-content.ts` y describen lo que la app hace hoy. La fecha y versión de los documentos, el contacto y el historial de versiones están en `lib/legal.ts`. «Privacidad de mi cuenta» (`/panel/privacidad`) reúne los documentos, permite restablecer el tema y cerrar sesión en el navegador, y lleva al correo para solicitudes de privacidad.

- Si cambia el tratamiento de datos, actualiza el texto y sube `LEGAL_VERSION`.
- En cada versión de la app agrega una entrada al inicio de `RELEASES` y usa el mismo número en `package.json` (`npm version X.Y.Z --no-git-tag-version`).

## Estructura

```
app/
  page.tsx                      Portada
  login/                        Entrar / crear cuenta / Google
  panel/                        Mis proyectos, para evaluar, organizo, unirse con código
  panel/privacidad/             Privacidad de mi cuenta
  admin/                        Superadmin: usuarios, permisos, jueces y eventos
  eventos/nuevo/                Crear evento (organizador, admin o superadmin)
  eventos/[id]/                 Vista según rol (organizador, juez, alumno)
  eventos/[id]/proyectos/[pid]/ Detalle, entregas, evaluar, originalidad, resultados
  terminos/ privacidad/ cookies/ versiones/   Información del servicio
components/                     UI, formularios, tema, páginas legales
lib/
  access.tsx        Permiso global del usuario
  data.ts           Lecturas y escrituras de Firestore, resultados
  legal.ts          Versión de la app y de los documentos, contacto
  legal-content.ts  Textos de términos, privacidad y cookies
  similarity.ts     Huellas y revisión de originalidad
tests/              Pruebas de firestore.rules
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
