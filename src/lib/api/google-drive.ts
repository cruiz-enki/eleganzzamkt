const DRIVE_API_URL = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_ROOT_FOLDER_ID = "0AKMhdlaXwPtQUk9PVA";

type DriveToken = {
  accessToken: string;
  expiresAt: number;
};

type DriveFile = {
  id?: string;
  name?: string;
  mimeType?: string;
  nextPageToken?: string;
  files?: DriveFile[];
};

let cachedToken: DriveToken | null = null;

export function getDriveRootFolderId(): string {
  return process.env["GOOGLE_DRIVE_ROOT_FOLDER_ID"] || DEFAULT_ROOT_FOLDER_ID;
}

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

type ServiceAccount = { clientEmail: string; privateKey: string };

/**
 * Credenciales de la CUENTA DE SERVICIO (método preferido).
 * Acepta el JSON completo que descarga Google (`GOOGLE_SERVICE_ACCOUNT_JSON`)
 * o los dos campos por separado. A diferencia del refresh token de OAuth,
 * estas credenciales no caducan.
 */
function getServiceAccount(): ServiceAccount | null {
  const raw = process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
  if (raw && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
      if (parsed.client_email && parsed.private_key) {
        return {
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, "\n"),
        };
      }
    } catch {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido. Pega el archivo completo que descargaste de Google.",
      );
    }
  }

  const clientEmail = process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"];
  const privateKey = process.env["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"];
  if (clientEmail && privateKey) {
    return { clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") };
  }

  return null;
}

function getGoogleOAuthEnv() {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
  const refreshToken = process.env["GOOGLE_REFRESH_TOKEN"];

  if (!clientId) throw new Error("Falta GOOGLE_CLIENT_ID en los secretos.");
  if (!clientSecret) throw new Error("Falta GOOGLE_CLIENT_SECRET en los secretos.");
  if (!refreshToken) throw new Error("Falta GOOGLE_REFRESH_TOKEN en los secretos.");

  return { clientId, clientSecret, refreshToken };
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Firma el JWT que Google pide para intercambiarlo por un access token
 * (flujo "JWT bearer" de las cuentas de servicio).
 * El import de node:crypto es dinámico para que no acabe en el bundle del navegador.
 */
async function signServiceAccountJwt(account: ServiceAccount): Promise<string> {
  const { createSign } = await import("node:crypto");
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.clientEmail,
      scope: DRIVE_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(account.privateKey));

  return `${header}.${claims}.${signature}`;
}

async function requestToken(body: URLSearchParams): Promise<{ token: string; expiresIn: number }> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(
      `No se pudo autenticar con Google Drive [${response.status}]: ${await response.text()}`,
    );
  }

  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Google no devolvió access_token.");

  return { token: json.access_token, expiresIn: json.expires_in ?? 3600 };
}

/** Qué método de conexión con Drive está configurado hoy. */
export function getDriveAuthMethod(): "service_account" | "oauth_refresh_token" | "none" {
  if (getServiceAccount()) return "service_account";
  if (process.env["GOOGLE_REFRESH_TOKEN"]) return "oauth_refresh_token";
  return "none";
}

async function getDriveAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.accessToken;
  }

  // 1) Cuenta de servicio si está configurada (no caduca).
  // 2) Si no, el flujo viejo de OAuth con refresh token.
  const account = getServiceAccount();
  const { token, expiresIn } = account
    ? await requestToken(
        new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: await signServiceAccountJwt(account),
        }),
      )
    : await (async () => {
        const { clientId, clientSecret, refreshToken } = getGoogleOAuthEnv();
        return requestToken(
          new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
        );
      })();

  cachedToken = { accessToken: token, expiresAt: Date.now() + expiresIn * 1000 };
  return cachedToken.accessToken;
}

