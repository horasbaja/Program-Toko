import { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Printer, ReceiptText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const PrintCtx = createContext(null);
const PAGE = {
  thermal58: "@page{size:58mm auto;margin:0}",
  thermal80: "@page{size:80mm auto;margin:0}",
  a4: "@page{size:A4 portrait;margin:12mm}",
  f4: "@page{size:210mm 330mm;margin:12mm}",
  sj: "@page{size:A5 landscape;margin:7mm}",
  po_a4: "@page{size:A4 portrait;margin:10mm}",
  po_a5: "@page{size:A5 portrait;margin:6mm}",
};

const OptBtn = ({ id, label, sub, onPick }) => (
  <button data-testid={`printer-option-${id}`} onClick={() => onPick(id)}
    className="pill h-auto flex-col items-start gap-0.5 py-3 text-left hover:border-primary">
    <span className="font-mono text-base font-semibold">{label}</span>
    <span className="text-xs text-muted-foreground">{sub}</span>
  </button>
);

function PrinterChooser({ chooser, onClose }) {
  const pick = (v) => { onClose(); chooser.onPick(v); };
  return (
    <Dialog open={!!chooser} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" data-testid="printer-chooser-dialog">
        <DialogHeader><DialogTitle className="font-heading text-2xl uppercase">{chooser?.title || "Pilih Printer"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="panel p-3" data-testid="printer-group-thermal">
            <div className="mb-1 flex items-center gap-2 font-heading text-lg uppercase"><ReceiptText className="h-4 w-4 text-primary" /> Printer Thermal</div>
            <p className="mb-3 text-xs text-muted-foreground">Format struk kasir sempit, tanpa margin besar</p>
            <div className="grid grid-cols-2 gap-2">
              <OptBtn id="thermal58" label="58 mm" sub="Struk kecil" onPick={pick} />
              <OptBtn id="thermal80" label="80 mm" sub="Struk standar" onPick={pick} />
            </div>
          </div>
          <div className="panel p-3" data-testid="printer-group-regular">
            <div className="mb-1 flex items-center gap-2 font-heading text-lg uppercase"><FileText className="h-4 w-4 text-primary" /> Printer Biasa (SmartTank)</div>
            <p className="mb-3 text-xs text-muted-foreground">Faktur lengkap ukuran kertas besar</p>
            <div className="grid grid-cols-2 gap-2">
              <OptBtn id="a4" label="A4" sub="210 × 297 mm" onPick={pick} />
              <OptBtn id="f4" label="F4" sub="210 × 330 mm (Folio)" onPick={pick} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PrintProvider({ children }) {
  const [doc, setDoc] = useState(null);
  const [chooser, setChooser] = useState(null);
  useEffect(() => {
    if (!doc?.autoPrint) return undefined;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [doc]);
  return (
    <PrintCtx.Provider value={{ setDoc, choose: setChooser }}>
      {children}
      <PrinterChooser chooser={chooser} onClose={() => setChooser(null)} />
      <Dialog open={!!doc} onOpenChange={(o) => !o && setDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto" data-testid="print-preview-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl uppercase tracking-wide">{doc?.title || "Pratinjau Cetak"}</DialogTitle>
          </DialogHeader>
          <div className="bg-slate-300/10 p-4 rounded-md flex justify-center overflow-x-auto">
            <div className="paper shadow-2xl">{doc?.node}</div>
          </div>
          <div className="flex justify-end gap-2">
            {doc?.extra}
            <Button data-testid="print-now-button" onClick={() => window.print()} className="gap-2">
              <Printer className="h-4 w-4" /> Cetak Sekarang
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {doc && createPortal(<div id="print-root"><style>{PAGE[doc.type] || PAGE.standard}</style>{doc.node}</div>, document.body)}
    </PrintCtx.Provider>
  );
}

export const usePrint = () => useContext(PrintCtx);
