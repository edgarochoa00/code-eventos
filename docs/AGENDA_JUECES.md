# Agenda y control de evaluación

Desde 0.4.6, `scheduleInputValue` y `scheduleInputToIso` usan `JUDGING_TIME_ZONE` tanto al editar como al mostrar turnos; el formulario no mantiene un desplazamiento UTC separado. La tarjeta del juez usa los mismos totales de `judgeProgress` que su agenda.

En Evento → Jueces → Agenda por juez → Asignación y horario se programan fecha, inicio y fin de cada proyecto para ese juez. Las horas se capturan y muestran en hora de Culiacán y se guardan como instantes UTC en `judgeAssignments[correo].schedule[projectId]`. No se permiten intervalos incompletos, invertidos o superpuestos para un mismo juez dentro del evento. Los horarios anteriores se conservan al editar; al retirar proyectos de una asignación se retiran sus turnos.

El juez ve su horario en las tarjetas y al abrir el proyecto. Sus pendientes se ordenan por fecha; se destaca el turno actual y el vencido. El horario es de organización: el permiso para guardar notas sigue dependiendo de la apertura de evaluación, la asignación y la publicación de resultados.

La pestaña independiente **Estadísticas** muestra el control del organizador (también disponible para administradores al abrir el evento): calificadas, pendientes, en turno, atrasadas y porcentaje por juez. Jueces se reserva para gestionar roles, accesos, asignaciones y horarios. Cada fila de Estadísticas indica cuántos proyectos tiene asignados el juez y permite abrir cada proyecto. Los filtros permiten localizar jueces con pendientes, completados y atrasados; desplegar cada juez muestra proyectos y etapas. Los datos se actualizan con las suscripciones existentes de Firestore y el reloj se refresca cada 30 segundos.

Cada tarea es un proyecto válido asignado y una etapa habilitada. Se incluyen presentaciones en vivo sin archivos. Se excluyen altas de equipos pendientes, conflictos de equipo y notas de proyectos o etapas ajenas a la asignación actual. Una nota duplicada no incrementa el avance. Un juez sin tareas no se marca como completado. Los eventos sin horarios siguen funcionando y muestran «Sin horario asignado».

Pruebas: `node --conditions=react-server --import tsx --test tests/judging-agenda.test.ts`. El detector nuevo permanece inactivo; los parches de activación ya requerían ajuste manual en `components/project-form.tsx` y `lib/data.ts` antes de esta mejora.

Validación de la versión pública 0.4.3: compilación y lint correctos; 6 pruebas de agenda y 31 de lógica existente aprobadas. Se guardó una asignación con horario desde el navegador, se comprobó el turno y un pendiente sin archivo, y el tablero cambió a 1/1 y 100 % al recibir una evaluación de prueba mediante Firestore. Se comprobó también la tarjeta del juez con la fecha, el rango de horas y «Te toca calificar ahora». La prueba utilizó únicamente un evento, proyecto, evaluación y cuenta sintéticos, sin enviar correos.

Desde la versión 0.4.4 (6 de noviembre), el seguimiento se consulta exclusivamente en **Estadísticas**. Se comprobó en el navegador que Resumen y Jueces no contienen ese panel y que Estadísticas muestra dos proyectos asignados, uno calificado y uno sin calificar, con 50 % de avance y enlaces al proyecto. Compilación, lint y comprobación del despliegue correctos. Se retiraron los dos proyectos, evaluación, evento y cuenta temporales usados para verificarlo; no se enviaron correos.

## Máximo y selección por proyecto · 0.4.5

En **Jueces → Asignación por proyecto → Configurar jueces**, el organizador define un máximo entero positivo para ese proyecto y selecciona sus jueces. Puede dejar la selección vacía para completarla después. No hay un máximo inicial impuesto. Si baja el máximo por debajo de la selección actual, debe quitar jueces antes de guardar; no se elimina ninguno automáticamente.

La configuración se guarda en `projects/{pid}.judging` y tiene prioridad sobre las categorías y listas generales de `event.judgeAssignments`. Los proyectos aún no configurados conservan su comportamiento anterior. Agregar un juez al evento no le asigna automáticamente proyectos que ya tienen esta selección. **Agenda por juez** conserva los turnos existentes y permite programar los proyectos efectivamente asignados. **Estadísticas** usa esa misma selección. Quitar un juez no borra sus calificaciones históricas, que siguen formando parte de los resultados.

La transacción vuelve a leer evento y proyecto para comprobar el máximo y los jueces vigentes. Las reglas impiden excederlo, repetir o agregar correos ajenos, que el equipo modifique `judging` y que un juez no seleccionado guarde una evaluación. Los resultados publicados bloquean cambios de asignación.

Validación 0.4.5: 40 pruebas de lógica y 65 de reglas aprobadas, lint y compilación correctos. Se publicó la app y las reglas en Firebase. Comprobación HTTP de las 10 rutas y 15 recursos estáticos correcta (se usó resolución IPv4 tras un fallo transitorio de conexión). En el navegador se comprobó que dos jueces con máximo uno no se guardan, después se guardaron un proyecto con máximo uno y un juez y otro con máximo dos y dos jueces; al recargar se conservaron. Estadísticas mostró dos proyectos para el primer juez y uno para el segundo. La prueba usó exclusivamente un evento, dos proyectos y una cuenta sintéticos, sin enviar correos.
