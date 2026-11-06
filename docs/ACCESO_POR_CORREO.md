# Acceso por correo para jueces y organizadores

El diseño propuesto con logo y botón está preparado en `emails/acceso.html`. Su envío todavía requiere un remitente y un proveedor para Feria 2026; véase [Correos personalizados](CORREOS_PERSONALIZADOS.md). No modifica por sí solo los correos nativos de Firebase.

Al agregar jueces u organizadores desde un evento o desde Administración, primero se guarda el rol y después se solicita a Firebase Authentication el envío del acceso. El permiso global de organizador o administrador, asignado por el superadmin, utiliza el mismo flujo.

Si el correo no tiene cuenta, el servidor la crea con una contraseña aleatoria que no devuelve ni muestra. La persona recibe el correo de Firebase para **establecer o restablecer su contraseña** y elige su propia contraseña en la página segura de Firebase. Este correo puede decir «restablecer» aunque sea el primer acceso. Al completar el enlace, Firebase confirma la posesión del correo. La persona vuelve a `https://feria2026.web.app/login`, inicia sesión y obtiene el rol que ya tenía asignado por su correo.

Enviar el acceso a una cuenta existente conserva su identificador, nombre, perfil, contraseña y verificación. Solo completar el enlace cambia la contraseña y puede invalidar sesiones anteriores, conforme al flujo de Firebase. No se marca un correo como verificado desde el alta administrativa.

**Enviar acceso** aparece junto a los correos y en la gestión de personas y permisos. Permite atender correos agregados antes de esta mejora. No se envían correos retroactivamente a toda la lista al publicar. Si el envío falla, se informa que el permiso está guardado y se ofrece reintentar. Revisar también spam y promociones; la respuesta del servicio de correo confirma la solicitud de envío, no la recepción en la bandeja del destinatario.

## Comprobación y operación

- `npm run test:invitations` prueba el servicio real con los emuladores de Auth y Firestore de `demo-code`, sin enviar correos reales.
- Se prueban alta, entrega simulada, elección de contraseña, verificación del correo, inicio de sesión, conservación de cuentas existentes, reintentos, concurrencia, fallos de envío y restricciones por rol.
- El endpoint `POST /api/account-invitations` exige token válido y correo verificado, comprueba nuevamente el rol del responsable y la asignación del destinatario. No acepta una URL de retorno enviada por el cliente ni permite invitar a direcciones sin un rol asignado.
- Los registros privados `accountInvitationDeliveries/{sha256(correo)}` y `accountInvitationLimits/{uid}` no tienen acceso desde clientes. Se permite un intento por destinatario por minuto y 200 intentos por responsable por hora, además de las cuotas propias de Firebase.
- El envío usa Firebase Authentication, la clave pública ya configurada y las credenciales de servicio existentes de App Hosting. No requiere un proveedor SMTP adicional. Publicar App Hosting y luego `npm run deploy:hosting`.

La plantilla nativa está configurada en español en Firebase Authentication → Plantillas → Restablecer contraseña. Firebase bloquea actualmente la personalización de las plantillas de este proyecto (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`, confirmado también en la consola), por lo que el asunto conserva el nombre público genérico `project-870593638237`. Modificar esa presentación requiere atención de Firebase; la restricción no impide enviar ni completar el acceso. La prueba real del 5 de noviembre confirmó recepción en Spam. La clasificación depende del proveedor del destinatario; una respuesta de envío correcta no garantiza llegada a Recibidos.

## Validación del 5 de noviembre de 2026

Pasaron 12 pruebas de invitaciones, 31 casos de uso y 64 pruebas de reglas, además de compilación, TypeScript y lint de los archivos modificados. En la versión pública 0.4.2 se creó un evento temporal con un organizador sintético, se agregó desde la interfaz el correo de prueba autorizado por el usuario y se comprobó la creación de la cuenta, el rol guardado y la aceptación del envío por Firebase. La recepción se confirmó en Gmail, carpeta Spam. Una cuenta sintética adicional completó el enlace de establecimiento en Firebase real sin enviar correo; su correo quedó verificado y pudo iniciar sesión con la contraseña elegida. No se cambió la contraseña del destinatario real.

Se cerró la sesión de prueba y se eliminaron por API el evento temporal, su registro de participantes, el perfil y la cuenta del organizador sintético y su contador de envíos. La ausencia se comprobó por lectura. La cuenta y el correo recibidos por el destinatario real se conservaron.

Los parches de activación del detector nuevo ya fallaban antes de este cambio en `components/project-form.tsx` y `lib/data.ts` y siguen requiriendo revisión manual. El detector de `detector/` no se activó.

El alta de alumnos líderes conserva su flujo documentado en [ALTAS_EQUIPOS.md](ALTAS_EQUIPOS.md); esta mejora corresponde a jueces, organizadores y permisos globales de administración.
