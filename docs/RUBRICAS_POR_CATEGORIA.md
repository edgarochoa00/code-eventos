# Rúbricas por categoría

Carteles y Prototipos pueden compartir un evento, su código de acceso y sus jueces, conservando criterios y pesos distintos.

## Configuración

1. En **Nuevo evento**, agrega las categorías que necesitas y quita General si no la usarás.
2. En **Criterios por categoría**, selecciona cada categoría y completa sus criterios antes de crear el evento.
3. En un evento existente, abre **Rúbrica**, selecciona la categoría, edita sus criterios y pulsa **Guardar rúbrica de [categoría]**. El botón guarda únicamente la categoría seleccionada.
4. El equipo elige su categoría al registrar el proyecto. El juez recibe automáticamente la rúbrica correspondiente, independientemente de que esté asignado a una o varias categorías.

Cada categoría admite hasta 20 criterios y el evento hasta 20 rúbricas. Los pesos se normalizan a 100 y cada criterio se califica de 0 a 10. Los totales, promedios, vistas de calificaciones, retroalimentación y columnas del CSV usan los criterios de la categoría del proyecto.

## Eventos existentes

- Sin una rúbrica personalizada para su categoría, un proyecto conserva los criterios generales del evento (`criteria`). No se migran ni borran entregas o evaluaciones.
- La personalización se guarda en `categoryCriteria`, utilizando el nombre exacto de la categoría. Se admiten nombres con espacios, puntos y diagonales.
- Cambiar los pesos de una categoría recalcula únicamente sus puntajes. Las evaluaciones antiguas conservan el comportamiento anterior: se ponderan los criterios coincidentes; si ninguno coincide, se usa el total guardado. Al agregar criterios, los jueces deben completar su evaluación.
- Las categorías antiguas que aún tienen proyectos aparecen en el editor aunque se hayan quitado de la lista de registro.
- Al abrir la evaluación, `categoryLocked` fija la categoría de los proyectos, incluso si luego se cierra la evaluación. Así los equipos no pueden cambiar la rúbrica que les corresponde después de empezar a calificar.
- Con resultados publicados, primero hay que ocultarlos para modificar una rúbrica. Guardar los datos del evento conserva sus entregas y sus nombres históricos.

## Validación y despliegue

- `npm run test:use-cases`: selección de rúbricas, compatibilidad histórica, pesos independientes, promedios por etapa y columnas del CSV.
- `npm run test:rules`: permisos de escritura, criterios de la categoría correcta, escala de puntuaciones, categoría fija y límite de 20 categorías con 20 criterios.
- `npm run test:storage`, `npm run lint`, `npm run typecheck` y `npm run build`.
- Publicar juntos la aplicación de App Hosting y `firestore.rules` en `code-94fbe`. El sitio `feria2026.web.app` apunta al backend existente `feria2027`.

Verificación local del cambio: 30 pruebas de casos de uso, 52 de reglas y 22 de almacenamiento aprobadas. En navegador con Auth y Firestore emulados se comprobó crear un evento con Carteles y Prototipos, rechazar una rúbrica incompleta, conservar cada borrador al cambiar de categoría, editar solamente Carteles, abrir la evaluación, calificar como juez, exportar CSV, publicar y consultar la retroalimentación como alumno. Los puntajes esperados fueron 65/100 para Carteles y 90/100 para Prototipos. Las vistas revisadas a 390 y 320 píxeles no tuvieron desbordamiento horizontal y no hubo errores de JavaScript. También se verificó que guardar los ajustes de un evento histórico mantiene sus dos entregas.

## Detector en desarrollo

El detector de `detector/` sigue excluido de la aplicación. Después de estos cambios, `git apply --check detector/patches/*.patch` señala conflictos en `components/project-form.tsx` y `lib/data.ts`. Antes de una futura activación deberán adaptarse esos parches siguiendo `detector/ACTIVAR.md`.