export async function fetchWithTimeout(url: string, init: RequestInit, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function driveHeaders(contentType = "application/json") {
  return {
    Authorization: `Bearer ${await getDriveAccessToken()}`,
    "Content-Type": contentType,
  };
}

export async function driveRequest(path: string, init: RequestInit = {}, ms = 15000) {
  const headers = await driveHeaders();
  const response = await fetchWithTimeout(
    `${DRIVE_API_URL}${path}`,
    {
      ...init,
      headers: {
        ...headers,
        ...(init.headers ?? {}),
      },
    },
    ms,
  );

  if (!response.ok) {
    throw new Error(`Google Drive error [${response.status}]: ${await response.text()}`);
  }

  return response;
}

/**
 * Verifica que la conexión con Google Drive funcione (token OAuth vigente y
 * carpeta raíz accesible). Se usa como chequeo previo a las importaciones para
 * no crear productos sin imágenes cuando Drive no está disponible.
 */
export async function checkDriveAccess(): Promise<{ ok: boolean; message?: string }> {
  try {
    await driveRequest(
      `/files/${getDriveRootFolderId()}?supportsAllDrives=true&fields=id,name`,
      { method: "GET" },
      15000,
    );
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const method = getDriveAuthMethod();

    if (method === "none") {
      return {
        ok: false,
        message:
          "No hay credenciales de Google Drive configuradas. Agrega GOOGLE_SERVICE_ACCOUNT_JSON (cuenta de servicio) a las variables de entorno.",
      };
    }
    if (raw.includes("invalid_grant") || raw.includes("expired or revoked")) {
      return {
        ok: false,
        message:
          method === "service_account"
            ? "Google rechazó la cuenta de servicio. Revisa que la llave privada esté completa y que la hora del servidor sea correcta."
            : "El permiso de Google Drive expiró o fue revocado. Conviene cambiar a una cuenta de servicio (GOOGLE_SERVICE_ACCOUNT_JSON), que no caduca.",
      };
    }
    if (raw.includes("404") || raw.includes("notFound")) {
      return {
        ok: false,
        message:
          method === "service_account"
            ? "La cuenta de servicio no ve la carpeta de Drive. Compártele la unidad compartida con permiso de Administrador de contenido."
            : "No se encontró la carpeta raíz de Drive (GOOGLE_DRIVE_ROOT_FOLDER_ID).",
      };
    }
    return { ok: false, message: raw };
  }
}

export async function createDriveFolder(name: string): Promise<string | null> {
  try {
    const response = await driveRequest("/files?supportsAllDrives=true", {
      method: "POST",
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [getDriveRootFolderId()],
      }),
    });
    const data = (await response.json()) as DriveFile;
    return data.id ?? null;
  } catch (error) {
    console.error("Error creating Drive folder:", error);
    return null;
  }
}

/**
 * Busca una carpeta por nombre dentro de la raíz y la crea si no existe.
 * Se usa para agrupar archivos que no son de un producto (p. ej. las
 * publicaciones de redes), sin ensuciar la raíz de la unidad.
 */
export async function findOrCreateFolder(name: string): Promise<string | null> {
  const rootId = getDriveRootFolderId();
  try {
    const params = new URLSearchParams({
      q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${name.replace(/'/g, "\\'")}' and trashed = false`,
      fields: "files(id,name)",
      pageSize: "1",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      corpora: "allDrives",
    });
    const response = await driveRequest(`/files?${params.toString()}`, { method: "GET" }, 15000);
    const data = (await response.json()) as DriveFile;
    const existing = data.files?.[0]?.id;
    if (existing) return existing;
  } catch (error) {
    console.error(`No se pudo buscar la carpeta ${name}:`, error);
  }

  return createDriveFolder(name);
}

export async function uploadBase64ToDrive(input: {
  fileName: string;
  mimeType: string;
  base64: string;
  folderId?: string | null;
}) {
  const targetFolderId = input.folderId || getDriveRootFolderId();
  const boundary = `eleganzza${Math.random().toString(16).slice(2)}`;
  const metadata = JSON.stringify({
    name: input.fileName,
    parents: [targetFolderId],
  });
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${input.mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${input.base64}\r\n` +
    `--${boundary}--`;

  const response = await fetchWithTimeout(
    `${DRIVE_UPLOAD_URL}/files?uploadType=multipart&supportsAllDrives=true`,
    {
      method: "POST",
      headers: await driveHeaders(`multipart/related; boundary=${boundary}`),
      body,
    },
    45000,
  );

  if (!response.ok) {
    throw new Error(`Error al subir a Drive [${response.status}]: ${await response.text()}`);
  }

  const uploaded = (await response.json()) as DriveFile;
  if (!uploaded.id) throw new Error("Drive no devolvió el ID del archivo.");

  await makeDrivePublic(uploaded.id);

  return {
    id: uploaded.id,
    url: `https://lh3.googleusercontent.com/d/${uploaded.id}=w1000`,
  };
}

export async function makeDrivePublic(fileId: string) {
  try {
    await driveRequest(
      `/files/${fileId}/permissions?supportsAllDrives=true`,
      {
        method: "POST",
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      },
      15000,
    );
  } catch (error) {
    console.error(`No se pudo hacer público el archivo ${fileId}:`, error);
  }
}

export async function listDriveImages(
  folderId: string,
): Promise<Array<{ id: string; url: string }>> {
  const results: Array<{ id: string; url: string }> = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: "nextPageToken, files(id,name,mimeType)",
      pageSize: "200",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      corpora: "allDrives",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await driveRequest(`/files?${params.toString()}`, { method: "GET" }, 30000);
    const json = (await response.json()) as DriveFile;

    for (const file of json.files ?? []) {
      if (file.id)
        results.push({ id: file.id, url: `https://lh3.googleusercontent.com/d/${file.id}=w1000` });
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  for (const file of results) {
    await makeDrivePublic(file.id);
  }

  return results;
}

export async function downloadDriveFile(fileId: string): Promise<ArrayBuffer> {
  const response = await driveRequest(
    `/files/${fileId}?alt=media&supportsAllDrives=true`,
    { method: "GET", headers: { "Content-Type": "" } },
    45000,
  );
  return response.arrayBuffer();
}
