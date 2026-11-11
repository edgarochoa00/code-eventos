import assert from "node:assert/strict";

// Usa las URLs normales: una query aleatoria ocultaría una página vieja en la CDN.
const origin = new URL(process.argv[2] ?? "https://feria2026.web.app");
const routes = ["/", "/login", "/acceso", "/panel", "/panel/perfil", "/panel/privacidad", "/admin", "/eventos/nuevo", "/terminos", "/privacidad", "/cookies", "/versiones"];
const assets = new Set();

async function request(path) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(20_000) });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  return response;
}

try {
  for (const path of routes) {
    const response = await request(path);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/i, `${path}: se esperaba HTML`);
    assert.match(response.headers.get("cache-control") ?? "", /(?:^|,)\s*no-store\s*(?:,|$)/i, `${path}: falta Cache-Control no-store`);
    const html = await response.text();
    assert.match(html, /<title>[^<]*Feria 2026[^<]*<\/title>/i, `${path}: nombre de la feria incorrecto`);
    assert.doesNotMatch(html, /Feria 2027/i, `${path}: sigue apareciendo el nombre anterior`);
    const paths = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"?]+\.(?:js|css)(?:\?[^"\s]*)?)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
    assert.ok(paths.some((asset) => new URL(asset, origin).pathname.endsWith(".css")), `${path}: falta la hoja de estilos`);
    assert.ok(paths.some((asset) => new URL(asset, origin).pathname.endsWith(".js")), `${path}: falta JavaScript`);
    paths.forEach((asset) => assets.add(asset));
    console.log(`OK ${path}: HTML sin caché`);
  }

  const results = await Promise.allSettled([...assets].map(async (path) => {
    const response = await request(path);
    const css = new URL(path, origin).pathname.endsWith(".css");
    assert.match(response.headers.get("content-type") ?? "", css ? /text\/css/i : /(?:application|text)\/javascript/i, `${path}: tipo de archivo incorrecto`);
    assert.match(response.headers.get("cache-control") ?? "", /\bimmutable\b/i, `${path}: se perdió la caché de archivos con hash`);
    assert.ok((await response.text()).length > 0, `${path}: archivo vacío`);
  }));
  const errors = results.filter((result) => result.status === "rejected").map((result) => result.reason);
  if (errors.length) throw new AggregateError(errors, errors.map((error) => error.message).join("\n"));
  console.log(`OK ${assets.size} archivos JavaScript/CSS disponibles y con caché immutable en ${origin.origin}`);
  console.log("Completar con una prueba de navegador sin sesión: esta comprobación HTTP no ejecuta JavaScript.");
} catch (error) {
  console.error(`Falló la comprobación del despliegue: ${error.message}`);
  process.exitCode = 1;
}
