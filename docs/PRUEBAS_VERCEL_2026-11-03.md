# Pruebas de producción · 3 de noviembre de 2026

Página: https://code-eventos.vercel.app

Versión publicada: **0.3.0**. Despliegue Vercel: `dpl_66Z7W3aTRfHRHVKfcMgqFPZqLKN7` (Ready).

La publicación anterior no incluía `/api/submission-files` y carecía de las tres variables de Supabase. Se configuraron `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_STORAGE_BUCKET` como secretos de producción y se publicó la versión local con el flujo nuevo de archivos. No se guardan sus valores en este informe.

## Resultado

**21 comprobaciones de producción aprobadas**, con las cuentas demo existentes y contenido sintético:

- Portada, acceso, panel y páginas legales: HTTP 200.
- Sesión ausente o inválida: HTTP 401.
- Cuenta ajena, suspendida y juez: subida rechazada con HTTP 403.
- Entrega de producto final cerrada: subida del integrante rechazada.
- Tamaño superior a 30 MB y rutas inválidas: HTTP 400.
- Subida real de 192 bytes y **31 457 280 bytes (30 MB)**, seguida de verificación de existencia y tamaño. El tamaño declarado incorrectamente se rechaza.
- Guardado de la entrega en Firestore y descarga como juez: tamaño, contenido y SHA-256 coinciden.
- Cuenta ajena no puede descargar; juez no puede eliminar.
- No se puede descartar un archivo ya registrado ni descargar uno sin registrar.
- Bucket privado: acceso público rechazado. CORS admite el origen de producción.
- Organizador puede preparar una subida en etapa cerrada.
- **Formulario real de Chrome:** inicio de sesión como alumno, selección de `ui-upload.txt` y guardado; archivo de 121 bytes confirmado en Firestore y descargado como juez con contenido y SHA-256 idénticos al original.

El control de Chrome agotó su tiempo de respuesta después de pulsar Guardar. La confirmación final de esa operación se hizo consultando Firestore y descargando el archivo mediante la API publicada.

También aprobaron las 20 pruebas locales de almacenamiento, ESLint y la compilación de producción con TypeScript. Se comprobó que la clave de servidor no aparece en los 20 archivos JavaScript del cliente compilado localmente.

## Limpieza

Se restauraron la entrega y la huella originales de `demo-proyecto`. Se eliminaron los tres archivos sintéticos y se verificó su ausencia en Storage. No se usaron datos reales de alumnos ni se modificaron las etapas del evento. El detector de `detector/` sigue sin conectarse a la app.
