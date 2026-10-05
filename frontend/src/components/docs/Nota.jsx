import { rp, num, fdate, lineQty, bendLabel } from "@/lib/format";

const Row = ({ l, r, b }) => (
  <div className={`flex justify-between gap-2 ${b ? "font-bold" : ""}`}>
    <span>{l}</span>
    <span className="text-right whitespace-nowrap">{r}</span>
  </div>
);

function ItemsTable({ items }) {
  return (
    <table className="doc-table doc-items" data-testid="nota-items-table">
      <thead>
        <tr><th>No</th><th>Nama Barang</th><th className="r">Qty</th><th>Satuan</th><th className="r">Harga Satuan</th><th className="r">Disc</th><th className="r">Total</th></tr>
      </thead>
      <tbody>
        {items.map((it, i) => {
          const unitPrice = it.is_length ? Number(it.price) * Number(it.length) : Number(it.price);
          return [
            <tr key={it.line_id || i}>
              <td className="c">{i + 1}</td>
              <td>{it.name}{it.is_length && <div className="doc-sub">{num(it.length)} m/{it.unit} · Total {num(it.total_meter)} m · @{rp(it.price)}/m · {bendLabel(it.bend)}</div>}</td>
              <td className="r">{num(it.qty)}</td>
              <td>{it.unit}</td>
              <td className="r">{rp(unitPrice)}</td>
              <td className="r">{Number(it.discount) > 0 ? rp(it.discount) : ""}</td>
              <td className="r">{rp(it.subtotal)}</td>
            </tr>,
            it.bend_subtotal > 0 && (
              <tr key={`${it.line_id || i}-bend`} className="doc-bend-row">
                <td />
                <td>Rincian Upah Lengkung: {num(it.qty)} {it.unit} x {rp(it.bend_fee)}</td>
                <td className="r">{num(it.qty)}</td>
                <td>{it.unit}</td>
                <td className="r">{rp(it.bend_fee)}</td>
                <td />
                <td className="r">{rp(it.bend_subtotal)}</td>
              </tr>
            ),
          ];
        })}
      </tbody>
    </table>
  );
}

function ItemsList({ items }) {
  return items.map((it, i) => (
    <div key={it.line_id || i} className="doc-item">
      <div className="font-bold">{i + 1}. {it.name}</div>
      <Row l={`${lineQty(it)} @${rp(it.price)}${it.is_length ? "/m" : ""}`} r={rp(it.subtotal)} />
      {it.is_length && <div className="pl-2">Status: {bendLabel(it.bend)}</div>}
      {it.bend_subtotal > 0 && (
        <div className="doc-bend">
          [ Rincian Upah Lengkung: {num(it.qty)} {it.unit} x {rp(it.bend_fee)} = {rp(it.bend_subtotal)} ]
        </div>
      )}
    </div>
  ));
}

export function Nota({ sale, settings = {}, variant = "thermal80" }) {
  const isPaper = variant === "a4" || variant === "f4";
  const s = settings || {};
  return (
    <div className={`doc doc-${variant}`} data-testid="nota-doc" data-variant={variant}>
      <div className="text-center">
        <div className="doc-title">{s.name || "HORAS BAJA"}</div>
        {s.tagline && <div>{s.tagline}</div>}
        <div>{s.address}</div>
        <div>Telp: {s.phone} | HP/WA: {s.wa1} / {s.wa2}</div>
      </div>
      <div className="doc-hr" />
      <div className="text-center font-bold">NOTA PENJUALAN</div>
      <Row l="No. Nota" r={sale.invoice_no} />
      <Row l="Tanggal" r={fdate(sale.date)} />
      <Row l="Kasir" r={sale.cashier} />
      <div className="doc-hr" />
      <div><b>Kepada:</b> {sale.customer?.name}</div>
      {sale.customer?.phone && <div>Telp: {sale.customer.phone}</div>}
      {(sale.delivery_address || sale.customer?.address) && <div>Alamat: {sale.delivery_address || sale.customer?.address}</div>}
      <Row l="Rencana Tgl Pengantaran" r={fdate(sale.delivery_date)} />
      <div className="doc-hr" />
      {isPaper ? <ItemsTable items={sale.items} /> : <ItemsList items={sale.items} />}
      <div className="doc-hr" />
      <Row l="Subtotal Material" r={rp(sale.total_material)} />
      <Row l="Total Upah Lengkung" r={rp(sale.total_bend)} />
      <Row l="Biaya Pengantaran / Ongkir" r={rp(sale.ongkir)} />
      <Row l="TOTAL AKHIR" r={rp(sale.grand_total)} b />
      {(sale.payments || []).map((p, i) => (
        <Row key={p.id || i} l={`${i === 0 && sale.balance > 0 ? "DP / Uang Muka" : i === 0 ? "Dibayar" : "Pelunasan"} (${p.method}, ${fdate(p.date)})`} r={rp(p.amount)} />
      ))}
      <Row l="SISA TAGIHAN" r={rp(sale.balance)} b />
      <Row l="Metode" r={sale.payment_method} />
      {sale.balance > 0 && sale.due_date && <Row l="Jatuh Tempo" r={fdate(sale.due_date)} />}
      {sale.notes && (
        <>
          <div className="doc-hr" />
          <div><b>Catatan / Instruksi Khusus:</b></div>
          <div>{sale.notes}</div>
        </>
      )}
      <div className="doc-hr" />
      <div className="text-center">{s.footer || "Terima kasih atas kepercayaan Anda"}</div>
    </div>
  );
}
