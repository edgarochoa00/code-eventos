# Alta de alumnos líderes por correo

El administrador y el superadmin usan **Administración → Dar de alta alumno líder** y seleccionan el evento. El creador y los coorganizadores usan **Evento → Proyectos → Dar de alta alumno líder** en los eventos que administran. El permiso global «Organizador» no da acceso a eventos ajenos.

1. Seleccionar el evento y escribir únicamente el correo del alumno líder.
2. Pulsar **Dar de alta líder**. Si el correo ya tiene cuenta, se conserva su acceso, contraseña y perfil. Si no tiene cuenta, se crea y se muestra una contraseña una sola vez.
3. Copiar y compartir el acceso con el alumno antes de cerrar. Las cuentas nuevas deben verificar su correo al entrar; pueden cambiar la contraseña con «Olvidé mi contraseña». El alta no envía correos automáticamente.
4. Al entrar al panel, el alumno ve directamente el formulario de cada proyecto pendiente. También puede abrirlo desde el evento. Escribe su nombre completo, el nombre del proyecto, categoría, resumen, problema, solución y tecnologías, y agrega a sus integrantes.
5. Al completar el formulario, el proyecto queda registrado. Los integrantes lo verán al acceder con el correo que registró su líder. Si aún no tienen cuenta, pueden crearla con ese mismo correo. Las entregas se habilitan según la configuración del evento.

El organizador y el administrador no necesitan conocer los datos del proyecto ni registrar a los integrantes. El líder administra a sus integrantes desde **Información → Editar**. El organizador conserva sus controles del evento y la posibilidad de retirar un registro antes de publicar resultados.

## Registro pendiente y permisos

El alta reserva al líder en el registro privado del evento y crea un documento con `registrationPending: true`, sin nombre de proyecto, categoría ni descripciones inventadas. No se generan huellas de similitud para ese documento, no aparece entre los proyectos del juez y no puede recibir entregas ni calificaciones ni entrar en resultados hasta completar el formulario.

Solo el líder puede completar ese registro. Puede hacerlo aunque el registro público esté cerrado, pues el responsable ya lo inscribió. El formulario valida los datos completos y sincroniza los integrantes con el registro privado en una transacción. Las reglas impiden que otro usuario complete el registro o que un alumno se conceda por sí mismo un alta pendiente para eludir el cierre del registro público.

No se admiten nuevas altas ni la elección inicial de categoría cuando ya comenzó la evaluación (incluso si luego se cierra), ni con resultados publicados. Los eventos antiguos requieren la actualización de permisos existente del superadmin. Una cuenta solo puede pertenecer a un equipo por evento; puede participar en eventos distintos con la misma cuenta. El registro autónomo de alumnos continúa disponible cuando el organizador lo abre.

## Servidor y pruebas

`POST /api/team-enrollment` acepta exclusivamente `{ eventId, email }`. Verifica token Firebase, revocación, correo verificado y permisos del responsable. Repite autorización y conflictos dentro de la transacción que crea el registro pendiente, sincroniza el registro privado y crea el perfil si falta. Usa Firebase Admin SDK solo en el servidor; no concede permisos globales.

Auth y Firestore no comparten transacciones. Si se crea una cuenta y falla el resto del alta, la respuesta conserva sus accesos para copiarlos y reintentar. No se borran cuentas automáticamente ni se cambian contraseñas existentes. Si se pierde el acceso, el alumno puede recuperarlo desde el inicio de sesión.

En desarrollo, el servidor necesita credenciales de aplicación de Google (ADC). `npm run test:enrollment` prueba Auth y Firestore en `demo-code`, sin escribir en producción. `npm run test:rules` comprueba también la finalización del formulario y sus restricciones. El modo `NEXT_PUBLIC_USE_EMULATORS=true` exige un proyecto con prefijo `demo-` y se rechaza en producción.

El código actualizado y `firestore.rules` deben publicarse juntos. El detector nuevo de `detector/` permanece inactivo. Los parches de activación ya tenían conflictos en `components/project-form.tsx` y `lib/data.ts`; deben revisarse antes de una activación futura, siguiendo `detector/ACTIVAR.md`.
