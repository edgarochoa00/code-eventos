# Detector de originalidad · EN DESARROLLO, NO ACTIVO

Esta carpeta tiene el detector nuevo completo y probado, pero **no está conectado a la app**. La app en producción sigue con el detector anterior. Nada de aquí se compila ni se despliega: `tsconfig.json` excluye `detector/`.

Para activarlo sigue [ACTIVAR.md](./ACTIVAR.md) paso a paso.

## Idea

El detector **no decide si hay plagio**. Es el ancla: guarda versiones con fecha que nadie puede alterar, compara contra todo el historial y, cuando algo coincide, abre un caso para que una persona lo revise con evidencia.

1. **Ancla.** Cada vez que un equipo registra o entrega algo se guarda una versión con la hora del servidor. Nadie puede editarla ni borrarla. Solo guarda hashes y números, nunca el texto ni los enlaces legibles.
2. **Sello del organizador.** Al cerrar una etapa, abrir la evaluación o publicar resultados, la app del organizador recalcula las huellas desde el contenido real y las fija como versión oficial. Esa versión es la que usan otros eventos para comparar.
3. **Comparación.** Contra todos los eventos anteriores (índice compacto: 1 lectura por evento) y contra el resto del evento. Primero un filtro rápido (MinHash) y luego una comparación exacta solo con los candidatos.
4. **Evidencia por tipo**, no un solo porcentaje:
   - **Archivo idéntico:** es exactamente el mismo archivo.
   - **Mismo enlace:** mismo repositorio, video o documento.
   - **Frases en común:** porcentaje exacto de pares de palabras compartidos.
   - **Tema parecido:** solo informativo; nunca abre caso.
5. **Filtros antes de alertar:**
   - El texto de las bases del evento no cuenta.
   - Las frases que usan muchos equipos del mismo evento no cuentan.
   - Si los dos proyectos comparten integrantes, es continuación del mismo equipo: no se abre caso (según la política).
   - Los enlaces que el equipo declaró como plantilla o código de terceros no cuentan.
6. **Prioridad.** El caso siempre se abre en el proyecto que apareció **después**. El anterior es la referencia.
7. **Revisión humana.** Por revisar → Esperando al equipo → En revisión → Propuesta → Confirmado o Descartado. El equipo puede responder con pruebas. Para confirmar se necesitan dos personas (propone el organizador y confirma un admin distinto). Todo queda en un historial inmutable.
8. **Sin sanción automática.** Solo un caso confirmado marca el proyecto. Los jueces ven esa marca; el equipo ve la decisión.

## Quién ve qué

| Rol | Ve |
| --- | --- |
| Organizador del evento | Todos los casos del evento, la evidencia, las frases propias resaltadas, el historial y las versiones del proyecto. El proyecto de referencia completo solo si también organiza ese otro evento |
| Admin / superadmin | Todo lo anterior, el proyecto de referencia completo y la opción de confirmar o reabrir casos |
| Equipo | Solo los casos que el organizador le notificó: qué coincide, sus propias frases resaltadas y la decisión. Nunca el nombre ni el texto del otro proyecto |
| Juez | Solo la marca cuando un caso se confirma |

## Archivos

