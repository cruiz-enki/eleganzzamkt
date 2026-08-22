import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requiereSesion } from "@/lib/api/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/airtable";

export const AIRTABLE_BASE_ID = "appOQZvn0cvA9boUZ";
export const AIRTABLE_TABLE = "Total";

export type AirtableRecord = {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields: Record<string, any>;
};

export const getAirtableData = createServerFn({ method: "GET" })
  .middleware([requiereSesion])
  .inputValidator((data) =>
    z
      .object({
        baseId: z.string().default(AIRTABLE_BASE_ID),
        table: z.string().default(AIRTABLE_TABLE),
        maxRecords: z.number().int().positive().max(100).default(50),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<AirtableRecord[]> => {
    const lovableApiKey = process.env["LOVABLE_API_KEY"];
    const airtableApiKey = process.env["AIRTABLE_API_KEY"];

    if (!lovableApiKey || !airtableApiKey) {
      throw new Error("Airtable connector is not configured");
    }

    const url = `${GATEWAY_URL}/v0/${encodeURIComponent(data.baseId)}/${encodeURIComponent(
      data.table,
    )}?maxRecords=${data.maxRecords}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": airtableApiKey,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Airtable gateway failed [${response.status}]: ${errorBody}`);
      throw new Error(`Airtable request failed [${response.status}]: ${errorBody}`);
    }

    const payload = (await response.json()) as { records?: AirtableRecord[] };
    return (payload.records ?? []).map((record) => ({
      id: record.id,
      fields: record.fields,
    }));
  });
