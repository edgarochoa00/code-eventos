/**
 * Textos de Términos, Aviso de privacidad y Cookies de C.O.D.E.
 * Describen lo que la app hace hoy (revisado en el código, las reglas de Firestore y el navegador).
 * Si cambia el tratamiento de datos, actualiza el texto y sube LEGAL_VERSION en lib/legal.ts.
 */
import { SERVICE_CONTACT } from "./legal";

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  links?: { href: string; label: string }[];
};

export type LegalDocument = {
  title: string;
  intro: string;
  /** Documento técnico: muestra "Información técnica" en lugar de "Versión del documento" */
  technical?: boolean;
  sections: LegalSection[];
};

const { name, address, email } = SERVICE_CONTACT;
const mail = { href: `mailto:${email}`, label: email };

const operator = [
  `${name} opera C.O.D.E y es responsable del tratamiento de datos personales descrito en el aviso de privacidad. Domicilio señalado por el responsable: ${address}`,
  "El domicilio corresponde a la ubicación del Instituto Tecnológico de Culiacán, indicada por el operador para estos documentos. Esta referencia no atribuye al instituto la operación, el respaldo ni la responsabilidad sobre C.O.D.E. Cada evento pertenece a quien lo organiza, y la atención del servicio se realiza por el correo indicado, no mediante los canales institucionales del instituto.",
];

export type LegalDocumentKey = "terminos" | "privacidad" | "cookies";

