# Archivos de entregas con Supabase

Firebase Auth mantiene la sesión y Firestore guarda eventos, proyectos, entregas y huellas. Supabase guarda los archivos; no se crean cuentas adicionales para los alumnos.

## Configuración

1. En Supabase → Storage crea el bucket `code-submissions`, **privado**, con límite de **30 MB (31 457 280 bytes)** por archivo. Permite los tipos de archivo que necesiten los equipos, incluidos APK, ZIP, PDF, presentaciones y videos.
2. Configura estas variables solo en el servidor, tanto en `.env.local` como en el alojamiento de la app:

   ```dotenv
   SUPABASE_URL=https://TU_PROYECTO.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=CLAVE_DE_SERVIDOR_EXISTENTE
   SUPABASE_STORAGE_BUCKET=code-submissions
   ```

   No uses el prefijo `NEXT_PUBLIC_` para la clave ni la incluyas en Git. El servidor admite la clave `service_role` existente de Supabase; la clave pública no sirve para este flujo.
3. Reinicia la app después de guardar las variables. No hace falta activar Firebase Storage ni integrar Supabase Auth con Firebase.
4. Mantén el bucket privado y sin políticas que den acceso público a sus objetos. La app comprueba los permisos antes de emitir una URL temporal para cada operación.

## Flujo

- El equipo elige los archivos dentro de C.O.D.E. Al guardar se calcula su SHA-256 y se solicita una URL de subida con su sesión Firebase.
- El servidor comprueba la cuenta verificada, la suspensión, el evento, el equipo y si la etapa permite entregar. Los bytes se envían directamente a Supabase para evitar el límite de cuerpo de las funciones del alojamiento.
- Antes de guardar en Firestore se comprueba que los archivos existen con el tamaño esperado. Cada archivo debe pertenecer al mismo proyecto y etapa.
- Solo integrantes, jueces del evento y organizadores o administradores pueden solicitar una descarga. Las URLs de descarga duran 60 segundos y no se guardan en Firestore.
- Quitar un archivo del formulario se aplica al guardar la entrega. Cancelar conserva los archivos ya entregados.
- Las entregas anteriores que solo guardaban huellas deben editarse para subir sus archivos. Los enlaces antiguos ya no aparecen como accesos externos.

El servidor rechaza buckets públicos o sin un límite compatible. Si Supabase está pausado, restaurándose o sin configurar, la app muestra un error y no presenta la entrega como completada.

## Comprobación

Con un evento de prueba, entrega un archivo pequeño como alumno, descárgalo como juez y comprueba que una cuenta ajena no tiene acceso. Prueba también una etapa cerrada, un archivo mayor de 30 MB y la edición de una entrega. No uses contenido real de alumnos para las pruebas.

`npm run dev:emulators` no permite conectar cuentas simuladas a Supabase remoto. Para pruebas aisladas usa Supabase local con una URL de localhost; los emuladores de Firebase no simulan Supabase Storage.

La configuración local no añade automáticamente las variables a Vercel ni publica los cambios.

## Logo opcional de la marca

Después de completar su formulario inicial, el líder puede usar **Agregar logo** en la cabecera de su proyecto. Puede previsualizarlo, guardarlo, reemplazarlo o quitarlo. El logo se presenta como sticker en la cabecera y en la tarjeta del alumno. Los demás integrantes, jueces y organizadores pueden verlo con los mismos permisos del proyecto.

Se aceptan PNG, JPG y WebP de hasta **2 MB**, sin animación y con hasta 16 megapíxeles. El servidor decodifica la imagen, aplica su orientación, elimina sus metadatos y guarda una versión WebP de hasta 512 × 512 píxeles, conservando la transparencia. No elimina fondos: para un sticker con forma propia, el alumno debe subir un logo con fondo transparente.

Usa el mismo bucket privado y las mismas variables de las entregas; permite también `image/webp` si configuraste una lista de tipos MIME en el bucket. La ruta es `events/{evento}/projects/{proyecto}/logo/{uuid}.webp`. Firestore solo guarda `logo: { path, storage: "supabase" }`, sin URL pública. La imagen se consulta mediante `/api/project-logo` con sesión Firebase y respuesta sin caché.

Solo el líder puede modificar el logo mientras las inscripciones o alguna entrega estén abiertas, con el registro completo y sin resultados publicados. Las reglas y el servidor comprueban estos permisos. Una sustitución guarda primero la imagen nueva y su referencia; después limpia la anterior. Quitar el logo también limpia el archivo, y eliminar el proyecto incluye la limpieza de su logo. Un error de limpieza posterior al guardado se registra en el servidor sin deshacer el cambio ya confirmado.
