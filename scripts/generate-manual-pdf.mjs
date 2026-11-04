#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const DOCS_DIR = join(ROOT, 'docs');
const CAPTURAS_DIR = join(DOCS_DIR, 'capturas');
const OUTPUT_HTML = join(DOCS_DIR, 'MANUAL_TECNICO_ROLES.html');
const OUTPUT_PDF = join(DOCS_DIR, 'MANUAL_TECNICO_ROLES.pdf');

console.log('🚀 Iniciando compilación de Manual Técnico a PDF...');

// Carga de imágenes en Base64
function getBase64Image(filename) {
  const filePath = join(CAPTURAS_DIR, filename);
  if (!existsSync(filePath)) {
    console.warn(`⚠️ Advertencia: imagen no encontrada: ${filePath}`);
    return '';
  }
  const data = readFileSync(filePath);
  return `data:image/png;base64,${data.toString('base64')}`;
}

const images = {
  login: getBase64Image('00_login_portal.png'),
  admin_dash: getBase64Image('admin_01_dashboard.png'),
  admin_usuarios: getBase64Image('admin_02_usuarios.png'),
  admin_eventos: getBase64Image('admin_03_eventos.png'),
  admin_permisos: getBase64Image('admin_04_permisos.png'),
  org_dash: getBase64Image('organizador_01_dashboard.png'),
  org_nuevo: getBase64Image('organizador_02_nuevo_evento.png'),
  org_resumen: getBase64Image('organizador_03_evento_resumen.png'),
  org_proyectos: getBase64Image('organizador_04_proyectos.png'),
  org_jueces: getBase64Image('organizador_05_jueces.png'),
  org_rubrica: getBase64Image('organizador_06_rubrica.png'),
  org_resultados: getBase64Image('organizador_07_resultados.png'),
  org_ajustes: getBase64Image('organizador_08_ajustes.png'),
  juez_dash: getBase64Image('juez_01_dashboard.png'),
  juez_lista: getBase64Image('juez_02_lista_proyectos.png'),
  juez_rubrica: getBase64Image('juez_03_evaluacion_rubrica.png'),
  alumno_dash: getBase64Image('alumno_01_dashboard.png'),
  alumno_registro: getBase64Image('alumno_02_registro_proyecto.png'),
  alumno_detalle: getBase64Image('alumno_03_detalle_proyecto.png'),
  alumno_entrega: getBase64Image('alumno_04_entrega_fase.png'),
};

