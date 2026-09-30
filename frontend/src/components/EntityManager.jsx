import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { rp } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Sel, Empty } from "@/components/common";

function Cell({ f, r }) {
  if (f.render) return f.render(r);
  const v = r[f.key];
  if (f.type === "switch") return v ? "Ya" : "Tidak";
  if (f.money) return <span className="font-mono">{rp(v)}</span>;
  return v ?? "-";
}

function FormField({ f, value, onChange, isNew }) {
  const tid = `form-${f.key}`;
  if (f.type === "select") return <Sel testid={tid} value={value} onChange={onChange} options={f.options} placeholder={f.placeholder} />;
  if (f.type === "switch") return <Switch data-testid={tid} checked={!!value} onCheckedChange={onChange} />;
  if (f.type === "textarea") return <Textarea data-testid={tid} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  return (
    <Input data-testid={tid} type={f.type || "text"} value={value ?? ""} disabled={f.createOnly && !isNew}
      placeholder={f.placeholder} onChange={(e) => onChange(f.type === "number" ? e.target.value : e.target.value)} />
  );
}

export default function EntityManager({ endpoint, fields, testid, title = "Data", canWrite = true, canDelete = true, filter, defaults = {}, onChanged }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [fv, setFv] = useState("");
  const [edit, setEdit] = useState(null);

  const load = useCallback(() => api.get(endpoint).then((r) => setRows(r.data)).catch((e) => toast.error(errMsg(e))), [endpoint]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      const body = { ...edit };
      fields.filter((f) => f.type === "number").forEach((f) => { if (body[f.key] !== undefined) body[f.key] = Number(body[f.key]) || 0; });
      if (edit.id) await api.put(`${endpoint}/${edit.id}`, body);
      else await api.post(endpoint, body);
      toast.success(`${title} tersimpan`);
      setEdit(null);
      load();
      onChanged?.();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const del = async (r) => {
    if (!window.confirm(`Hapus ${r.name || r.username || "data"}?`)) return;
    try { await api.delete(`${endpoint}/${r.id}`); toast.success("Dihapus"); load(); onChanged?.(); } catch (e) { toast.error(errMsg(e)); }
  };

  const shown = rows
    .filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()))
    .filter((r) => !filter || !fv || r[filter.key] === fv);

  return (
    <div className="panel" data-testid={testid}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input data-testid={`${testid}-search`} className="pl-9" placeholder="Cari..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {filter && <Sel testid={`${testid}-filter`} value={fv} onChange={setFv} options={filter.options} placeholder={filter.label} />}
        {canWrite && (
          <Button data-testid={`${testid}-add-button`} onClick={() => setEdit({ ...defaults })} className="gap-2"><Plus className="h-4 w-4" /> Tambah</Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="dtable">
          <thead><tr>{fields.filter((f) => f.table !== false).map((f) => <th key={f.key}>{f.label}</th>)}{canWrite && <th className="text-right">Aksi</th>}</tr></thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id || i} data-testid={`${testid}-row-${i}`}>
                {fields.filter((f) => f.table !== false).map((f) => <td key={f.key}><Cell f={f} r={r} /></td>)}
                {canWrite && (
                  <td className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" data-testid={`${testid}-edit-${i}`} onClick={() => setEdit({ ...r })}><Pencil className="h-4 w-4" /></Button>
                    {canDelete && <Button size="icon" variant="ghost" data-testid={`${testid}-delete-${i}`} onClick={() => del(r)}><Trash2 className="h-4 w-4 text-red-400" /></Button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <Empty />}
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading text-2xl uppercase">{edit?.id ? "Edit" : "Tambah"} {title}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            {edit && fields.filter((f) => !f.readOnly).map((f) => (
              <Field key={f.key} label={f.label}>
                <FormField f={f} value={edit[f.key]} isNew={!edit.id} onChange={(v) => setEdit({ ...edit, [f.key]: v })} />
              </Field>
            ))}
          </div>
          <Button data-testid={`${testid}-save-button`} onClick={save} className="mt-2">Simpan</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
