import { MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useData } from "@/context/DataContext";
import { usePrint } from "@/components/PrintProvider";
import { waLink } from "@/lib/format";
import { Nota } from "./Nota";
import { SuratJalan } from "./SuratJalan";
import { PODoc } from "./PODoc";
import { useAuth } from "@/context/AuthContext";

const LABEL = { thermal58: "Thermal 58mm", thermal80: "Thermal 80mm", a4: "Printer Biasa · A4", f4: "Printer Biasa · F4" };

export function useDocs() {
  const { setDoc, choose } = usePrint();
  const { isAdmin } = useAuth();
  const { settings, warehouses } = useData();
  const sendWA = (sale) => window.open(waLink(sale, settings), "_blank");
  const printNota = (sale) => choose({ title: `Cetak Nota ${sale.invoice_no}`, onPick: (v) => openNota(sale, v) });
  const openNota = (sale, variant) =>
    setDoc({
      type: variant, autoPrint: true, title: `Nota ${sale.invoice_no} · ${LABEL[variant]}`,
      node: <Nota sale={sale} settings={settings} variant={variant} />,
      extra: (
        <>
          <Button variant="secondary" className="gap-2" data-testid="nota-change-printer" onClick={() => printNota(sale)}>
            <Printer className="h-4 w-4" /> Ganti Printer
          </Button>
          <Button variant="secondary" className="gap-2" data-testid="nota-send-wa" onClick={() => sendWA(sale)}>
            <MessageCircle className="h-4 w-4" /> Kirim WA
          </Button>
        </>
      ),
    });
  const printSJ = (sale, delivery) =>
    setDoc({ type: "sj", title: `Surat Jalan ${delivery.sj_no}`, node: <SuratJalan sale={sale} delivery={delivery} settings={settings} warehouses={warehouses} /> });
  const printPO = (po, paper = "a4") =>
    setDoc({
      type: `po_${paper}`, title: `Cetak PO ${po.po_no} · ${paper.toUpperCase()}`,
      node: <PODoc po={po} settings={settings} warehouses={warehouses} showPrice={isAdmin} paper={paper} />,
      extra: (
        <Button variant="secondary" data-testid="po-doc-paper-toggle" onClick={() => printPO(po, paper === "a4" ? "a5" : "a4")}>
          Ganti ke {paper === "a4" ? "A5" : "A4"}
        </Button>
      ),
    });
  return { printNota, printSJ, sendWA, printPO };
}
