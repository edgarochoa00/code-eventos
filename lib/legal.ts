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
  { version: "0.4.13", date: "13 de noviembre de 2026", title: "Comentario obligatorio, horarios de jueces y baja completa desde Administración", changes: [
    "El juez debe escribir un comentario para el equipo antes de enviar su calificación.",
    "«Horarios de los jueces» solo programa el horario de los proyectos que cada juez ya tiene asignados. La asignación se hace en «Asignación por proyecto».",
    "El superadministrador puede revisar los vínculos de cualquier cuenta en Firebase y Authentication y eliminarla por completo desde Administración.",
  ] },
  { version: "0.4.12", date: "13 de noviembre de 2026", title: "Bajas de alumnos y evaluaciones definitivas", changes: [
    "Al retirar un proyecto se elimina el perfil y el acceso de los alumnos que no participan ni tienen permisos en otros eventos, para permitir un nuevo registro.",
    "Los jueces empiezan sin proyectos asignados y la organización puede filtrar por categoría al asignarlos.",
    "Las calificaciones comienzan en cero y requieren confirmar un único envío por proyecto y etapa. Una evaluación enviada no se puede modificar.",
  ] },
  { version: "0.4.11", date: "10 de noviembre de 2026", title: "Originalidad exclusiva para organización y administración", changes: [
    "El análisis de originalidad y las coincidencias solo se muestran a organizadores y administradores.",
    "Corrección al actualizar o guardar calificaciones de jueces cuando cambian el orden de campos en la rúbrica.",
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
    "Sesión estable de autenticación, avance de jueces calculado una sola vez y eliminación de controles vacíos.",
    "Edición y visualización de turnos usan la misma zona horaria de Culiacán.",
  ] },
  { version: "0.4.5", date: "6 de noviembre de 2026", title: "Jueces elegidos por proyecto", changes: [
    "El organizador define el máximo de jueces de cada proyecto y elige quiénes lo califican.",
    "La selección por proyecto se refleja en la agenda y las estadísticas y se comprueba al guardar calificaciones.",
  ] },
  { version: "0.4.4", date: "6 de noviembre de 2026", title: "Estadísticas en su propia sección", changes: [
    "Estadísticas de jueces en una pestaña independiente: proyectos asignados, calificados y pendientes.",
    "La gestión de jueces, accesos y horarios queda separada del seguimiento de evaluaciones.",
  ] },
  { version: "0.4.3", date: "5 de noviembre de 2026", title: "Agenda y control de jueces", changes: [
    "Horarios por juez y proyecto con fecha, inicio y fin en hora de Culiacán.",
    "Control en tiempo real de evaluaciones completadas, pendientes, en turno y atrasadas.",
    "Las presentaciones en vivo sin archivos también cuentan como tareas de evaluación.",
  ] },
  {
    version: "0.4.2",
    date: "5 de noviembre de 2026",
    title: "Acceso por correo para jueces y organizadores",
    changes: [
      "Asignar un rol de juez, organizador o administrador envía un correo para establecer la contraseña y crea la cuenta si hace falta.",
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
      "Las asignaciones de jueces y los conflictos con integrantes se comprueban también en las reglas de seguridad.",
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
      "Publicación de resultados con lugar, puntaje por criterio y comentarios sin el nombre del juez.",
      "Panel distinto para alumnos, jueces, organizadores y administradores; el código del evento solo lo ven los organizadores.",
      "Administración de permisos y cuentas suspendidas, y asignación de jueces y organizadores en cualquier evento.",
      "Revisión de originalidad: el organizador decide cuándo la ven jueces y equipos.",
      "Modo claro y oscuro que recuerda tu elección.",
    ],
  },
];

export const PRODUCT_VERSION = RELEASES[0].version;