```
detector/
  README.md                 este archivo
  ACTIVAR.md                guía de activación para un agente o desarrollador
  tsconfig.json             compila la carpeta con las rutas que tendrá ya activada
  lib/                      → se mueve a lib/detector/
    types.ts                modelo de datos (anclas, índice, casos, historial)
    policy.ts               decisiones de la escuela y umbrales (CONFIRMAR ANTES DE ACTIVAR)
    signals.ts              huella de un proyecto (pares de palabras, MinHash, hashes)
    evidence.ts             evidencia por tipo entre dos proyectos
    detect.ts               filtros, candidatos, prioridad y alertas (lógica pura)
    highlight.ts            resalta las frases propias que coinciden
    store.ts                Firestore: anclas, sello, índice, casos y acciones
    hooks.ts                hooks de React
  components/               → se mueve a components/detector/
    cases-panel.tsx         pestaña «Originalidad» del organizador
    case-view.tsx           detalle del caso y decisión
    detector-summary-card.tsx  tarjeta del resumen del evento
    project-originality.tsx    pestaña «Originalidad» del proyecto (casos + versiones)
    team-case-notice.tsx    aviso y respuesta del equipo
    declaration-fields.tsx  declaración de originalidad en el registro
    originality-flag.tsx    marca para jueces cuando se confirma
    evidence-bits.tsx       piezas compartidas
  patches/                  cambios a archivos existentes de la app (git apply)
  rules/firestore.rules     reglas completas ya combinadas (referencia y pruebas)
  scripts/backfill.ts       sella los eventos que ya existen al activar
  tests/
    logic.test.ts           12 pruebas de la lógica
    detector.rules.test.mjs 29 pruebas de reglas
    e2e/seed.ts, flow.mjs   prueba de punta a punta en celular y web (emulador)
```

## Modelo de datos nuevo

| Ruta | Qué guarda | Quién escribe |
| --- | --- | --- |
| `events/{e}/projects/{p}/anchors/{a}` | Versión inmutable: hashes, firmas, hora del servidor | Equipo (registro y entregas) y organizador (sello) |
| `originalityIndex/{e}` y `{e}__N` | Índice compacto del evento (≤150 proyectos por documento) | Solo el sello del organizador |
| `originalityShingles/{p}` | Pares de palabras del proyecto sellado (comparación exacta) | Solo el sello del organizador |
| `events/{e}/cases/{p}__{otro}` | Caso: evidencia, estado, respuesta, propuesta y decisión | Organizador, admin y equipo (solo su respuesta) |
| `events/{e}/cases/{c}/log/{l}` | Historial inmutable del caso | Organizador, admin y equipo notificado |
| `project.declaration` | Lo que declaró el equipo al registrar | Equipo |
| `project.originalityStatus` | Marca de caso confirmado | Solo organizador o admin |

## Decisiones pendientes (en `lib/policy.ts`)

1. ¿Un equipo puede continuar su propio proyecto de años anteriores? (por defecto: sí)
2. ¿Quién confirma un caso? (por defecto: organizador propone y admin distinto confirma)
3. ¿El equipo puede responder antes de la decisión? (por defecto: sí)
4. ¿Qué consecuencias aplica la escuela? (por defecto: sin efecto, aviso a jueces, penalización o descalificación)

Con «organizador + admin» se necesitan al menos dos personas con permiso. Si solo existe el superadmin, no podrá confirmar sus propias propuestas.

## Verificado

- 12 pruebas de lógica: copia renombrada, paráfrasis, mismo repositorio, plantilla declarada, archivo idéntico, continuación, bases del evento, frases comunes, prioridad y resaltado.
- 29 pruebas de reglas: versiones con fecha falsa, sellos de equipos, índice ajeno, privacidad de casos, transiciones, dos personas para confirmar e historial inmutable.
- Flujo completo en el emulador (29 verificaciones en celular y web):
  1. Se detecta la copia, pero no la continuación ni la plantilla declarada.
  2. El organizador pide explicación y el equipo responde.
  3. El organizador propone y no puede confirmar solo.
  4. Un admin confirma y el juez ve la marca.
  5. El registro nuevo guarda su primera versión.
  6. El sello funciona.
- Las 22 pruebas de reglas que ya existían siguen pasando con las reglas combinadas (después del ajuste en `patches/03`).

## Límites conocidos

- Compara palabras, no significados: una paráfrasis profunda no se detecta como texto (sí por enlace o archivo). Se podría agregar comparación semántica con IA como señal extra.
- El índice guarda la fecha de primera aparición que calcula el organizador. La fuente de verdad son las anclas con hora del servidor; un admin puede revisarlas en el caso.
- Los hashes de correos sirven para detectar continuación. Alguien con acceso al índice podría comprobar si un correo concreto participó en algún proyecto, pero no leer el proyecto.
