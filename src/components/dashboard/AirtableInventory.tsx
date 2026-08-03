import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getAirtableData, type AirtableRecord } from "@/lib/api/airtable.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Database, Search } from "lucide-react";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function AirtableInventory() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: records } = useSuspenseQuery({
    queryKey: ['airtable-inventory'],
    queryFn: () => getAirtableData({ data: {} }),
  });

  const filteredRecords = (records as AirtableRecord[]).filter((r) =>
    Object.values(r.fields).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );


  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en inventario..."
            className="pl-8 bg-white/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button size="sm" variant="outline" className="h-9">
          <Database className="h-4 w-4 mr-2" />
          Sync
        </Button>
      </div>

      <div className="rounded-md border border-slate-100 bg-white/30 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="text-[10px] uppercase font-bold text-slate-400">Nombre</TableHead>
              <TableHead className="text-[10px] uppercase font-bold text-slate-400">Categoría</TableHead>
              <TableHead className="text-[10px] uppercase font-bold text-slate-400 text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" />
                </TableCell>
              </TableRow>
            ) : filteredRecords?.map((record: any) => (
              <TableRow key={record.id} className="hover:bg-slate-50/30 transition-colors">
                <TableCell className="font-medium text-slate-700 py-3">{record.fields.Nombre}</TableCell>
                <TableCell className="text-slate-500 py-3">{record.fields.Categoria}</TableCell>
                <TableCell className="text-right text-slate-600 py-3">{record.fields.Stock}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
