# Correo de acceso con identidad de Feria 2026

La plantilla preparada está en `emails/acceso.html`. Incluye el escudo, el nombre de la feria, el rol, el evento, la cuenta destinataria y un botón que contiene el enlace seguro de Firebase. El enlace completo no ocupa el cuerpo visible del mensaje. Es una plantilla para invitaciones de acceso; verificación y recuperación necesitan textos adaptados a esas acciones.

**Estado:** diseño preparado; todavía no se utiliza en los envíos. El flujo actual de Firebase continúa funcionando. No se conectó un proveedor ni se utilizaron cuentas de otros proyectos. Firebase bloquea actualmente la edición de las plantillas del proyecto con `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`.

## Activación pendiente

Se necesita un remitente y un servicio de envío para esta aplicación. Puede ser un correo dedicado con SMTP o un proveedor transaccional con un dominio verificado. Un nombre de Firebase Hosting como `feria2026.web.app` no permite administrar los registros DNS del dominio `web.app`; para autenticar un remitente propio hay que usar un dominio que se controle o el remitente permitido por el proveedor.

1. Definir el servicio y la dirección remitente, con nombre visible **Feria 2026**. Guardar sus credenciales como secretos del servidor; nunca en `NEXT_PUBLIC_*`, archivos públicos o el repositorio.
2. En `lib/server/account-invitations.ts`, conservar la autorización, límites, reintentos y conservación de cuentas. Generar el enlace con Firebase Admin `generatePasswordResetLink`, usando una URL de retorno autorizada por el servidor. No devolverlo al organizador ni registrarlo en logs.
3. Sustituir `ROLE_LABEL`, `EVENT_NAME` y `RECIPIENT_EMAIL` con datos autorizados y escapados para HTML. Sustituir `ACTION_URL` por el enlace generado, escapando también su atributo. No aceptar desde el navegador una dirección de retorno o remitente arbitrarios.
4. Enviar HTML y una alternativa en texto plano con el mismo enlace. El asunto propuesto es **Tu acceso a Feria 2026**. Para permisos globales, adaptar la frase del evento a «la plataforma Feria 2026».
5. Verificar entrega y funcionamiento con un destinatario de prueba autorizado antes de activar el envío a usuarios. Comprobar dominio y DKIM/SPF cuando el proveedor los requiera. El diseño y la autenticación del remitente ayudan a la presentación y a la entrega; no garantizan que Gmail clasifique el mensaje en Recibidos.

El cambio de envío requiere integrar y probar ese proveedor. Copiar la plantilla por sí solo no modifica el correo nativo ni elimina el nombre genérico del remitente actual.

Documentación: [Firebase: generación de enlaces y envío con plantillas propias](https://firebase.google.com/docs/auth/admin/email-action-links).