const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>C.O.D.E · Manual Técnico de Usuario y Roles</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 16mm 14mm 16mm 14mm;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .running-header {
        position: fixed;
        top: -11mm;
        left: 0;
        right: 0;
        height: 6mm;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e2e8f0;
        font-size: 7.5pt;
        color: #64748b;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .running-footer {
        position: fixed;
        bottom: -11mm;
        left: 0;
        right: 0;
        height: 6mm;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #e2e8f0;
        font-size: 7.5pt;
        color: #64748b;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.5;
      font-size: 9.5pt;
      background-color: #ffffff;
    }

    .doc-page {
      page-break-after: always;
      break-after: page;
      position: relative;
      min-height: 258mm;
      display: flex;
      flex-direction: column;
    }

    /* Portada Ejecutiva */
    .cover-page {
      position: relative;
      page-break-after: always;
      break-after: page;
      min-height: 258mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 6mm 4mm;
    }

    /* Ocultar encabezados fijos en la portada */
    .cover-page::before {
      content: "";
      position: absolute;
      top: -16mm;
      left: -14mm;
      right: -14mm;
      height: 22mm;
      background: #ffffff;
      z-index: 9999;
    }
    .cover-page::after {
      content: "";
      position: absolute;
      bottom: -16mm;
      left: -14mm;
      right: -14mm;
      height: 22mm;
      background: #ffffff;
      z-index: 9999;
    }

    .cover-top {
      border-top: 5px solid #2563eb;
      padding-top: 24px;
      position: relative;
      z-index: 10;
    }

    .badge-system {
      display: inline-block;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 5px 14px;
      border-radius: 9999px;
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 20px;
    }

    .cover-title {
      font-size: 27pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.15;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
    }

    .cover-subtitle {
      font-size: 13pt;
      color: #475569;
      font-weight: 400;
      line-height: 1.4;
      margin-bottom: 22px;
    }

    .tech-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 24px;
    }

    .tech-pill {
      background: #f1f5f9;
      color: #334155;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 8pt;
      font-weight: 600;
      border: 1px solid #e2e8f0;
    }

    .cover-hero-box {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border-radius: 12px;
      padding: 22px;
      color: #ffffff;
      margin: 12px 0 20px 0;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.15);
    }

    .cover-hero-title {
      font-size: 10.5pt;
      font-weight: 700;
      color: #93c5fd;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .cover-hero-desc {
      font-size: 9pt;
      color: #cbd5e1;
      line-height: 1.5;
    }

    .cover-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 15px;
      border-top: 1px solid #e2e8f0;
      padding-top: 18px;
      position: relative;
      z-index: 10;
    }

    .meta-item {
      font-size: 8.5pt;
    }

    .meta-label {
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 7pt;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }

    .meta-value {
      color: #0f172a;
      font-weight: 600;
    }

    /* Índice */
    .toc-container {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 22px;
    }

    .toc-title {
      font-size: 12pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 12px;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 4px;
      display: inline-block;
    }

    .toc-list {
      list-style: none;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 18px;
    }

    .toc-list li {
      font-size: 8.5pt;
      color: #334155;
    }

    .toc-list strong {
      color: #0f172a;
    }

    /* Diagrama de Arquitectura */
    .arch-diagram {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 16px;
      margin: 14px 0 20px 0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.04);
    }

    .arch-flow-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }

    .role-card {
      border-radius: 8px;
      padding: 10px;
      text-align: center;
      border: 1px solid;
    }

    .role-admin { background: #faf5ff; border-color: #d8b4fe; color: #6b21a8; }
    .role-org { background: #f0f9ff; border-color: #bae6fd; color: #0369a1; }
    .role-judge { background: #fffbeb; border-color: #fde68a; color: #b45309; }
    .role-student { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }

    .role-title { font-weight: 700; font-size: 8.5pt; margin-bottom: 3px; }
    .role-desc { font-size: 7.2pt; line-height: 1.25; opacity: 0.9; }

    .platform-hub {
      background: #0f172a;
      color: #ffffff;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }

    .platform-hub-title {
      font-weight: 700;
      font-size: 9.5pt;
      color: #60a5fa;
      margin-bottom: 6px;
    }

    .platform-routes {
      display: flex;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .route-chip {
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      padding: 2px 7px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 7.2pt;
      color: #e2e8f0;
    }

    /* Secciones y Encabezados */
    .section-header-box {
      margin-bottom: 12px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
    }

    h2.section-header {
      font-size: 14pt;
      font-weight: 800;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: space-between;
      letter-spacing: -0.3px;
    }

    .section-tag {
      font-size: 7.5pt;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .tag-admin { background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; }
    .tag-org { background: #e0f2fe; color: #0284c7; border: 1px solid #7dd3fc; }
    .tag-judge { background: #fef3c7; color: #d97706; border: 1px solid #fde68a; }
    .tag-student { background: #d1fae5; color: #059669; border: 1px solid #6ee7b7; }
    .tag-auth { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }

    h3.feature-title {
      font-size: 11pt;
      font-weight: 700;
      color: #1e293b;
      margin: 6px 0 6px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .route-badge {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 7.5pt;
      background: #f1f5f9;
      color: #334155;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      font-weight: 600;
    }

    p.feature-desc {
      font-size: 8.8pt;
      color: #475569;
      margin-bottom: 6px;
      line-height: 1.45;
    }

    ul.feature-bullets {
      margin: 4px 0 8px 18px;
      font-size: 8.4pt;
      color: #334155;
    }

    ul.feature-bullets li {
      margin-bottom: 3px;
    }

    /* Mockup de Navegador para Capturas */
    .browser-mockup {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      background: #ffffff;
      margin: 8px 0 10px 0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      flex-grow: 1;
      display: flex;
      flex-direction: column;
    }

    .browser-topbar {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 5px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .browser-controls {
      display: flex;
      gap: 5px;
    }

    .control-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .dot-red { background: #ef4444; }
    .dot-yellow { background: #f59e0b; }
    .dot-green { background: #10b981; }

    .browser-address {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 2px 9px;
      font-size: 7pt;
      color: #64748b;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-grow: 1;
      max-width: 320px;
    }

    .browser-title {
      font-size: 7.5pt;
      font-weight: 600;
      color: #475569;
      margin-left: auto;
    }

    .browser-image-box {
      background-color: #0f172a;
      flex-grow: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      max-height: 420px;
      overflow: hidden;
    }

    .browser-image {
      display: block;
      width: 100%;
      height: auto;
      max-height: 420px;
      object-fit: contain;
    }

    /* Callouts / Notas */
    .callout {
      background: #eff6ff;
      border-left: 4px solid #2563eb;
      border-radius: 0 6px 6px 0;
      padding: 8px 12px;
      margin-top: 6px;
      font-size: 8.2pt;
      color: #1e3a8a;
      line-height: 1.4;
    }

    .callout strong {
      color: #1d4ed8;
    }

    .callout-warning {
      background: #fffbeb;
      border-left-color: #f59e0b;
      color: #92400e;
    }

    .callout-warning strong {
      color: #b45309;
    }

    /* Tabla de Matriz */
    .table-container {
      margin: 14px 0;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
    }

    table.matrix-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.2pt;
      text-align: left;
    }

    table.matrix-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 9px 12px;
      font-weight: 600;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    table.matrix-table td {
      padding: 7.5px 12px;
      border-top: 1px solid #e2e8f0;
      color: #334155;
    }

    table.matrix-table tr:nth-child(even) {
      background: #f8fafc;
    }

    .check-yes {
      display: inline-block;
      background: #dcfce7;
      color: #166534;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 7.5pt;
    }

    .check-no {
      display: inline-block;
      background: #f1f5f9;
      color: #94a3b8;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 7.5pt;
    }

    /* Bloques de código de seguridad */
    .code-box {
      background: #0f172a;
      color: #f8fafc;
      border-radius: 8px;
      padding: 12px 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 7.5pt;
      line-height: 1.45;
      margin: 10px 0;
      overflow-x: auto;
    }

    .code-comment { color: #64748b; }
    .code-keyword { color: #f43f5e; font-weight: 600; }
    .code-func { color: #38bdf8; }
    .code-str { color: #a3e635; }
  </style>
</head>
<body>

  <!-- Encabezados y Pies Fijos para Impresión -->
  <div class="running-header">
    <span>C.O.D.E · Sistema de Evaluación de Proyectos</span>
    <span>Manual Técnico y Operativo por Roles</span>
  </div>
  <div class="running-footer">
    <span>Proyecto Firebase: code-94fbe · Documento Oficial</span>
    <span>v1.0 Producción</span>
  </div>

  <!-- PÁGINA 1: PORTADA -->
  <div class="cover-page">
    <div class="cover-top">
      <div class="badge-system">Documentación Oficial de Plataforma</div>
      <h1 class="cover-title">Manual Técnico y Operativo por Roles</h1>
      <h2 class="cover-subtitle">Guía de Arquitectura, Flujos de Trabajo e Interfaces de Usuario en el Ecosistema C.O.D.E</h2>

      <div class="tech-badges">
        <span class="tech-pill">Next.js 16 (App Router)</span>
        <span class="tech-pill">React 19</span>
        <span class="tech-pill">Tailwind CSS 4</span>
        <span class="tech-pill">Firebase Auth & Firestore</span>
        <span class="tech-pill">Hash SHA-256</span>
        <span class="tech-pill">MinHash Similitud</span>
      </div>

      <div class="cover-hero-box">
        <div class="cover-hero-title">Resumen Ejecutivo del Sistema</div>
        <div class="cover-hero-desc">
          <strong>C.O.D.E (Evaluación de Proyectos Escolares)</strong> es una plataforma web pensada primero para celular orientada a la organización de certámenes académicos, ferias de ciencias y hackathones. Permite a los equipos registrar proyectos y subir prototipos con verificación criptográfica; a los jueces evaluar mediante rúbricas ponderadas; y a los organizadores gobernar las etapas y publicar dictámenes oficiales con detección preventiva de similitud histórica.
        </div>
      </div>
    </div>

    <div class="cover-meta-grid">
      <div class="meta-item">
        <div class="meta-label">ID de Proyecto Firebase</div>
        <div class="meta-value">code-94fbe (Google Cloud)</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Despliegue Local / Servidor</div>
        <div class="meta-value">http://localhost:3000</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Superadministrador Raíz</div>
        <div class="meta-value">edgarochoa0173@gmail.com</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Roles Documentados</div>
        <div class="meta-value">Admin · Organizador · Juez · Alumno Líder</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Fecha de Emisión</div>
        <div class="meta-value">Octubre 2026</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Estatus de Plataforma</div>
        <div class="meta-value">Versión 1.0 Estable (Producción)</div>
      </div>
    </div>
  </div>

  <!-- PÁGINA 2: ÍNDICE Y ARQUITECTURA -->
  <div class="doc-page">
    <div class="toc-container">
      <div class="toc-title">Índice General del Documento</div>
      <ul class="toc-list">
        <li><strong>1. Portal de Acceso y Autenticación</strong> (/login)</li>
        <li><strong>2. Rol: Administrador</strong> (Dashboard, usuarios, eventos y permisos)</li>
        <li><strong>3. Rol: Organizador</strong> (Rúbricas, etapas, proyectos y jueces)</li>
        <li><strong>4. Rol: Juez Evaluador</strong> (Calificación multicriterio y rúbrica)</li>
        <li><strong>5. Rol: Alumno Líder</strong> (Inscripción, equipo y entregas SHA-256)</li>
        <li><strong>6. Matriz Comparativa</strong> (Capacidades y permisos por rol)</li>
        <li><strong>7. Seguridad y Reglas Firestore</strong> (RBAC y aislamiento de datos)</li>
      </ul>
    </div>

    <div class="section-header-box">
      <h2 class="section-header">
        <span>Arquitectura de Roles y Flujo Operativo</span>
        <span class="section-tag tag-auth">Ecosistema Global</span>
      </h2>
    </div>
    <p class="feature-desc">
      El ecosistema C.O.D.E implementa un modelo de control de acceso basado en roles (RBAC) y atributos (ABAC) donde cada perfil cuenta con rutas especializadas, validaciones contextuales y políticas estrictas de seguridad en base de datos:
    </p>

    <div class="arch-diagram">
      <div class="arch-flow-grid">
        <div class="role-card role-admin">
          <div class="role-title">1. Superadmin / Admin</div>
          <div class="role-desc">Gobierno global, padrón de usuarios, auditoría de eventos y permisos.</div>
        </div>
        <div class="role-card role-org">
          <div class="role-title">2. Organizador</div>
          <div class="role-desc">Crea eventos, pondera rúbricas, asigna jueces y publica resultados.</div>
        </div>
        <div class="role-card role-judge">
          <div class="role-title">3. Juez Evaluador</div>
          <div class="role-desc">Examina evidencias técnicas y califica con sliders ponderados.</div>
        </div>
        <div class="role-card role-student">
          <div class="role-title">4. Alumno Líder</div>
          <div class="role-desc">Inscribe equipo con código de 6 letras y sube entregables firmados.</div>
        </div>
      </div>

      <div class="platform-hub">
        <div class="platform-hub-title">Estructura Modular del App Router (Next.js 16)</div>
        <div class="platform-routes">
          <span class="route-chip">/login</span>
          <span class="route-chip">/panel</span>
          <span class="route-chip">/admin</span>
          <span class="route-chip">/eventos/[id]</span>
          <span class="route-chip">/eventos/[id]/judge</span>
          <span class="route-chip">/eventos/[id]/proyectos/[pid]</span>
        </div>
      </div>
    </div>

    <div class="callout">
      <strong>Aislamiento Multi-Evento:</strong> Los docentes solo pueden intervenir en los eventos que ellos fundaron o en los que fueron delegados explícitamente. Los alumnos únicamente pueden modificar su propio proyecto mientras las compuertas de inscripción sigan abiertas.
    </div>
  </div>

  <!-- PÁGINA 3: LOGIN -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>1. Portal de Acceso y Autenticación</span>
        <span class="section-tag tag-auth">Acceso Global</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>Portal de Inicio de Sesión y Restablecimiento</span>
      <span class="route-badge">/login</span>
    </h3>
    <p class="feature-desc">
      El acceso universal opera bajo la ruta <code>/login</code> mediante Firebase Authentication. Admite credenciales de correo institucional y contraseña, restablecimiento asistido de clave y conmutador visual para modo claro y oscuro.
    </p>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/login</div>
        <div class="browser-title">Portal de Autenticación Unificado</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.login}" alt="Portal de Acceso" />
      </div>
    </div>

    <div class="callout">
      <strong>Persistencia y Redirección:</strong> Las sesiones se gestionan mediante tokens JWT autenticados contra el proyecto <code>code-94fbe</code>. Tras iniciar sesión, el observador de autenticación inspecciona el perfil en Firestore y redirige inmediatamente al usuario a su panel correspondiente (<code>/panel</code>).
    </div>
  </div>

  <!-- PÁGINA 4: ADMIN - DASHBOARD -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>2. Rol: Administrador (Superadmin / Admin)</span>
        <span class="section-tag tag-admin">Gobierno Global</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>2.1 Dashboard de Administración</span>
      <span class="route-badge">/panel · /admin</span>
    </h3>
    <p class="feature-desc">
      Al ingresar, el Administrador visualiza en su panel los accesos de nivel ejecutivo: enlace directo a la consola de <strong>Administración</strong> (<code>/admin</code>), botón de <strong>Crear evento</strong>, buscador predictivo por código alfanumérico y la lista de eventos en los que participa directamente.
    </p>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/panel</div>
        <div class="browser-title">Dashboard Principal del Administrador</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.admin_dash}" alt="Dashboard Admin" />
      </div>
    </div>

    <div class="callout">
      <strong>Atajo Ejecutivo:</strong> La tarjeta superior de Administración permite saltar instantáneamente a la consola de gobernanza sin requerir menús de navegación complejos.
    </div>
  </div>

  <!-- PÁGINA 5: ADMIN - PADRÓN USUARIOS -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>2. Rol: Administrador (Superadmin / Admin)</span>
        <span class="section-tag tag-admin">Gobierno Global</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>2.2 Padrón Global de Usuarios (Pestaña "Usuarios")</span>
      <span class="route-badge">/admin?tab=users</span>
    </h3>
    <p class="feature-desc">
      Consolida a todos los usuarios autenticados en Firebase Auth cruzando sus datos con sus asignaciones en Firestore:
    </p>
    <ul class="feature-bullets">
      <li><strong>Filtros rápidos de estado:</strong> Visualiza Todos, Admins, Organizadores, Jueces, Suspendidos o Cuentas sin rol.</li>
      <li><strong>Auditoría operativa:</strong> Indicadores de cuántos eventos coordina, en cuántos funge como juez y cuántos proyectos tiene asociados.</li>
      <li><strong>Acceso a perfil detallado:</strong> Modificación directa de roles de plataforma o bloqueo inmediato de cuentas por conducta indebida.</li>
    </ul>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/admin?tab=users</div>
        <div class="browser-title">Padrón de Usuarios y Asignaciones</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.admin_usuarios}" alt="Usuarios Admin" />
      </div>
    </div>
  </div>

  <!-- PÁGINA 6: ADMIN - GOBERNANZA EVENTOS -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>2. Rol: Administrador (Superadmin / Admin)</span>
        <span class="section-tag tag-admin">Gobierno Global</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>2.3 Inventario y Gobernanza de Eventos (Pestaña "Eventos")</span>
      <span class="route-badge">/admin?tab=events</span>
    </h3>
    <p class="feature-desc">
      Supervisa los certámenes registrados por todas las facultades o academias de la institución:
    </p>
    <ul class="feature-bullets">
      <li><strong>Identificadores de convocatoria:</strong> Consulta códigos alfanuméricos únicos de 6 caracteres (ej. <code>DEMO26</code>).</li>
      <li><strong>Auditoría de apertura:</strong> Valida el estado de registro y evaluación de cada certamen escolar.</li>
      <li><strong>Gobernanza institucional:</strong> Faculta al admin para asignar organizadores delegados o depurar convocatorias obsoletas.</li>
    </ul>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/admin?tab=events</div>
        <div class="browser-title">Inventario Institucional de Eventos</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.admin_eventos}" alt="Eventos Admin" />
      </div>
    </div>
  </div>

  <!-- PÁGINA 7: ADMIN - PERMISOS -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>2. Rol: Administrador (Superadmin / Admin)</span>
        <span class="section-tag tag-admin">Gobierno Global</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>2.4 Control de Roles y Permisos (Pestaña "Permisos")</span>
      <span class="route-badge">/admin?tab=permissions</span>
    </h3>
    <p class="feature-desc">
      El Superadmin (<code>edgarochoa0173@gmail.com</code>) otorga o revoca permisos a nivel de base de datos para cualquier correo:
    </p>
    <ul class="feature-bullets">
      <li><code>admin</code>: Concede acceso a la consola global de eventos, padrón de usuarios y supervisión de jueces.</li>
      <li><code>organizer</code>: Habilita la facultad de dar de alta nuevos certámenes institucionales.</li>
      <li><code>blocked</code>: Bloquea inmediatamente el acceso a la plataforma por reglas de seguridad en Firestore.</li>
    </ul>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/admin?tab=permissions</div>
        <div class="browser-title">Consola de Permisos Globales</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.admin_permisos}" alt="Permisos Admin" />
      </div>
    </div>
  </div>

  <!-- PÁGINA 8: ORGANIZADOR - DASHBOARD -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>3. Rol: Organizador</span>
        <span class="section-tag tag-org">Gestión Docente</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>3.1 Dashboard del Organizador</span>
      <span class="route-badge">/panel</span>
    </h3>
    <p class="feature-desc">
      El Organizador es el docente o coordinador responsable de formalizar el certamen. En la sección <strong>Organizo</strong> visualiza sus certámenes coordinados, el porcentaje de avance general y accesos rápidos para convocar nuevos eventos.
    </p>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/panel</div>
        <div class="browser-title">Panel de Control del Docente Organizador</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.org_dash}" alt="Dashboard Organizador" />
      </div>
    </div>

    <div class="callout">
      <strong>Métricas en Vivo:</strong> Cada tarjeta de evento muestra el número de proyectos postulados y el avance de evaluación sin tener que ingresar a la configuración.
    </div>
  </div>

  <!-- PÁGINA 9: ORGANIZADOR - ALTA EVENTO -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>3. Rol: Organizador</span>
        <span class="section-tag tag-org">Gestión Docente</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>3.2 Formulario de Alta de Evento</span>
      <span class="route-badge">/eventos/nuevo</span>
    </h3>
    <p class="feature-desc">
      Permite parametrizar las variables rectoras de la convocatoria académica:
    </p>
    <ul class="feature-bullets">
      <li><strong>Datos institucionales:</strong> Nombre oficial del certamen e institución convocante.</li>
      <li><strong>Código único:</strong> Clave de 6 letras (ej. <code>DEMO26</code>) para que los alumnos ingresen de forma autónoma.</li>
      <li><strong>Fases del certamen:</strong> Conmutador de entrega para fase de Prototipo y/o Producto Final.</li>
      <li><strong>Reglamento de equipos:</strong> Límite máximo de integrantes por proyecto y calendario de vigencia de fechas.</li>
    </ul>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/eventos/nuevo</div>
        <div class="browser-title">Creación y Parametrización de Convocatoria</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.org_nuevo}" alt="Nuevo Evento" />
      </div>
    </div>
  </div>

  <!-- PÁGINA 10: ORGANIZADOR - RESUMEN EVENTO -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>3. Rol: Organizador</span>
        <span class="section-tag tag-org">Operación de Certamen</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>3.3 Centro de Control del Evento (Pestaña "Resumen")</span>
      <span class="route-badge">/eventos/[id]?tab=overview</span>
    </h3>
    <p class="feature-desc">
      Tablero operativo que muestra en tiempo real las cuatro compuertas del certamen: Registro, Prototipo, Producto Final y Resultados, con contadores en vivo de proyectos registrados, jueces activos y evaluaciones recibidas.
    </p>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/eventos/demo-expo?tab=overview</div>
        <div class="browser-title">Resumen Operativo y Avance del Evento</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.org_resumen}" alt="Resumen Evento" />
      </div>
    </div>

    <div class="callout">
      <strong>Difusión Rápida:</strong> Incluye botones interactivos para copiar directamente el código alfanumérico o compartir el enlace de inscripción directa por mensajería.
    </div>
  </div>

  <!-- PÁGINA 11: ORGANIZADOR - PROYECTOS Y SIMILITUD -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>3. Rol: Organizador</span>
        <span class="section-tag tag-org">Operación de Certamen</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>3.4 Padrón de Proyectos y Detección de Similitud (Pestaña "Proyectos")</span>
      <span class="route-badge">/eventos/[id]?tab=projects</span>
    </h3>
    <p class="feature-desc">
      Concentrado de equipos y proyectos escolares registrados en el certamen:
    </p>
    <ul class="feature-bullets">
      <li><strong>Categorización:</strong> Segmentación por áreas temáticas (Software, Hardware/IoT, Innovación Social).</li>
      <li><strong>Estatus de entregas:</strong> Monitoreo de fases completadas (Prototipo y Producto Final).</li>
      <li><strong>Originalidad y Similitud:</strong> Análisis automatizado MinHash que compara título, problema y solución contra la base histórica de años anteriores para prevenir duplicidad académica.</li>
    </ul>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/eventos/demo-expo?tab=projects</div>
        <div class="browser-title">Padrón de Proyectos y Monitoreo de Originalidad</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.org_proyectos}" alt="Proyectos Organizador" />
      </div>
    </div>
  </div>

  <!-- PÁGINA 12: ORGANIZADOR - GESTIÓN JUECES -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>3. Rol: Organizador</span>
        <span class="section-tag tag-org">Evaluación Colegiada</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>3.5 Asignación y Avance de Jueces (Pestaña "Jueces")</span>
      <span class="route-badge">/eventos/[id]?tab=judges</span>
    </h3>
    <p class="feature-desc">
      Administración del cuerpo colegiado de evaluadores:
    </p>
    <ul class="feature-bullets">
      <li><strong>Invitación por correo:</strong> Registro masivo de docentes y evaluadores externos.</li>
      <li><strong>Asignación flexible:</strong> Faculta para designar jueces por categoría completa o proyectos específicos.</li>
      <li><strong>Progreso individual en vivo:</strong> Barras de completitud que indican qué porcentaje de proyectos asignados ha calificado cada evaluador.</li>
    </ul>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/eventos/demo-expo?tab=judges</div>
        <div class="browser-title">Gestión de Jueces y Asignación de Categorías</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.org_jueces}" alt="Jueces Organizador" />
      </div>
    </div>
  </div>

  <!-- PÁGINA 13: ORGANIZADOR - RÚBRICA PONDERADA -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>3. Rol: Organizador</span>
        <span class="section-tag tag-org">Evaluación Colegiada</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>3.6 Parametrización de Rúbrica (Pestaña "Rúbrica")</span>
      <span class="route-badge">/eventos/[id]?tab=rubric</span>
    </h3>
    <p class="feature-desc">
      Configura los criterios cualitativos y cuantitativos que guiarán la evaluación técnica:
    </p>
    <ul class="feature-bullets">
      <li><strong>Criterios ponderados:</strong> Pesos porcentuales definidos por el organizador (ej. Innovación 25%, Viabilidad 25%, Impacto 20%, Funcionalidad 15%, Presentación 15%).</li>
      <li><strong>Normalización automática:</strong> El motor normaliza los pesos al 100% de forma transparente.</li>
      <li><strong>Descriptores de orientación:</strong> Pautas cualitativas para homologar el criterio de los evaluadores.</li>
    </ul>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/eventos/demo-expo?tab=rubric</div>
        <div class="browser-title">Editor de Rúbrica de Evaluación Ponderada</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.org_rubrica}" alt="Rúbrica Organizador" />
      </div>
    </div>
  </div>

  <!-- PÁGINA 14: ORGANIZADOR - RESULTADOS -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>3. Rol: Organizador</span>
        <span class="section-tag tag-org">Dictamen y Publicación</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>3.7 Resultados y Publicación Oficial (Pestaña "Resultados")</span>
      <span class="route-badge">/eventos/[id]?tab=results</span>
    </h3>
    <p class="feature-desc">
      Tablero de posiciones con cálculo algorítmico de promedios ponderados por proyecto y fase:
    </p>
    <ul class="feature-bullets">
      <li><strong>Publicación selectiva:</strong> Botón <em>"Publicar resultados"</em> para liberar notas y observaciones a los alumnos.</li>
      <li><strong>Exportación a CSV:</strong> Descarga inmediata de planilla de cálculo con desglose por criterio para actas académicas institucionales.</li>
    </ul>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/eventos/demo-expo?tab=results</div>
        <div class="browser-title">Tablero de Calificaciones Finales y Publicación</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.org_resultados}" alt="Resultados Organizador" />
      </div>
    </div>
  </div>

  <!-- PÁGINA 15: ORGANIZADOR - AJUSTES -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>3. Rol: Organizador</span>
        <span class="section-tag tag-org">Ajustes y Compuertas</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>3.8 Ajustes Operativos del Evento (Pestaña "Ajustes")</span>
      <span class="route-badge">/eventos/[id]?tab=settings</span>
    </h3>
    <p class="feature-desc">
      Conmutadores de control para aperturas y clausuras en tiempo real:
    </p>
    <ul class="feature-bullets">
      <li><strong>Recepción de proyectos:</strong> Abre o clausura el registro de nuevos equipos participantes.</li>
      <li><strong>Fases de entrega:</strong> Permite habilitar o inhabilitar la recepción de Prototipo o Producto Final.</li>
      <li><strong>Evaluación de jueces:</strong> Conmuta si los jueces pueden seguir asentando o editando notas.</li>
    </ul>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/eventos/demo-expo?tab=settings</div>
        <div class="browser-title">Ajustes y Compuertas Operativas</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.org_ajustes}" alt="Ajustes Organizador" />
      </div>
    </div>
  </div>

  <!-- PÁGINA 16: JUEZ - DASHBOARD -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>4. Rol: Juez Evaluador</span>
        <span class="section-tag tag-judge">Evaluación Técnica</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>4.1 Dashboard del Juez Evaluador</span>
      <span class="route-badge">/panel</span>
    </h3>
    <p class="feature-desc">
      El Juez es el evaluador asignado para calificar las propuestas estudiantiles. Al ingresar al sistema observa prioritariamente el bloque <strong>Para evaluar</strong>, con tarjetas oscuras destacadas que indican en qué eventos fue asignado por el comité organizador.
    </p>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/panel</div>
        <div class="browser-title">Panel del Juez con Asignaciones Destacadas</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.juez_dash}" alt="Dashboard Juez" />
      </div>
    </div>

    <div class="callout">
      <strong>Enfoque Operativo:</strong> El juez no ve opciones administrativas que puedan confundirlo; su flujo se enfoca directamente en evaluar los proyectos que le corresponden.
    </div>
  </div>

  <!-- PÁGINA 17: JUEZ - LISTA PROYECTOS -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>4. Rol: Juez Evaluador</span>
        <span class="section-tag tag-judge">Evaluación Técnica</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>4.2 Lista de Proyectos Asignados y Avance</span>
      <span class="route-badge">/eventos/[id]/judge</span>
    </h3>
    <p class="feature-desc">
      Al ingresar al evento asignado, el evaluador cuenta con:
    </p>
    <ul class="feature-bullets">
      <li><strong>Medidor de avance personal:</strong> Indicador visual de cuántas evaluaciones ha completado (ej. <code>1/2 · 50%</code>).</li>
      <li><strong>Filtros por pestaña:</strong> Organización clara entre <code>Pendientes</code>, <code>Asignados</code> y <code>Todos</code>.</li>
      <li><strong>Buscador predictivo:</strong> Localiza ágilmente proyectos por nombre, categoría o tecnologías.</li>
    </ul>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/eventos/demo-expo/judge</div>
        <div class="browser-title">Proyectos Asignados y Medidor de Calificación</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.juez_lista}" alt="Lista Proyectos Juez" />
      </div>
    </div>
  </div>

  <!-- PÁGINA 18: JUEZ - EVALUACIÓN RÚBRICA -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>4. Rol: Juez Evaluador</span>
        <span class="section-tag tag-judge">Evaluación Técnica</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>4.3 Hoja de Calificación Multicriterio (Pestaña "Evaluar")</span>
      <span class="route-badge">/eventos/[id]/proyectos/[pid]?tab=evaluate</span>
    </h3>
    <p class="feature-desc">
      Inspección técnica integral del proyecto estudiantil:
    </p>
    <ul class="feature-bullets">
      <li><strong>Revisión de evidencias:</strong> Pestañas para examinar repositorios GitHub, diagramas Figma y videos demo.</li>
      <li><strong>Sliders interactivos (0 a 10):</strong> Ajuste preciso por cada criterio de la rúbrica oficial con cálculo en tiempo real del puntaje ponderado normalizado.</li>
      <li><strong>Retroalimentación formativa:</strong> Cuadro de observaciones para retroalimentar el desarrollo del equipo.</li>
    </ul>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/eventos/demo-expo/proyectos/demo-proyecto?tab=evaluate</div>
        <div class="browser-title">Hoja de Evaluación Ponderada para el Juez</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.juez_rubrica}" alt="Evaluación Rúbrica Juez" />
      </div>
    </div>
  </div>

  <!-- PÁGINA 19: ALUMNO - DASHBOARD -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>5. Rol: Alumno Líder</span>
        <span class="section-tag tag-student">Equipos Escolares</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>5.1 Dashboard del Alumno</span>
      <span class="route-badge">/panel</span>
    </h3>
    <p class="feature-desc">
      El Alumno Líder es el estudiante responsable de inscribir al equipo escolar. En su panel cuenta con la tarjeta <strong>"¿Tienes un código?"</strong> para ingresar la clave de 6 letras entregada por su docente, y la sección <strong>"Mis proyectos"</strong> con las credenciales y badges de entregas de su propuesta.
    </p>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/panel</div>
        <div class="browser-title">Portal Estudiantil con Acceso por Código</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.alumno_dash}" alt="Dashboard Alumno" />
      </div>
    </div>

    <div class="callout">
      <strong>Inscripción Intuitiva:</strong> Al ingresar el código (ej. <code>DEMO26</code>), la app valida que el registro esté abierto y conduce inmediatamente a la ficha de alta de proyecto.
    </div>
  </div>

  <!-- PÁGINA 20: ALUMNO - REGISTRO PROYECTO -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>5. Rol: Alumno Líder</span>
        <span class="section-tag tag-student">Equipos Escolares</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>5.2 Formulario de Registro de Proyecto Escolar</span>
      <span class="route-badge">/eventos/[id]/nuevo-proyecto</span>
    </h3>
    <p class="feature-desc">
      Captura estructurada de la propuesta académica:
    </p>
    <ul class="feature-bullets">
      <li><strong>Ficha de propuesta:</strong> Título del proyecto, resumen ejecutivo, planteamiento del problema y solución desarrollada.</li>
      <li><strong>Stack y categoría:</strong> Clasificación temática y etiquetas de tecnologías implementadas.</li>
      <li><strong>Integrantes del equipo:</strong> Carga de compañeros con nombre y correo para acceso multiusuario colaborativo.</li>
    </ul>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/eventos/demo-expo/nuevo-proyecto</div>
        <div class="browser-title">Registro de Proyecto y Miembros de Equipo</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.alumno_registro}" alt="Registro Proyecto Alumno" />
      </div>
    </div>
  </div>

  <!-- PÁGINA 21: ALUMNO - FICHA TÉCNICA -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>5. Rol: Alumno Líder</span>
        <span class="section-tag tag-student">Equipos Escolares</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>5.3 Ficha Técnica del Proyecto (Pestaña "Información")</span>
      <span class="route-badge">/eventos/[id]/proyectos/[pid]?tab=info</span>
    </h3>
    <p class="feature-desc">
      Presenta la vista integral del proyecto escolar:
    </p>
    <ul class="feature-bullets">
      <li><strong>Directorio del equipo:</strong> Listado de integrantes con la insignia distintiva de <strong>Líder</strong>.</li>
      <li><strong>Indicadores de fase:</strong> Badges de estatus para conocer si la fase de prototipo o final ha sido recibida.</li>
      <li><strong>Capacidad de actualización:</strong> Modificación activa de datos de proyecto mientras el periodo de registro siga vigente.</li>
    </ul>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/eventos/demo-expo/proyectos/demo-proyecto?tab=info</div>
        <div class="browser-title">Ficha Técnica Oficial del Proyecto</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.alumno_detalle}" alt="Ficha Técnica Alumno" />
      </div>
    </div>
  </div>

  <!-- PÁGINA 22: ALUMNO - ENTREGAS SHA-256 -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>5. Rol: Alumno Líder</span>
        <span class="section-tag tag-student">Equipos Escolares</span>
      </h2>
    </div>
    <h3 class="feature-title">
      <span>5.4 Entrega de Fases con Hash Criptográfico SHA-256</span>
      <span class="route-badge">/eventos/[id]/proyectos/[pid]?tab=prototype</span>
    </h3>
    <p class="feature-desc">
      Subida y certificación de evidencias de desarrollo técnico:
    </p>
    <ul class="feature-bullets">
      <li><strong>Enlaces externos:</strong> Repositorios en GitHub/GitLab, diseños interactivos en Figma o videos demostrativos.</li>
      <li><strong>Firma SHA-256 en cliente:</strong> Los archivos adjuntos generan su huella criptográfica en el navegador antes de asentar la entrega. Esto garantiza la inmutabilidad y autenticidad temporal del trabajo escolar sin consumo forzado de Storage.</li>
    </ul>

    <div class="browser-mockup">
      <div class="browser-topbar">
        <div class="browser-controls"><div class="control-dot dot-red"></div><div class="control-dot dot-yellow"></div><div class="control-dot dot-green"></div></div>
        <div class="browser-address">🔒 https://code.edu.mx/eventos/demo-expo/proyectos/demo-proyecto?tab=prototype</div>
        <div class="browser-title">Entrega de Fases y Generación de Huella Criptográfica</div>
      </div>
      <div class="browser-image-box">
        <img class="browser-image" src="${images.alumno_entrega}" alt="Entrega Fases Alumno" />
      </div>
    </div>
  </div>

  <!-- PÁGINA 23: MATRIZ DE CAPACIDADES -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>6. Matriz Comparativa de Capacidades por Rol</span>
        <span class="section-tag tag-auth">RBAC / Permisos</span>
      </h2>
    </div>
    <p class="feature-desc">
      Desglose integral de facultades y permisos operativos para cada tipo de usuario dentro de la plataforma C.O.D.E:
    </p>

    <div class="table-container">
      <table class="matrix-table">
        <thead>
          <tr>
            <th>Capacidad / Módulo Operativo</th>
            <th style="text-align: center;">Admin</th>
            <th style="text-align: center;">Organizador</th>
            <th style="text-align: center;">Juez</th>
            <th style="text-align: center;">Alumno Líder</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Acceso al Panel Global (/admin)</strong></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
          </tr>
          <tr>
            <td><strong>Suspender o autorizar usuarios</strong></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
          </tr>
          <tr>
            <td><strong>Crear nuevos certámenes/eventos</strong></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
          </tr>
          <tr>
            <td><strong>Diseñar y parametrizar rúbricas</strong></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
          </tr>
          <tr>
            <td><strong>Asignar jueces a categorías/proyectos</strong></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
          </tr>
          <tr>
            <td><strong>Apertura y cierre de fases (Compuertas)</strong></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
          </tr>
          <tr>
            <td><strong>Publicar resultados oficiales</strong></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
          </tr>
          <tr>
            <td><strong>Emitir calificaciones ponderadas</strong></td>
            <td style="text-align: center;"><span class="check-no">No*</span></td>
            <td style="text-align: center;"><span class="check-no">No*</span></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
          </tr>
          <tr>
            <td><strong>Registrar equipo y subir fases (SHA-256)</strong></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
            <td style="text-align: center;"><span class="check-no">No</span></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
          </tr>
          <tr>
            <td><strong>Ver retroalimentación y dictamen oficial</strong></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
            <td style="text-align: center;"><span class="check-yes">Sí</span></td>
            <td style="text-align: center;"><span class="check-yes">Sí (Al publicar)</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="callout" style="margin-top: 15px;">
      <strong>* Flexibilidad de Rol:</strong> Los administradores y organizadores pueden autoasignarse como jueces evaluadores si requieren emitir notas o participar en el comité evaluador de forma directa.
    </div>
  </div>

  <!-- PÁGINA 24: SEGURIDAD Y FIRESTORE -->
  <div class="doc-page">
    <div class="section-header-box">
      <h2 class="section-header">
        <span>7. Arquitectura de Seguridad y Reglas de Firestore</span>
        <span class="section-tag tag-auth">Aislamiento y Reglas</span>
      </h2>
    </div>
    <p class="feature-desc">
      La plataforma C.O.D.E garantiza la integridad de datos mediante un robusto conjunto de reglas declarativas en <code>firestore.rules</code>:
    </p>

    <div class="code-box">
      <span class="code-comment">// Reglas Declarativas en Cloud Firestore</span><br>
      <span class="code-keyword">match</span> /events/{eventId}/projects/{projectId} {<br>
      &nbsp;&nbsp;<span class="code-comment">// Lectura pública o controlada para participantes del certamen</span><br>
      &nbsp;&nbsp;<span class="code-keyword">allow</span> read: <span class="code-keyword">if</span> true;<br>
      &nbsp;&nbsp;<span class="code-comment">// Creación permitida solo si las inscripciones están abiertas</span><br>
      &nbsp;&nbsp;<span class="code-keyword">allow</span> create: <span class="code-keyword">if</span> <span class="code-func">isAuthenticated</span>() && <span class="code-func">isRegistrationOpen</span>(eventId);<br>
      &nbsp;&nbsp;<span class="code-comment">// Modificación exclusiva para el Líder o Integrantes registrados</span><br>
      &nbsp;&nbsp;<span class="code-keyword">allow</span> update: <span class="code-keyword">if</span> <span class="code-func">isTeamMember</span>(resource.data) || <span class="code-func">isOrganizer</span>(eventId);<br>
      }<br><br>
      <span class="code-keyword">match</span> /events/{eventId}/projects/{projectId}/evaluations/{judgeUid} {<br>
      &nbsp;&nbsp;<span class="code-comment">// Los jueces solo pueden redactar su propia evaluación</span><br>
      &nbsp;&nbsp;<span class="code-keyword">allow</span> write: <span class="code-keyword">if</span> request.auth.uid == judgeUid && <span class="code-func">isJudgeAssigned</span>(eventId);<br>
      &nbsp;&nbsp;<span class="code-comment">// Lectura visible para alumnos solo tras la publicación oficial del dictamen</span><br>
      &nbsp;&nbsp;<span class="code-keyword">allow</span> read: <span class="code-keyword">if</span> <span class="code-func">isResultsPublished</span>(eventId) || <span class="code-func">isOrganizer</span>(eventId) || request.auth.uid == judgeUid;<br>
      }
    </div>

    <div class="callout callout-warning">
      <strong>Gobernanza Criptográfica:</strong> Ninguna entrega puede ser alterada una vez cerrado el periodo de recepción. Las huellas SHA-256 aseguran que el comité colegiado dictamine exactamente sobre los entregables remitidos en tiempo y forma, mitigando cualquier vulnerabilidad o reclamo de alteración.
    </div>

    <div style="margin-top: 30px; padding: 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center;">
      <div style="font-weight: 700; color: #0f172a; font-size: 10pt; margin-bottom: 4px;">Fin del Documento Técnico Oficial</div>
      <div style="font-size: 8pt; color: #64748b;">
        C.O.D.E · Plataforma de Evaluación de Proyectos Escolares · Proyecto code-94fbe · Octubre 2026
      </div>
    </div>
  </div>

</body>
</html>
`;

writeFileSync(OUTPUT_HTML, htmlContent, 'utf8');
console.log(`✅ Archivo HTML generado exitosamente en: ${OUTPUT_HTML}`);

// Renderizado con Google Chrome Headless a PDF
console.log('🔄 Renderizando PDF con motor Chromium Headless...');

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

try {
  execFileSync(chromePath, [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--run-all-compositor-stages-before-draw',
    '--no-pdf-header-footer',
    '--generate-pdf-document-outline',
    `--print-to-pdf=${OUTPUT_PDF}`,
    OUTPUT_HTML
  ], { stdio: 'inherit' });

  console.log(`🎉 ¡PDF generado con éxito en: ${OUTPUT_PDF}!`);
} catch (error) {
  console.error('❌ Error al ejecutar Google Chrome para generar el PDF:', error);
  process.exit(1);
}
