import { useState } from "react";
import { useData } from "@/context/DataContext";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Sel } from "@/components/common";
import { CUSTOMER_TYPES } from "@/lib/format";

export function CustomerForm({ customer, setCustomer, save, setSave }) {
  const { customers } = useData();
  const [open, setOpen] = useState(false);
  const q = (customer.name || "").toLowerCase();
  const matches = q ? customers.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(q)).slice(0, 6) : [];
  const set = (k, v) => setCustomer({ ...customer, [k]: v, ...(k === "name" ? { id: undefined } : {}) });
  return (
    <div className="grid gap-3">
      <div className="relative">
        <Field label="Nama Pelanggan (auto-complete)">
          <Input data-testid="pos-customer-name" value={customer.name || ""} placeholder="Pelanggan Umum / CASH"
            onChange={(e) => { set("name", e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 180)} />
        </Field>
        {open && matches.length > 0 && (
          <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-popover shadow-xl" data-testid="pos-customer-suggestions">
            {matches.map((c, i) => (
              <button key={c.id} type="button" data-testid={`pos-customer-option-${i}`} onMouseDown={() => { setCustomer({ ...c }); setOpen(false); }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary">
                <span>{c.name}<span className="block text-xs text-muted-foreground">{c.phone} · {c.type}</span></span>
                {c.status && <span className="tag tag-ready">{c.status}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="No. HP / WA"><Input data-testid="pos-customer-phone" value={customer.phone || ""} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></Field>
        <Field label="Tipe"><Sel testid="pos-customer-type" value={customer.type || "Umum"} onChange={(v) => setCustomer({ ...customer, type: v })} options={CUSTOMER_TYPES} /></Field>
      </div>
      <Field label="Alamat Kirim"><Input data-testid="pos-customer-address" value={customer.address || ""} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} /></Field>
      {customer.id ? (
        <div className="text-xs text-emerald-400" data-testid="pos-customer-selected">Pelanggan terdaftar {customer.status ? `· Status ${customer.status}` : ""}</div>
      ) : (
        <div className="grid grid-cols-[auto_1fr] items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox data-testid="pos-save-customer-checkbox" checked={save} onCheckedChange={(c) => setSave(!!c)} /> Simpan ke Database Pelanggan
          </label>
          {save && <Input data-testid="pos-customer-status" placeholder="Status (N / R / VVIP)" value={customer.status || ""} onChange={(e) => setCustomer({ ...customer, status: e.target.value })} className="h-9" />}
        </div>
      )}
    </div>
  );
}
