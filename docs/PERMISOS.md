# Separación de responsabilidades

Cada cuenta tiene un solo rol efectivo dentro de un evento. Admin y superadmin administran todos los eventos: no pueden usar su cuenta para competir o calificar, incluso si un permiso anterior los dejó en un equipo o una lista de jueces. El permiso global «Organizador» permite crear eventos y no impide participar o ser juez en otros eventos que esa persona no administra.

En un evento, organizar y juzgar son incompatibles. Los integrantes activos de equipos tampoco pueden añadirse a esas listas. Para cambiar de rol se retira primero el rol anterior. Los conflictos antiguos se conservan para que se corrijan expresamente: administrar tiene prioridad; quien siga en un equipo no puede calificar. No se borran calificaciones históricas automáticamente.

Los jueces pueden consultar los proyectos del evento y sus propias calificaciones, pero solo pueden guardar evaluaciones para los proyectos o categorías asignados. Una asignación ausente o con ambas listas vacías significa «todos». La evaluación debe estar abierta, la etapa habilitada y los resultados sin publicar. Se conserva la posibilidad de evaluar una presentación en vivo sin archivo entregado.

Publicar resultados congela las calificaciones y las modificaciones de los equipos, aunque haya quedado algún interruptor de registro o entregas abierto. Primero se ocultan los resultados para volver a editar. El organizador no reemplaza las descripciones ni los archivos del equipo. El administrador y el organizador dan de alta únicamente el correo del líder; el alumno completa su proyecto y registra a sus integrantes al entrar. El servicio mantiene la reserva en el registro privado. Véase [Alta de alumnos líderes](ALTAS_EQUIPOS.md).

## Registro privado y operaciones atómicas

`events/{id}/access/participants` contiene un mapa de correos activos (`members`) y el identificador del último proyecto sincronizado (`projectId`). Solo la administración del evento puede leerlo. Los equipos no necesitan leerlo: actualizan sus propias claves junto con su proyecto en una transacción.

Las reglas comprueban el estado final con `getAfter`. Registrar un proyecto, cambiar su lista de integrantes o eliminarlo sin sincronizar el registro falla, incluso desde el SDK o la API. Tampoco se puede borrar o vaciar el registro para eludir una incompatibilidad. Se impide que un correo pertenezca a varios equipos del mismo evento, sin depender de consultas que los alumnos no tienen permiso para ejecutar. La comprobación mantiene un número fijo de lecturas de documentos, también para equipos de 15 personas.

La actualización inicial de un evento antiguo es exclusiva del superadmin. Después, ni el superadmin puede reemplazar el registro por un mapa arbitrario desde el cliente. La eliminación de un evento debe vaciar primero sus proyectos y retirar el registro junto con el evento; los errores de limpieza ya no se ignoran.

## Puesta en marcha

1. Validar con `npm run typecheck`, `npm run lint`, `npm run test:storage`, `npm run test:use-cases` y `npm run test:rules`.
2. Publicar juntos el código actualizado y `firestore.rules` (`npm run deploy:rules`). Durante la transición las versiones antiguas de la app no podrán crear o cambiar equipos: no actualizan el registro privado.
3. Entrar con la cuenta superadmin, abrir cada evento existente y pulsar **Actualizar permisos del evento**. Los eventos nuevos ya están preparados. La actualización no altera los proyectos, entregas, listas de roles ni resultados.
4. Si existían roles mezclados, retirar la lista incompatible desde «Jueces» o Administración. Una cuenta que organiza no califica. Si un integrante quedó como juez, retirar el permiso de juez para que pueda seguir trabajando con su equipo.

Si un evento antiguo tiene el mismo correo en varios equipos, la actualización lo indica y no cambia datos. Es necesario resolver esa inconsistencia mediante una corrección administrativa de datos antes de repetirla. Los cambios manuales o scripts con credenciales privilegiadas deben mantener el registro sincronizado; esas credenciales omiten las reglas de clientes.

Las pruebas usan el proyecto simulado `demo-code`; no escriben en `code-94fbe`. El detector de `detector/` permanece inactivo. Los parches de activación deben revisarse de nuevo porque cambian archivos que esos parches modifican.
