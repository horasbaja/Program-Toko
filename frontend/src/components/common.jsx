import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STATUS } from "@/lib/format";

export const Sel = ({ value, onChange, options, testid, className = "", placeholder }) => (
  <select
    data-testid={testid}
    value={value ?? ""}
    onChange={(e) => onChange(e.target.value)}
    className={`h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
  >
    {placeholder !== undefined && <option value="">{placeholder}</option>}
    {options.map((o) =>
      typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>
    )}
  </select>
);

export const Field = ({ label, children, className = "" }) => (
  <label className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
    <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
    {children}
  </label>
);

export function StatusDot({ status, testid }) {
  const [open, setOpen] = useState(false);
  const s = STATUS[status] || STATUS.ready;
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid={testid}
          aria-label={s.label}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-secondary transition-colors"
        >
          <span className="status-dot" style={{ background: s.color, boxShadow: `0 0 0 3px ${s.color}33` }} />
        </button>
      </TooltipTrigger>
      <TooltipContent data-testid={testid ? `${testid}-label` : undefined}>{s.label}</TooltipContent>
    </Tooltip>
  );
}

export const PageHeader = ({ title, subtitle, children }) => (
  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6 fade-up">
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">HORAS BAJA / {subtitle}</p>
      <h1 className="font-heading text-3xl sm:text-4xl font-bold uppercase tracking-tight">{title}</h1>
    </div>
    {children && <div className="flex flex-wrap gap-2">{children}</div>}
  </div>
);

export const Stat = ({ label, value, icon: Icon, sub, testid, tone = "text-foreground" }) => (
  <div className="panel p-4 sm:p-5 fade-up" data-testid={testid}>
    <div className="flex items-center justify-between">
      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {Icon && <Icon className="h-4 w-4 text-primary" />}
    </div>
    <div className={`mt-2 font-mono text-xl sm:text-2xl font-semibold ${tone}`}>{value}</div>
    {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
  </div>
);

export const ModeTag = ({ mode, wh }) =>
  mode === "indent" ? (
    <span className="tag tag-indent">[INDENT - PO PABRIK]</span>
  ) : (
    <span className="tag tag-ready">READY {wh ? `· ${wh}` : ""}</span>
  );

export const Empty = ({ text = "Belum ada data" }) => (
  <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>
);
