/**
 * Datos del servicio para los documentos legales y el historial de versiones.
 * La versión de cada documento es independiente de la versión de la app.
 */

export const LEGAL_VERSION = "2026-11-05.1";
export const LEGAL_UPDATED_LABEL = "5 de noviembre de 2026";

export const SERVICE_CONTACT = {
  name: "Edgar Ochoa",
  address: "Juan de Dios Bátiz 310 Poniente, colonia Guadalupe, C.P. 80220, Culiacán, Sinaloa, México.",
};

export const LEGAL_LINKS = [
  { href: "/terminos", label: "Términos" },
  { href: "/privacidad", label: "Privacidad" },
  { href: "/cookies", label: "Cookies y almacenamiento" },
  { href: "/versiones", label: "Versiones" },
] as const;

export type Release = { version: string; date: string; title: string; changes: string[] };

/** La primera entrada es la versión actual (debe coincidir con package.json). */
export const RELEASES: Release[] = [
  { version: "0.4.22", date: "24 de noviembre de 2026", title: "Croquis de stands y proyectos por evaluador", changes: [
    "El croquis de stands se puede consultar y ampliar desde la portada y el evento.",
    "El organizador puede consultar los proyectos asignados a cada evaluador desde su lista.",
  ] },
  { version: "0.4.21", date: "20 de noviembre de 2026", title: "Recuperación del acceso por invitación", changes: [
    "La pantalla de acceso distingue un enlace incompleto de un código que ya no es válido.",
    "El correo incluye un código que se puede pegar para completar el registro si el enlace llega incompleto.",
  ] },
  { version: "0.4.20", date: "20 de noviembre de 2026", title: "Filtro de registro de evaluadores", changes: [
    "El organizador puede filtrar evaluadores registrados y pendientes según la verificación de su correo.",
    "La lista de evaluadores se puede plegar y recorrer dentro del panel.",
  ] },
  { version: "0.4.19", date: "20 de noviembre de 2026", title: "Asesores y edición de equipos", changes: [
    "El líder puede incluir asesores al registrar el proyecto.",
    "El organizador puede editar los integrantes y asesores de proyectos existentes.",
    "Los alumnos consultan su proyecto y sus entregas. Los resultados se consultan en el panel de organización.",
  ] },
  { version: "0.4.18", date: "19 de noviembre de 2026", title: "Ajuste del selector de categoría", changes: [
    "El diálogo abre con la categoría actual seleccionada y acomoda los botones en pantallas estrechas.",
  ] },
  { version: "0.4.17", date: "19 de noviembre de 2026", title: "Corrección de categorías de proyectos", changes: [
    "Los organizadores pueden corregir la categoría de un proyecto cuyo registro esté completo desde Información, antes de iniciar la evaluación.",
  ] },
  { version: "0.4.16", date: "16 de noviembre de 2026", title: "Mejoras en pantallas estrechas", changes: [
    "El encabezado y las pestañas principales se adaptan a celulares y tabletas.",
    "Los horarios y las calificaciones disponen de más espacio para leer y usar sus controles.",
  ] },
  { version: "0.4.15", date: "16 de noviembre de 2026", title: "Calificación por turnos", changes: [
    "Cada evaluador puede enviar su calificación únicamente durante el turno programado para ese proyecto.",
    "Registro y recepción de entregas se administran desde Ajustes. Los turnos se programan desde Evaluadores.",
  ] },
  { version: "0.4.14", date: "14 de noviembre de 2026", title: "Asignación de stands", changes: [
    "Los organizadores del evento pueden asignar, cambiar o retirar el stand de cada proyecto.",
    "Los alumnos y evaluadores pueden consultar la ubicación asignada.",
  ] },
  { version: "0.4.13", date: "13 de noviembre de 2026", title: "Comentario obligatorio, horarios de evaluadores y baja completa desde Administración", changes: [
    "El evaluador debe escribir un comentario para el equipo antes de enviar su calificación.",
    "«Horarios de los evaluadores» solo programa el horario de los proyectos que cada evaluador ya tiene asignados. La asignación se hace en «Asignación por proyecto».",
    "El superadministrador puede revisar los vínculos de cualquier cuenta en Firebase y Authentication y eliminarla por completo desde Administración.",
  ] },
  { version: "0.4.12", date: "13 de noviembre de 2026", title: "Bajas de alumnos y evaluaciones definitivas", changes: [
    "Al retirar un proyecto se elimina el perfil y el acceso de los alumnos que no participan ni tienen permisos en otros eventos, para permitir un nuevo registro.",
    "Los evaluadores empiezan sin proyectos asignados y la organización puede filtrar por categoría al asignarlos.",
    "Las calificaciones comienzan en cero y requieren confirmar un único envío por proyecto y etapa. Una evaluación enviada no se puede modificar.",
  ] },
  { version: "0.4.11", date: "10 de noviembre de 2026", title: "Originalidad exclusiva para organización y administración", changes: [
    "El análisis de originalidad y las coincidencias solo se muestran a organizadores y administradores.",
    "Corrección al actualizar o guardar calificaciones de evaluadores cuando cambian el orden de campos en la rúbrica.",
  ] },
  { version: "0.4.10", date: "10 de noviembre de 2026", title: "Invitaciones por correo para alumnos", changes: [
    "El líder recibe un enlace para configurar su cuenta y completar el formulario del proyecto.",
    "Cada integrante agregado por el líder recibe su propio enlace para entrar al equipo.",
  ] },
  { version: "0.4.9", date: "10 de noviembre de 2026", title: "Nombre obligatorio al configurar el acceso", changes: [
    "Las invitaciones requieren el nombre completo antes de guardar la contraseña.",
  ] },
  { version: "0.4.8", date: "10 de noviembre de 2026", title: "Nombre y perfil de cuenta", changes: [
    "Las personas invitadas pueden escribir su nombre al configurar el acceso.",
    "Desde el avatar se puede editar el nombre y consultar el correo, su verificación y el permiso general de la cuenta.",
  ] },
  { version: "0.4.7", date: "8 de noviembre de 2026", title: "Configuración de acceso en Feria 2026", changes: [
    "Las nuevas invitaciones abren una pantalla de Feria 2026 para elegir y confirmar la contraseña.",
    "La pantalla confirma cuándo se guardó la contraseña y explica cómo proceder si el enlace ya no es válido.",
  ] },
  { version: "0.4.6", date: "6 de noviembre de 2026", title: "Estabilidad de Administración y agenda unificada", changes: [
    "El formulario de alta de alumnos conserva sus datos y muestra un aviso si desaparece el evento seleccionado.",
    "Sesión estable de autenticación, avance de evaluadores calculado una sola vez y eliminación de controles vacíos.",
    "Edición y visualización de turnos usan la misma zona horaria de Culiacán.",
  ] },
  { version: "0.4.5", date: "6 de noviembre de 2026", title: "Evaluadores elegidos por proyecto", changes: [
    "El organizador define el máximo de evaluadores de cada proyecto y elige quiénes lo califican.",
    "La selección por proyecto se refleja en la agenda y las estadísticas y se comprueba al guardar calificaciones.",
  ] },
  { version: "0.4.4", date: "6 de noviembre de 2026", title: "Estadísticas en su propia sección", changes: [
    "Estadísticas de evaluadores en una pestaña independiente: proyectos asignados, calificados y pendientes.",
    "La gestión de evaluadores, accesos y horarios queda separada del seguimiento de evaluaciones.",
  ] },
  { version: "0.4.3", date: "5 de noviembre de 2026", title: "Agenda y control de evaluadores", changes: [
    "Horarios por evaluador y proyecto con fecha, inicio y fin en hora de Culiacán.",
    "Control en tiempo real de evaluaciones completadas, pendientes, en turno y atrasadas.",
    "Las presentaciones en vivo sin archivos también cuentan como tareas de evaluación.",
  ] },
  {
    version: "0.4.2",
    date: "5 de noviembre de 2026",
    title: "Acceso por correo para evaluadores y organizadores",
    changes: [
      "Asignar un rol de evaluador, organizador o administrador envía un correo para establecer la contraseña y crea la cuenta si hace falta.",
      "Las cuentas existentes conservan sus datos y su contraseña hasta que la persona decide cambiarla.",
      "Botón para reenviar el acceso y mensajes que distinguen el permiso guardado de un fallo del correo.",
    ],
  },
  {
    version: "0.4.1",
    date: "5 de noviembre de 2026",
    title: "Feria 2026",
    changes: [
      "Nombre de la plataforma corregido a Feria 2026 y nueva dirección feria2026.web.app.",
      "Corrección de la caché que dejaba la pantalla en Cargando al entrar desde otro navegador.",
    ],
  },
  {
    version: "0.4.0",
    date: "4 de noviembre de 2026",
    title: "Roles separados por evento",
    changes: [
      "Administradores y organizadores no califican ni compiten en los eventos que administran.",
      "Las asignaciones de evaluadores y los conflictos con integrantes se comprueban también en las reglas de seguridad.",
      "Publicar resultados bloquea cambios en calificaciones, proyectos y entregas.",
      "Actualización de permisos para eventos existentes que conserva sus proyectos y calificaciones.",
    ],
  },
  {
    version: "0.3.0",
    date: "3 de noviembre de 2026",
    title: "Entregas con archivos privados",
    changes: [
      "Subida directa de archivos de hasta 30 MB a Supabase Storage, con las cuentas actuales de Firebase.",
      "Descarga con permisos del proyecto y accesos temporales; las entregas nuevas ya no aceptan enlaces externos.",
      "Aviso de privacidad y documentación actualizados para describir el almacenamiento de archivos.",
    ],
  },
  {
    version: "0.2.0",
    date: "20 de octubre de 2026",
    title: "Información del servicio y portada renovada",
    changes: [
      "Términos y condiciones, aviso de privacidad, cookies y almacenamiento, y esta página de versiones.",
      "Privacidad de mi cuenta: documentos vigentes, controles de este navegador y contacto para solicitudes.",
      "Enlaces a la información del servicio en la portada, el acceso y el panel.",
      "La portada usa ejemplos genéricos y muestra cómo se sigue el día del evento.",
    ],
  },
  {
    version: "0.1.0",
    date: "20 de octubre de 2026",
    title: "Primera versión",
    changes: [
      "Eventos con prototipo, producto final o ambos, y registro de equipos con un código de 6 letras.",
      "Entregas con descripción y enlaces; de los archivos se guarda su huella digital.",
      "Rúbrica con pesos y calificación de 0 a 10 por criterio desde el celular, con total ponderado automático.",
      "Publicación de resultados con lugar, puntaje por criterio y comentarios sin el nombre del evaluador.",
      "Panel distinto para alumnos, evaluadores, organizadores y administradores; el código del evento solo lo ven los organizadores.",
      "Administración de permisos y cuentas suspendidas, y asignación de evaluadores y organizadores en cualquier evento.",
      "Revisión de originalidad: el organizador decide cuándo la ven evaluadores y equipos.",
      "Modo claro y oscuro que recuerda tu elección.",
    ],
  },
];

export const PRODUCT_VERSION = RELEASES[0].version;
