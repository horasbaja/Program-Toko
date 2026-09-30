import { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const PrintCtx = createContext(null);
const PAGE = { thermal: "@page{size:80mm auto;margin:2mm}", standard: "@page{size:A5 portrait;margin:8mm}", sj: "@page{size:A5 landscape;margin:7mm}" };

export function PrintProvider({ children }) {
  const [doc, setDoc] = useState(null);
  return (
    <PrintCtx.Provider value={setDoc}>
      {children}
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
