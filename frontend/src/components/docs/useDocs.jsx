import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useData } from "@/context/DataContext";
import { usePrint } from "@/components/PrintProvider";
import { waLink } from "@/lib/format";
import { Nota } from "./Nota";
import { SuratJalan } from "./SuratJalan";

export function useDocs() {
  const setDoc = usePrint();
  const { settings, warehouses } = useData();
  const sendWA = (sale) => window.open(waLink(sale, settings), "_blank");
  const printNota = (sale, variant = "thermal") =>
    setDoc({
      type: variant, title: `Nota ${sale.invoice_no}`,
      node: <Nota sale={sale} settings={settings} variant={variant} />,
      extra: (
        <>
          <Button variant="secondary" data-testid="nota-variant-toggle" onClick={() => printNota(sale, variant === "thermal" ? "standard" : "thermal")}>
            {variant === "thermal" ? "Format Standard" : "Format Thermal 80mm"}
          </Button>
          <Button variant="secondary" className="gap-2" data-testid="nota-send-wa" onClick={() => sendWA(sale)}>
            <MessageCircle className="h-4 w-4" /> Kirim WA
          </Button>
        </>
      ),
    });
  const printSJ = (sale, delivery) =>
    setDoc({ type: "sj", title: `Surat Jalan ${delivery.sj_no}`, node: <SuratJalan sale={sale} delivery={delivery} settings={settings} warehouses={warehouses} /> });
  return { printNota, printSJ, sendWA };
}
