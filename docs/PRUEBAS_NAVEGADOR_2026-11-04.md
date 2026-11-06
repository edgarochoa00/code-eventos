# Pruebas de navegador · 4 de noviembre de 2026

Se probaron los flujos descritos abajo en la versión local **0.4.0**, desde `http://localhost:3000`, conectada a **Firestore y Authentication de `code-94fbe`** y a Supabase Storage. Los datos funcionales se crearon y modificaron mediante formularios del navegador. Las cuentas verificadas y sus permisos globales se prepararon mediante la API administrativa; las consultas de respaldo y la limpieza también usaron las API.

Se utilizó Chrome del usuario para el recorrido inicial de organizador y alumno. Tras interrupciones del control de Chrome al cambiar de ventana, se continuó en Brave. En Brave se comprobaron escritorio y emulación **iPhone SE, 375 × 667**, con DevTools. No se utilizó un teléfono físico.

## Cobertura por perfil

| Perfil | Escritorio | Emulación móvil |
| --- | --- | --- |
| Organizador global y creador | Inicio de sesión, creación de evento con rúbrica, invitación de juez y coorganizador, apertura de evaluación | Gestión del evento, ocultar resultados, cerrar registro y entregas; rechazo de alumno como juez |
| Coorganizador | Consulta de resultados publicados | Panel de eventos, resumen, ajustes y rúbrica; publicación de resultados |
| Administrador | Panel global, usuarios, eventos y permisos; aviso de que solo superadmin cambia permisos globales | Panel administrativo y administración del evento como rol efectivo Admin |
| Juez | Evaluación bloqueada tras publicar, con nota y comentario conservados | Evento asignado, proyecto, evaluación guardada, archivo descargado y originalidad |
| Alumno líder | Acceso por código, validaciones y conflicto al incluir al juez como integrante | Consulta de entrega y resultados, comentario anónimo y bloqueo de edición tras publicar |
| Integrante | Consulta de entrega cerrada sin botón de edición | Proyecto visible en su panel; edición y guardado de información; miembros sin controles de agregar o quitar |
| Usuario sin proyecto | Crear evento denegado | Administración y proyecto ajeno denegados por URL; crear evento denegado |
| Suspendido | Pantalla de cuenta suspendida | Misma restricción y bloqueo al abrir directamente la URL de un proyecto |
| Superadmin | **Pendiente: no había sesión disponible** | **Pendiente** |

Las dos columnas describen las comprobaciones realizadas en cada tamaño; no representan una repetición íntegra de todos los pasos en ambos tamaños.

## Resultados observados

- El evento se creó desde el formulario y generó un código de acceso. Su registro privado de integrantes se creó correctamente.
- Crear el evento sin nombre de criterio produjo «Todos los criterios necesitan nombre».
- Registrar un proyecto vacío mostró errores de nombre, resumen, problema y solución.
- Incluir al juez en un equipo fue rechazado. El intento inverso, asignar al alumno como juez desde la administración del evento, también fue rechazado.
- El proyecto válido se registró con líder e integrante. El integrante lo encontró en «Mis proyectos» sin volver a registrarlo.
- El integrante guardó un cambio en el resumen desde la vista móvil. La interfaz indicó «Solo el líder del equipo puede agregar o quitar integrantes» y no ofreció controles para hacerlo.
- Guardar una entrega sin archivos produjo «Agrega al menos un archivo a la entrega».
- El alumno seleccionó `qa-entrega.txt` mediante el selector nativo y guardó la entrega. La interfaz mostró «ENTREGADO» y «Archivo subido».
- El juez descargó ese archivo desde la interfaz. El original y la descarga tenían **124 bytes** y el mismo SHA-256: `b2c01e07cec1ec0fbb1c3fec4e11bb544f9eac1f459e935dad8ffd063d7d68a0`.
- El juez guardó **6.5/10**, equivalente a **65/100**, con un comentario. La interfaz confirmó «Calificación guardada».
- Originalidad mostró «Sin coincidencias relevantes» para el proyecto sintético. El equipo no recibió la pestaña de originalidad mientras su visibilidad estaba oculta.
- El coorganizador publicó los resultados. La vista previa, el ranking publicado y el resultado del alumno coincidieron en **65.0**, lugar **1 de 1**.
- El alumno vio el comentario bajo «Comentarios de los jueces», sin nombre ni correo del juez.
- Después de publicar, el equipo dejó de tener edición de la entrega y el juez tuvo deshabilitados nota, comentario y actualización. Se conservó su evaluación.
- El administrador accedió al panel global y a la administración del evento. El área de permisos no ofreció asignación de permisos globales a esta cuenta.
- La cuenta ajena recibió «Solo administradores», «Necesitas permiso de organizador» y «Solo los integrantes, jueces y organizadores pueden ver este proyecto», según la ruta visitada.
- La cuenta suspendida quedó bloqueada incluso al abrir directamente el proyecto.
- Ocultar resultados funcionó. El organizador cerró registro y entregas; el integrante pudo consultar su entrega, sin editarla, en móvil y escritorio.
- Se recorrieron pestañas y controles en la emulación móvil y se comprobó el cambio entre modo claro y oscuro. Las pestañas administrativas usan desplazamiento horizontal cuando no caben.

No se identificó un fallo funcional confirmado en estos recorridos. Esto no certifica todas las combinaciones posibles de permisos, navegadores o datos.

## Incidencias y límites

El servidor heredó inicialmente `NODE_ENV=production` al ejecutar `next dev`. Se reinició con `NODE_ENV=development`. Hubo interrupciones del control nativo de Chrome y pestañas que requirieron reabrirse para continuar; no se atribuyen como defecto confirmado del código. Brave también mostró solicitudes de Firestore con `ERR_BLOCKED_BY_CLIENT` durante cambios de sesión, sin impedir los guardados comprobados.

No se probaron la gestión exclusiva de superadmin, el registro y verificación de correo de nuevas cuentas desde la interfaz, la recuperación de contraseña, los límites de 30 MB/10 archivos, asignaciones granulares del juez, coincidencias deliberadas con proyectos históricos ni eventos antiguos con dos etapas. La prueba utilizó el evento nuevo de una entrega que crea actualmente el formulario. El detector nuevo de `detector/` permaneció inactivo.

No se modificó código de la aplicación ni se publicaron despliegues o reglas.

## Limpieza verificada

Se utilizó el prefijo exclusivo `qa1104-mw2rid68` para ocho cuentas y un único evento temporal. Se cerraron las pestañas creadas para las pruebas.

- **Firestore:** se eliminaron y comprobaron por lectura **16 documentos**: ocho perfiles, tres permisos globales, un evento, un proyecto, una evaluación, un registro de integrantes y una huella del detector anterior. Todos devolvieron ausencia. Las subcolecciones de proyectos, evaluaciones y acceso quedaron vacías.
- **Authentication:** se eliminaron las **ocho cuentas temporales** y se consultaron sus correos; no quedó ninguna.
- **Supabase Storage:** se eliminó **un archivo** bajo la ruta del evento temporal y se volvió a listar esa ruta; quedaron **cero archivos**.
- Se eliminó la copia descargada de `qa-entrega.txt` después de comprobar su hash.
- Las cuentas demo preexistentes no formaron parte de la eliminación.
