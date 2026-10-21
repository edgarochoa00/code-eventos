/**
 * Datos del servicio para los documentos legales y el historial de versiones.
 * La versión de cada documento es independiente de la versión de la app.
 */

export const LEGAL_VERSION = "2026-10-20.1";
export const LEGAL_UPDATED_LABEL = "20 de octubre de 2026";

export const SERVICE_CONTACT = {
  name: "Edgar Ochoa",
  address: "Juan de Dios Bátiz 310 Poniente, colonia Guadalupe, C.P. 80220, Culiacán, Sinaloa, México.",
  email: "edgarochoa0173@gmail.com",
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
