type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
        | { type: "file"; file: { filename: string; file_data: string } }
      >;
};

type OpenAIResponseContent = {
  type?: string;
  text?: string;
};

type OpenAIResponseOutput = {
  content?: OpenAIResponseContent[];
};

type OpenAIResponsesPayload = {
  output_text?: string;
  output?: OpenAIResponseOutput[];
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";

function getOpenAIApiKey(): string {
  const apiKey = process.env["OPENAI_API_KEY"];

  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY en los secretos.");
  }

  return apiKey;
}

function getOpenAIModel(): string {
  return process.env["OPENAI_MODEL"] || DEFAULT_OPENAI_MODEL;
}

function normalizeContent(message: OpenAIMessage) {
  if (typeof message.content === "string") {
    return [{ type: "input_text", text: message.content }];
  }

  return message.content.map((item) => {
    if (item.type === "text") {
      return { type: "input_text", text: item.text };
    }

    if (item.type === "image_url") {
      return { type: "input_image", image_url: item.image_url.url };
    }

    return {
      type: "input_file",
      filename: item.file.filename,
      file_data: item.file.file_data,
    };
  });
}

function parseResponseText(payload: OpenAIResponsesPayload): string {
  if (payload.output_text) return payload.output_text;

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => Boolean(text))
      .join("\n")
      .trim() ?? ""
  );
}

export async function createOpenAITextResponse(messages: OpenAIMessage[]): Promise<string> {
  const instructions = messages
    .filter((message) => message.role === "system")
    .map((message) => (typeof message.content === "string" ? message.content : ""))
    .filter(Boolean)
    .join("\n\n");

  const input = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role,
      content: normalizeContent(message),
    }));

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getOpenAIModel(),
      ...(instructions ? { instructions } : {}),
      input,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenAI API error [${response.status}]: ${errorText}`);
    throw new Error(`Error de OpenAI [${response.status}]: ${errorText}`);
  }

  const payload = (await response.json()) as OpenAIResponsesPayload;
  return parseResponseText(payload) || "No se pudo generar una respuesta.";
}
