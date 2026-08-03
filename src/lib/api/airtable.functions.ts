import Airtable from 'airtable';
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getAirtableData = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ baseId: z.string(), table: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env['AIRTABLE_API_KEY'];
    
    if (!apiKey) {
      // Mock data para desarrollo si no hay API Key
      return [
        { id: '1', fields: { Nombre: 'Sofá Velvet', Categoria: 'Salas', Precio: 15000, Stock: 5 } },
        { id: '2', fields: { Nombre: 'Mesa Roble', Categoria: 'Comedor', Precio: 8500, Stock: 3 } },
        { id: '3', fields: { Nombre: 'Cama King', Categoria: 'Recámara', Precio: 22000, Stock: 2 } },
      ];
    }

    const base = new Airtable({ apiKey }).base(data.baseId);
    try {
      const records = await base(data.table).select({ maxRecords: 10 }).all();
      return records.map(record => ({
        id: record.id,
        fields: record.fields
      }));
    } catch (error) {
      console.error("Airtable Error:", error);
      throw new Error("Error fetching Airtable data");
    }
  });
