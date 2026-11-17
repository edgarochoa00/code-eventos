# Agenda y control de evaluación

En **Jueces → Asignación por proyecto** selecciona los jueces de cada proyecto. Luego, junto al proyecto, pulsa **Programar turno**: captura inicio y fin una sola vez y elige **Aplicar a todos los jueces**. Por ejemplo, si el proyecto tiene tres jueces, los tres reciben el mismo turno de 10:00 a 10:20 en una sola operación.

El formulario muestra los jueces afectados y sus horarios actuales. Al guardar reemplaza el turno de ese proyecto para todos ellos; conserva los demás proyectos y las asignaciones. Si un juez tiene un horario que se cruza, identifica al juez y el intervalo y no guarda ningún cambio del grupo. La transacción vuelve a comprobar el evento, el proyecto, sus jueces y las agendas actuales para evitar guardados parciales o sobrescribir otros turnos concurrentes. Si cambió la selección de jueces mientras editabas, pide volver a abrir el formulario para revisar la lista.

Para una excepción individual, usa **Jueces → Horarios de los jueces → Programar horario**. La lista de proyectos indica si hay un turno común, horarios distintos o turnos pendientes. Puedes volver a aplicar el turno común para unificarlo. Si agregas jueces después, vuelve a aplicar el turno para incluirlos. **Quitar turno a todos** retira únicamente el horario de ese proyecto para sus jueces actuales; sin turno no podrán enviar calificaciones.

Las horas se capturan y muestran en hora de Culiacán y se guardan en UTC. Los turnos de un mismo juez pueden ser consecutivos. El formulario rechaza intervalos incompletos, invertidos y traslapados.

El juez puede revisar sus proyectos asignados desde que aparecen en el evento. El formulario se habilita al comenzar el turno y se bloquea al llegar su fin. Firestore comprueba el turno con la hora del servidor al guardar la calificación. Un proyecto sin horario queda pendiente de programar. Los horarios guardados en versiones anteriores siguen siendo válidos. Para una calificación pendiente cuyo turno venció, el organizador puede programar otro horario. La primera calificación del evento bloquea los cambios de categoría.

Los controles de registro y recepción de archivos están en **Ajustes → Registro y entregas**. Publicar los resultados impide nuevas calificaciones y cambios de horario hasta que se oculten.

En **Estadísticas**, el organizador puede revisar el avance, las tareas en turno y las atrasadas. Se incluyen las presentaciones en vivo sin archivos y se excluyen registros pendientes, conflictos y proyectos fuera de la asignación actual.

Pruebas: `node --conditions=react-server --import tsx --test tests/judging-agenda.test.ts tests/project-judging-schedule.test.ts`. El detector nuevo permanece inactivo; los parches de activación ya requerían ajuste manual en `components/project-form.tsx` y `lib/data.ts` antes de esta mejora.

La suite de integración del turno por proyecto ejecuta la función real de guardado contra Auth y Firestore locales, con las reglas actuales. Comprueba los tres jueces, turnos consecutivos guardados simultáneamente, rechazo sin cambios parciales ante cruces, cambios de selección y permisos. No toca producción ni envía correos:

```sh
NODE_ENV=test npx -y firebase-tools@15 emulators:exec --project demo-code --only auth,firestore 'node --conditions=react-server --import tsx --test tests/project-judging-schedule.integration.test.ts'
```

Validación de la versión pública 0.4.3: compilación y lint correctos; 6 pruebas de agenda y 31 de lógica existente aprobadas. Se guardó una asignación con horario desde el navegador, se comprobó el turno y un pendiente sin archivo, y el tablero cambió a 1/1 y 100 % al recibir una evaluación de prueba mediante Firestore. Se comprobó también la tarjeta del juez con la fecha, el rango de horas y «Te toca calificar ahora». La prueba utilizó únicamente un evento, proyecto, evaluación y cuenta sintéticos, sin enviar correos.

Desde la versión 0.4.4 (6 de noviembre), el seguimiento se consulta exclusivamente en **Estadísticas**. Se comprobó en el navegador que Resumen y Jueces no contienen ese panel y que Estadísticas muestra dos proyectos asignados, uno calificado y uno sin calificar, con 50 % de avance y enlaces al proyecto. Compilación, lint y comprobación del despliegue correctos. Se retiraron los dos proyectos, evaluación, evento y cuenta temporales usados para verificarlo; no se enviaron correos.

## Máximo y selección por proyecto · 0.4.5

En **Jueces → Asignación por proyecto → Configurar jueces**, el organizador define un máximo entero positivo para ese proyecto y selecciona sus jueces. Puede dejar la selección vacía para completarla después. No hay un máximo inicial impuesto. Si baja el máximo por debajo de la selección actual, debe quitar jueces antes de guardar; no se elimina ninguno automáticamente.

La configuración se guarda en `projects/{pid}.judging` y tiene prioridad sobre las categorías y listas generales de `event.judgeAssignments`. Los proyectos aún no configurados conservan su comportamiento anterior. Agregar un juez al evento no le asigna automáticamente proyectos que ya tienen esta selección. **Horarios de los jueces** conserva los turnos existentes y permite programar los proyectos efectivamente asignados. **Estadísticas** usa esa misma selección. Quitar un juez no borra sus calificaciones históricas, que siguen formando parte de los resultados.

La transacción vuelve a leer evento y proyecto para comprobar el máximo y los jueces vigentes. Las reglas impiden excederlo, repetir o agregar correos ajenos, que el equipo modifique `judging` y que un juez no seleccionado guarde una evaluación. Los resultados publicados bloquean cambios de asignación.

Validación 0.4.5: 40 pruebas de lógica y 65 de reglas aprobadas, lint y compilación correctos. Se publicó la app y las reglas en Firebase. Comprobación HTTP de las 10 rutas y 15 recursos estáticos correcta (se usó resolución IPv4 tras un fallo transitorio de conexión). En el navegador se comprobó que dos jueces con máximo uno no se guardan, después se guardaron un proyecto con máximo uno y un juez y otro con máximo dos y dos jueces; al recargar se conservaron. Estadísticas mostró dos proyectos para el primer juez y uno para el segundo. La prueba usó exclusivamente un evento, dos proyectos y una cuenta sintéticos, sin enviar correos.
