# Alta de alumnos líderes por correo

El administrador y el superadmin usan **Administración → Dar de alta alumno líder** y seleccionan el evento. El creador y los coorganizadores usan **Evento → Proyectos → Dar de alta alumno líder** en los eventos que administran. El permiso global «Organizador» no da acceso a eventos ajenos.

1. Seleccionar el evento y escribir únicamente el correo del alumno líder.
2. Pulsar **Dar de alta líder**. Feria guarda el lugar del alumno y envía un correo para configurar el acceso. Una cuenta existente conserva su contraseña hasta que la persona decida cambiarla.
3. El alumno abre **Configurar mi acceso** en su correo, escribe su nombre completo y elige su contraseña. El botón **Ir a mi proyecto** lleva al formulario pendiente.
4. El líder escribe el nombre del proyecto, categoría, resumen, problema, solución y tecnologías, y agrega a sus integrantes. Cada integrante agregado recibe su propio correo para configurar el acceso y abrir el proyecto.
5. Si un correo falla o caduca, **Enviar acceso** permite volver a enviarlo desde el proyecto. El organizador puede reenviar el acceso del líder pendiente y el líder puede reenviar el de sus integrantes.

El organizador y el administrador no necesitan conocer los datos del proyecto ni registrar a los integrantes. El líder administra a sus integrantes desde **Información → Editar**. El organizador conserva sus controles del evento y la posibilidad de retirar un registro antes de publicar resultados.

## Registro pendiente y permisos

Desde 0.4.6, si otra sesión elimina el evento mientras está abierto el formulario de alta, se muestra un aviso y se conserva el correo escrito. Si quedan eventos puede seleccionarse otro; si desaparecen todos, el alta queda deshabilitada sin bloquear Administración.

El alta reserva al líder en el registro privado del evento y crea un documento con `registrationPending: true`, sin nombre de proyecto, categoría ni descripciones inventadas. No se generan huellas de similitud para ese documento, no aparece entre los proyectos del juez y no puede recibir entregas ni calificaciones ni entrar en resultados hasta completar el formulario.

Solo el líder puede completar ese registro. Puede hacerlo aunque el registro público esté cerrado, pues el responsable ya lo inscribió. El formulario valida los datos completos y sincroniza los integrantes con el registro privado en una transacción. Las reglas impiden que otro usuario complete el registro o que un alumno se conceda por sí mismo un alta pendiente para eludir el cierre del registro público.

No se admiten nuevas altas ni la elección inicial de categoría cuando ya comenzó la evaluación (incluso si luego se cierra), ni con resultados publicados. Los eventos antiguos requieren la actualización de permisos existente del superadmin. Una cuenta solo puede pertenecer a un equipo por evento; puede participar en eventos distintos con la misma cuenta. El registro autónomo de alumnos continúa disponible cuando el organizador lo abre.

## Servidor y pruebas

`POST /api/team-enrollment` acepta exclusivamente `{ eventId, email }`. Verifica token Firebase, revocación, correo verificado y permisos del responsable. Repite autorización y conflictos dentro de la transacción que crea el registro pendiente, sincroniza el registro privado y crea el perfil si falta. Usa Firebase Admin SDK solo en el servidor; no concede permisos globales.

El correo se solicita después de guardar el alta. Si falla el envío, la respuesta distingue el registro guardado del envío fallido y conserva el proyecto para reintentar. Las respuestas nunca devuelven contraseñas ni enlaces de activación.

En desarrollo, el servidor necesita credenciales de aplicación de Google (ADC). `npm run test:enrollment` prueba Auth y Firestore en `demo-code`, sin escribir en producción. `npm run test:rules` comprueba también la finalización del formulario y sus restricciones. El modo `NEXT_PUBLIC_USE_EMULATORS=true` exige un proyecto con prefijo `demo-` y se rechaza en producción.

El código actualizado y `firestore.rules` deben publicarse juntos. El detector nuevo de `detector/` permanece inactivo. Los parches de activación ya tenían conflictos en `components/project-form.tsx` y `lib/data.ts`; deben revisarse antes de una activación futura, siguiendo `detector/ACTIVAR.md`.
