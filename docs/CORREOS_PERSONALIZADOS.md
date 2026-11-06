# Correo de acceso con identidad de Feria 2026

La plantilla preparada está en `emails/acceso.html`. Incluye el escudo, el nombre de la feria, el rol, el evento, la cuenta destinataria y un botón que contiene el enlace seguro de Firebase. El enlace completo no ocupa el cuerpo visible del mensaje. Es una plantilla para invitaciones de acceso; verificación y recuperación necesitan textos adaptados a esas acciones.

**Estado:** integración con Brevo activa en servidor (`FERIA_MAIL_PROVIDER=brevo`, remitente verificado **Feria 2026 / `feria2026.culiacan@outlook.com`**) y probada tanto con transporte simulado (`tests/access-email.test.ts`) como con envío real al buzón de la marca. Si `FERIA_MAIL_PROVIDER` se cambia a `firebase`, continúa el envío nativo de Firebase. Firebase bloquea actualmente la edición de sus plantillas en este proyecto con `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`.

## Configuración activa

Se utiliza la cuenta de Brevo con el remitente dedicado y verificado **Feria 2026 (`feria2026.culiacan@outlook.com`)**. Un nombre de Firebase Hosting como `feria2026.web.app` no permite administrar los registros DNS del dominio `web.app`; para autenticar un dominio propio hay que usar uno que se controle o el remitente verificado en el proveedor.

1. Definir el servicio y la dirección remitente, con nombre visible **Feria 2026**. Guardar sus credenciales como secretos del servidor; nunca en `NEXT_PUBLIC_*`, archivos públicos o el repositorio.
2. El servicio `lib/server/access-email.ts` renderiza la plantilla y envía por la API transaccional de Brevo. `lib/server/account-invitations.ts` conserva autorización, límites y cuentas existentes, genera el enlace con Firebase Admin `generatePasswordResetLink` y no lo devuelve al organizador ni lo registra en logs.
3. Sustituir `ROLE_LABEL`, `EVENT_NAME` y `RECIPIENT_EMAIL` con datos autorizados y escapados para HTML. Sustituir `ACTION_URL` por el enlace generado, escapando también su atributo. No aceptar desde el navegador una dirección de retorno o remitente arbitrarios.
4. Enviar HTML y una alternativa en texto plano con el mismo enlace. El asunto propuesto es **Tu acceso a Feria 2026**. Para permisos globales, adaptar la frase del evento a «la plataforma Feria 2026».
5. Configurar `FERIA_MAIL_PROVIDER=brevo`, `FERIA_MAIL_FROM` y el secreto de servidor `FERIA_BREVO_API_KEY` solo tras verificar el remitente. Verificar entrega y funcionamiento con un destinatario de prueba autorizado. Comprobar dominio y DKIM/SPF cuando el proveedor los requiera. El diseño y la autenticación del remitente ayudan a la presentación y a la entrega; no garantizan que Gmail clasifique el mensaje en Recibidos.

El transporte usa el nombre visible **Feria 2026**, HTML y texto plano; no agrega contactos a listas ni envía campañas. Los emuladores ignoran las credenciales reales y conservan el transporte local de Firebase. Un rechazo o una respuesta perdida de Brevo no causa un segundo envío automático por Firebase. La clave de la cuenta se usa únicamente en el servidor, sin incluirla en respuestas ni cuerpos de los mensajes. La contraseña de Outlook nunca se guarda en la aplicación.

Las verificaciones de correo y la recuperación solicitadas desde el inicio de sesión conservan su envío nativo de Firebase; este cambio corresponde a accesos asignados a jueces, organizadores y administradores.

Documentación: [Firebase: generación de enlaces y envío con plantillas propias](https://firebase.google.com/docs/auth/admin/email-action-links).
