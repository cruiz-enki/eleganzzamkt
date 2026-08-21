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

function getGoogleOAuthEnv() {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
  const refreshToken = process.env["GOOGLE_REFRESH_TOKEN"];

  if (!clientId) throw new Error("Falta GOOGLE_CLIENT_ID en los secretos.");
  if (!clientSecret) throw new Error("Falta GOOGLE_CLIENT_SECRET en los secretos.");
  if (!refreshToken) throw new Error("Falta GOOGLE_REFRESH_TOKEN en los secretos.");

  return { clientId, clientSecret, refreshToken };
}

async function getDriveAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.accessToken;
  }

  const { clientId, clientSecret, refreshToken } = getGoogleOAuthEnv();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(
      `No se pudo autenticar con Google Drive [${response.status}]: ${await response.text()}`,
    );
  }

  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Google no devolvió access_token.");

  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
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
    if (raw.includes("invalid_grant") || raw.includes("expired or revoked")) {
      return {
        ok: false,
        message:
          "El permiso de Google Drive expiró o fue revocado. Hay que generar un GOOGLE_REFRESH_TOKEN nuevo y actualizarlo en las variables de entorno.",
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