export const LEGAL_DOCUMENTS: Record<LegalDocumentKey, LegalDocument> = {
  terminos: {
    title: "Términos y condiciones",
    intro: "Condiciones de uso de C.O.D.E para organizar y evaluar eventos de proyectos escolares en México.",
    sections: [
      {
        id: "operador",
        title: "Operador y contacto",
        paragraphs: [...operator, `Para soporte, consultas sobre estas condiciones o solicitudes de cierre de cuenta, escribe a ${email}.`],
        links: [mail],
      },
      {
        id: "servicio",
        title: "Uso de C.O.D.E",
        paragraphs: [
          "C.O.D.E permite crear eventos de proyectos, registrar equipos, recibir entregas de prototipo y producto final, calificar con una rúbrica y publicar resultados. Las calificaciones y decisiones de cada evento son responsabilidad de sus organizadores y jueces; C.O.D.E no las emite ni las valida.",
          "El servicio se dirige a estudiantes, docentes, jueces y organizadores de eventos académicos en México. Si un evento registra a menores de edad, la institución u organización que lo organiza es responsable de contar con las autorizaciones que correspondan.",
        ],
      },
      {
        id: "cuentas",
        title: "Cuentas, permisos y acceso",
        paragraphs: [
          "Puedes entrar con Google o con correo y contraseña. Los permisos dependen de un correo verificado: utiliza tu propia cuenta, protege tu acceso y cierra sesión al terminar en dispositivos compartidos.",
          "El superadministrador asigna los permisos de la plataforma (administrador, organizador o cuenta suspendida) y cada organizador decide quién es juez u organizador de su evento. Iniciar sesión no te hace parte de un evento ni te da acceso a sus proyectos: para participar necesitas el código del evento, que un organizador te agregue o que tu equipo te registre como integrante.",
          "Se puede suspender una cuenta que ponga en riesgo la seguridad del servicio, se haga pasar por otra persona o incumpla estas condiciones. La suspensión impide usar la app, pero no borra por sí sola la información guardada.",
        ],
      },
      {
        id: "contenido",
        title: "Proyectos, entregas y contenido",
        paragraphs: [
          "Registra únicamente contenido que tengas derecho a compartir: textos, enlaces y archivos de tu equipo o con permiso de sus autores. Respeta la propiedad intelectual, la confidencialidad y las reglas de tu institución, y menciona en tu proyecto las plantillas, librerías o trabajos previos que reutilices.",
          "Conservas los derechos que te correspondan sobre tu proyecto y permites su procesamiento en la medida necesaria para guardarlo, mostrarlo a quienes tienen permiso y prestar las funciones del evento. C.O.D.E no adquiere la propiedad de los proyectos.",
          "No incluyas datos personales de personas ajenas al proyecto, información sensible ni contenido ilegal, ofensivo o que vulnere derechos de terceros.",
        ],
      },
      {
        id: "evaluacion",
        title: "Evaluación, resultados y originalidad",
        paragraphs: [
          "Los jueces califican de 0 a 10 por criterio y el total ponderado se calcula automáticamente. El organizador decide cuándo publicar resultados; al hacerlo, cada equipo ve su lugar, su puntaje por criterio y los comentarios de los jueces, sin el nombre de quien los escribió.",
          "Para apoyar a organizadores y jueces, el servicio compara cada proyecto con los registrados antes y muestra coincidencias de texto, enlaces o archivos. Es una señal para revisar, no una conclusión: una coincidencia no implica por sí misma una copia, y las decisiones las toman las personas responsables del evento.",
        ],
      },
      {
        id: "continuidad",
        title: "Disponibilidad, costo y cierre",
        paragraphs: [
          "El servicio puede tener interrupciones, mantenimiento o cambios de funciones. No se garantiza disponibilidad ininterrumpida ni la recuperación de cualquier contenido; conserva copias de tus archivos y enlaces importantes.",
          "Esta versión no incluye cobros por usar C.O.D.E. Cualquier modalidad de pago futura deberá informar sus condiciones y requerir una contratación separada; no se aplicará una suscripción por silencio.",
          `Puedes solicitar el cierre de tu cuenta a ${email}. La atención es manual y requiere verificar tu identidad; no hay un botón de eliminación automática. Antes del cierre se revisan los eventos que organizas, los proyectos que compartes con tu equipo y las obligaciones legales aplicables.`,
        ],
        links: [mail],
      },
      {
        id: "ediciones",
        title: "Versiones, responsabilidad y consultas",
        paragraphs: [
          "La fecha y versión de este documento son independientes de la versión de la app. Los cambios se publicarán en esta página y se señalarán en Versiones. Cuando un cambio requiera una nueva aceptación, se habilitará el mecanismo correspondiente antes de aplicarlo.",
          "Cada persona decide qué contenido incorpora y cómo utiliza la herramienta. El operador mantiene las obligaciones que le correspondan respecto del servicio y de la protección de datos; estas condiciones no excluyen responsabilidades ni derechos que la ley no permita limitar.",
          "Las consultas o controversias pueden comunicarse primero al contacto del operador, sin impedir acudir a las autoridades competentes. Se consideran las disposiciones mexicanas aplicables y los derechos que correspondan a cada persona. Actualmente no se registra una aceptación contractual por cuenta; la autorización de identidad que muestra Google no representa la aceptación de estas condiciones.",
        ],
      },
    ],
  },

  privacidad: {
    title: "Aviso de privacidad integral",
    intro: "Quién trata tu información, para qué se utiliza y cómo ejercer tus derechos en C.O.D.E.",
    sections: [
      {
        id: "responsable",
        title: "Responsable y contacto de privacidad",
        paragraphs: [...operator, `El responsable atiende consultas y solicitudes de privacidad en ${email}.`],
        links: [mail],
      },
      {
        id: "datos",
        title: "Información que utiliza el servicio",
        paragraphs: [
          "La cuenta utiliza identificador de usuario, correo, nombre, estado de verificación y, si entras con Google, la imagen de perfil cuando está disponible. Firebase Authentication gestiona las contraseñas: C.O.D.E no recibe tu contraseña de Google ni pide permisos para leer Gmail, Drive o Calendar. También se registra la fecha de tu último acceso y, si te lo asignan, tu permiso en la plataforma.",
          "De cada evento se guardan nombre, descripción, institución, fechas, código, rúbrica, etapas, resultados publicados y los correos de sus organizadores y jueces. De cada proyecto se guardan título, resumen, problema, solución, tecnologías, categoría, nombre y correo de sus integrantes y las entregas: descripción, enlaces, archivos y el correo de quien entregó.",
          "De los archivos se guardan nombre, tamaño, tipo y su huella SHA-256; en esta versión los archivos no se suben a la nube, por eso se comparten mediante enlaces. De las evaluaciones se guardan el nombre y correo del juez, las calificaciones por criterio, el total y el comentario.",
          "Para la revisión de originalidad se calcula una huella de cada proyecto: valores numéricos derivados del texto, enlaces y archivos convertidos en códigos, junto con el título, el evento y el año. La huella no permite leer el texto ni los enlaces originales. El alojamiento y los proveedores pueden procesar dirección IP, datos del navegador, fechas y registros técnicos para prestar y proteger el servicio.",
        ],
      },
      {
        id: "finalidades",
        title: "Para qué se usa",
        paragraphs: [
          "Los datos permiten autenticarte, aplicar permisos, organizar eventos, registrar equipos y entregas, que los jueces califiquen, publicar resultados y apoyar la revisión de originalidad de los proyectos. El correo te identifica en los eventos y recibe los mensajes de la cuenta: verificación y recuperación de contraseña.",
          "Esta versión no integra publicidad ni medición de visitas. No se usan tus datos para publicidad, venta de perfiles, envíos comerciales ni entrenamiento de modelos.",
        ],
      },
      {
        id: "accesos",
        title: "Quién puede consultar información",
        paragraphs: [
          "Un proyecto lo ven sus integrantes, los organizadores y jueces de su evento y los administradores de la plataforma. Cada juez ve sus propias calificaciones; los organizadores ven todas las del evento con el nombre del juez. Cuando el organizador publica resultados, cada equipo ve sus puntajes y comentarios sin el nombre del juez.",
          "Los datos generales de cada evento —nombre, descripción, institución, fechas, código, rúbrica, resultados publicados y correos de organizadores y jueces— los pueden consultar las cuentas con sesión iniciada, porque permiten encontrar el evento con su código. La clasificación publicada muestra títulos de proyectos y puntajes.",
          "Las huellas de originalidad, con título, evento y año del proyecto, las pueden consultar las cuentas verificadas para hacer la comparación. Los administradores y el superadministrador pueden consultar la lista de usuarios, sus permisos y todos los eventos y proyectos para administrar la plataforma.",
        ],
      },
      {
        id: "proveedores",
        title: "Proveedores y tratamiento fuera de México",
        paragraphs: [
          "Google Firebase Authentication gestiona cuentas, sesiones y los correos de verificación y recuperación; Cloud Firestore almacena los datos. Vercel aloja la app y procesa solicitudes y registros técnicos. El acceso con Google utiliza el flujo y las políticas de Google.",
          "El servicio se dirige a México, pero estos proveedores pueden procesar información en otros países. No se garantiza almacenamiento exclusivo en México; sus condiciones y prácticas de conservación también se aplican al tratamiento que realizan.",
          "No se comercializan datos ni se transfieren para publicidad. Las comunicaciones necesarias a proveedores por cuenta del responsable, a las personas del evento según sus permisos y a autoridades cuando exista una obligación válida se limitan a su finalidad. Si se incorpora una transferencia que requiera consentimiento adicional, se informará y recabará antes de efectuarla.",
        ],
      },
      {
        id: "dispositivo",
        title: "Datos en tu dispositivo",
        paragraphs: [
          "El navegador conserva tu sesión de Firebase y la preferencia de modo claro u oscuro. C.O.D.E no usa cookies propias ni de publicidad o medición. Consulta Cookies y almacenamiento para conocer los usos y controles.",
          "Cerrar sesión elimina la sesión guardada en ese navegador. La preferencia de tema permanece hasta que la restablezcas o borres los datos del sitio.",
        ],
      },
      {
        id: "conservacion",
        title: "Conservación y eliminación",
        paragraphs: [
          "La cuenta y el contenido permanecen mientras se utilizan para prestar el servicio y hasta que se atienda una solicitud de cancelación o cierre que resulte procedente. No hay una purga automática por inactividad.",
          "Los eventos, proyectos, evaluaciones y resultados forman parte del historial de cada evento. Las huellas de originalidad se conservan después del evento para comparar proyectos de años posteriores; la app no las borra automáticamente, pero se pueden revisar y eliminar mediante una solicitud de cancelación.",
          "Al atender una cancelación se eliminará o disociará la información que proceda. Si una obligación legal o los derechos de otras personas exigen conservar información, como el proyecto de un equipo o los resultados de un evento, se limitará su uso y se informará el motivo. No se promete la eliminación inmediata de registros o respaldos de proveedores.",
        ],
      },
      {
        id: "derechos",
        title: "Derechos ARCO y solicitudes de privacidad",
        paragraphs: [
          `Puedes solicitar acceso, rectificación, cancelación u oposición; revocar el consentimiento; limitar el uso o divulgación; o solicitar el cierre de tu cuenta escribiendo a ${email}. Indica como asunto «Privacidad C.O.D.E» y el derecho o solicitud que deseas ejercer.`,
          "Incluye tu nombre, el correo de la cuenta, un medio para recibir respuesta, la descripción de los datos y lo que solicitas. Para rectificación, explica el cambio y su sustento. El responsable verificará tu identidad o representación con los datos mínimos necesarios antes de entregar información o hacer cambios; nunca se solicitarán contraseñas.",
          "Las solicitudes se atienden manualmente. La respuesta se comunicará dentro de veinte días hábiles desde la recepción y, si procede, se ejecutará dentro de los quince días hábiles siguientes. Una ampliación legalmente justificada se notificará; el ejercicio es gratuito, salvo costos de reproducción o envío que legalmente correspondan.",
          "La revocación no afecta tratamientos anteriores y puede impedir continuar en funciones que necesiten esos datos, como participar en un evento. La cancelación u oposición se evalúa considerando obligaciones legales y derechos de otras personas; se explicará cualquier negativa o limitación.",
        ],
        links: [mail],
      },
      {
        id: "cambios",
        title: "Cambios al aviso y opciones",
        paragraphs: [
          "La versión vigente y su fecha se muestran en esta página. Los cambios se publicarán aquí y se identificarán en Versiones de C.O.D.E. Si afectan finalidades o requieren un consentimiento nuevo, se informarán mediante el servicio o el correo de la cuenta antes de aplicar el tratamiento correspondiente.",
          "Desde Privacidad de mi cuenta puedes cerrar sesión en el navegador y restablecer la preferencia de tema. Puedes retirar el permiso de Google desde tu Cuenta de Google, pero eso no cancela automáticamente los datos de C.O.D.E.",
          "No hay tratamientos comerciales opcionales que debas aceptar para usar el servicio. Este aviso no constituye una certificación de cumplimiento ni una aprobación de Google o del Instituto Tecnológico de Culiacán.",
        ],
      },
      {
        id: "estudiantes",
        title: "Estudiantes y menores de edad",
        paragraphs: [
          "C.O.D.E está pensado para eventos académicos. Si participan menores de edad, la institución u organización del evento es responsable de recabar las autorizaciones de madres, padres o tutores antes de registrarlos.",
          "Registra solo los datos necesarios del equipo: nombre y correo de cada integrante. No incluyas en los proyectos información sensible de los integrantes ni de otras personas.",
        ],
      },
    ],
  },

  cookies: {
    title: "Cookies y almacenamiento",
    intro: "Cómo utiliza C.O.D.E el navegador y qué puedes controlar.",
    technical: true,
    sections: [
      {
        id: "resumen",
        title: "Lo que guarda C.O.D.E",
        paragraphs: [
          "C.O.D.E no utiliza cookies propias. El navegador solo guarda tu sesión y la preferencia de tema. En la revisión hecha al publicar esta versión no se encontraron cookies del sitio, ni con sesión iniciada ni sin ella.",
          "La app solo se comunica con su propio dominio y con los servicios de Google Firebase. Las tipografías se sirven desde el mismo sitio.",
        ],
      },
      {
        id: "sesion",
        title: "Acceso y sesión (necesario)",
        paragraphs: [
          "Firebase Authentication guarda la sesión en el almacenamiento IndexedDB del navegador (base firebaseLocalStorageDb) para que no tengas que entrar en cada visita. Permanece hasta que cierres sesión o borres los datos del sitio. Firebase también usa la base firebase-heartbeat-database para registrar fechas de uso de su SDK, sin datos de tus eventos ni proyectos.",
          "El acceso con Google abre una ventana de Google con tecnologías de sesión propias, sujetas a sus políticas. Cerrar sesión en C.O.D.E no cierra tu sesión de Google.",
        ],
      },
      {
        id: "preferencias",
        title: "Preferencia de tema (funcional)",
        paragraphs: [
          "La clave theme de localStorage guarda si prefieres modo claro u oscuro; si no la hay, se usa la del sistema. Permanece hasta que la restablezcas o borres los datos del sitio y no contiene datos personales.",
        ],
      },
      {
        id: "datos",
        title: "Eventos y proyectos",
        paragraphs: [
          "Los eventos, proyectos y calificaciones se leen de Cloud Firestore al abrirlos y no se guardan como copia en el navegador. Al cerrar la pestaña solo permanecen la sesión y la preferencia de tema.",
        ],
      },
      {
        id: "medicion",
        title: "Publicidad y medición",
        paragraphs: [
          "Esta versión no incorpora publicidad ni medición de visitas. No hay categorías opcionales para aceptar o rechazar, por eso no se muestra un aviso de cookies.",
          "Si se incorporan tecnologías opcionales, se informarán su finalidad, duración y controles antes de activarlas. Los registros técnicos del alojamiento y las tecnologías de Google se rigen por las políticas de esos proveedores.",
        ],
      },
      {
        id: "controles",
        title: "Controles del navegador y contacto",
        paragraphs: [
          "Puedes consultar y borrar los datos del sitio desde la configuración de tu navegador. Borrar la sesión te pedirá entrar de nuevo, pero no elimina tus datos guardados en el servicio. Desde Privacidad de mi cuenta puedes cerrar sesión en este dispositivo y restablecer el tema.",
          `El responsable es ${name}. Para consultas o solicitudes sobre estos datos escribe a ${email}; el aviso de privacidad describe los derechos y el tratamiento en el servicio.`,
        ],
        links: [mail],
      },
    ],
  },
};
