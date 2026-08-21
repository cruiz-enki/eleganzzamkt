/**
 * Verifica la conexión con Google Drive leyendo .env.local.
 *
 *   node scripts/verificar-drive.mjs
 *
 * Prueba primero la cuenta de servicio (GOOGLE_SERVICE_ACCOUNT_JSON) y, si no
 * está configurada, el método viejo de OAuth con refresh token. Solo lee: no
 * crea ni borra nada en Drive.
 */
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

function loadEnv(file = ".env.local") {
  const env = {};
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    console.error(`No pude leer ${file}`);
    process.exit(1);
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[trimmed.slice(0, eq).trim()] = value;
  }
  return env;
}

const b64url = (input) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function tokenFromServiceAccount(json) {
  const account = JSON.parse(json);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: DRIVE_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${b64url(signer.sign(account.private_key.replace(/\\n/g, "\n")))}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  return { res, quien: account.client_email };
}

async function tokenFromRefreshToken(env) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  return { res, quien: env.GOOGLE_CLIENT_ID };
}

const env = loadEnv();
const usaCuentaDeServicio = Boolean(env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim());

console.log(`Método: ${usaCuentaDeServicio ? "cuenta de servicio" : "OAuth (refresh token)"}`);

const { res, quien } = usaCuentaDeServicio
  ? await tokenFromServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON)
  : await tokenFromRefreshToken(env);

if (!res.ok) {
  console.error(`\n❌ Google rechazó las credenciales [${res.status}]:`);
  console.error(await res.text());
  process.exit(1);
}

const { access_token: accessToken } = await res.json();
console.log(`✅ Autenticado como: ${quien}`);

const folderId = env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
const folderRes = await fetch(
  `https://www.googleapis.com/drive/v3/files/${folderId}?supportsAllDrives=true&fields=id,name,mimeType,driveId,capabilities(canAddChildren)`,
  { headers: { Authorization: `Bearer ${accessToken}` } },
);

if (!folderRes.ok) {
  console.error(`\n❌ La cuenta se autenticó, pero NO ve la carpeta ${folderId} [${folderRes.status}]:`);
  console.error(await folderRes.text());
  console.error(
    "\nSi usas cuenta de servicio: comparte la unidad compartida de Drive con el correo de arriba,\ncon permiso de Administrador de contenido.",
  );
  process.exit(1);
}

const folder = await folderRes.json();
console.log(`✅ Carpeta visible: "${folder.name}" (${folder.id})`);
console.log(
  folder.capabilities?.canAddChildren
    ? "✅ Puede crear carpetas y subir fotos ahí. Todo listo."
    : "⚠️  La ve, pero NO tiene permiso para crear archivos. Súbele el permiso a Administrador de contenido.",
);
