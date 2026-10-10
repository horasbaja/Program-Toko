import { rp, num, fdate, bendLabel, whName } from "@/lib/format";

const desc = (it) => {
  const spec = [it.brand, it.thickness, it.color].filter((v) => v && !String(it.name || "").includes(v));
  return { spec: spec.join(" · "), extra: it.is_length ? `Panjang ${num(it.length)} m · ${bendLabel(it.bend)}` : "" };
};

function Totals({ po, showPrice }) {
  const byUnit = po.items.reduce((a, it) => ({ ...a, [it.unit || "Pcs"]: (a[it.unit || "Pcs"] || 0) + Number(it.qty || 0) }), {});
  const meter = po.items.reduce((a, it) => a + Number(it.total_meter || 0), 0);
  return (
    <tfoot>
      <tr>
        <td colSpan={2} className="r"><b>TOTAL</b></td>
        <td className="r" data-testid="po-doc-total-qty"><b>{Object.entries(byUnit).map(([u, q]) => `${num(q)} ${u}`).join(", ")}</b></td>
        <td className="r"><b>{num(meter)} m</b></td>
        {showPrice && <td />}
        {showPrice && <td className="r" data-testid="po-doc-total-rp"><b>{rp(po.total)}</b></td>}
      </tr>
    </tfoot>
  );
}

export function PODoc({ po, settings = {}, warehouses = [], showPrice, paper = "a4" }) {
  const s = settings || {};
  return (
    <div className={`doc doc-po doc-po-${paper}`} data-testid="po-doc">
      <div className="flex justify-between items-start border-b-2 border-black pb-2">
        <div>
          <div className="doc-title">{s.name || "HORAS BAJA"}</div>
          <div>{s.address}</div>
          <div>Telp: {s.phone} | HP/WA: {s.wa1} / {s.wa2}</div>
        </div>
        <div className="text-right">
          <div className="po-doc-heading">PURCHASE ORDER</div>
          <div>No. PO: <b data-testid="po-doc-number">{po.po_no}</b></div>
          <div>Tanggal: <b>{fdate(po.date)}</b></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 my-2">
        <div>Kepada Supplier / Pabrik: <b>{po.supplier_name}</b></div>
        <div>Gudang Tujuan: <b>{whName(warehouses, po.warehouse)}</b></div>
        <div>Jenis PO: <b>{po.type === "indent" ? "PO Indent (Pesanan Konsumen)" : "Pembelian Manual / Restock"}</b></div>
        {po.type === "indent" && <div>Ref. Nota: <b>{po.invoice_no}</b> {po.delivery_date ? `· Rencana kirim ${fdate(po.delivery_date)}` : ""}</div>}
      </div>
      <table className="doc-table doc-items po-doc-table">
        <thead>
          <tr>
            <th>No</th><th>Deskripsi Barang</th><th className="r">Qty Fisik</th><th className="r">Total Meter</th>
            {showPrice && <th className="r">Harga Beli / HPP</th>}
            {showPrice && <th className="r">Subtotal</th>}
          </tr>
        </thead>
        <tbody>
          {po.items.map((it, i) => {
            const d = desc(it);
            return (
              <tr key={it.line_id || i}>
                <td className="c">{i + 1}</td>
                <td>
                  <div className="font-semibold">{it.name}</div>
                  {d.spec && <div className="doc-sub">{d.spec}</div>}
                  {d.extra && <div className="doc-sub">{d.extra}</div>}
                </td>
                <td className="r" data-testid={`po-doc-qty-${i}`}>{num(it.qty)} {it.unit || "Pcs"}</td>
                <td className="r">{it.is_length ? `${num(it.total_meter)} m` : "-"}</td>
                {showPrice && <td className="r">{rp(it.hpp_unit)}{it.is_length ? "/m" : ""}</td>}
                {showPrice && <td className="r">{rp(it.subtotal)}</td>}
              </tr>
            );
          })}
        </tbody>
        <Totals po={po} showPrice={showPrice} />
      </table>
      <div className="mt-2 min-h-[28px]"><b>Catatan Tambahan PO:</b> {po.notes || "-"}</div>
      <div className="grid grid-cols-3 gap-4 mt-5 text-center po-doc-sign">
        {["Dibuat Oleh", "Pemilik / Manager", "Penerima (Supplier)"].map((t) => (
          <div key={t}><div className="font-bold">{t}</div><div className="mt-12">( ........................ )</div></div>
        ))}
      </div>
    </div>
  );
}
