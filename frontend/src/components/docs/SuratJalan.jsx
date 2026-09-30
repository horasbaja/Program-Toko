import { num, fdate, bendLabel, whName } from "@/lib/format";

export function SuratJalan({ sale, delivery, settings = {}, warehouses = [] }) {
  const s = settings || {};
  return (
    <div className="doc doc-sj" data-testid="surat-jalan-doc">
      <div className="flex justify-between items-start border-b-2 border-black pb-2">
        <div>
          <div className="doc-title">{s.name || "HORAS BAJA"}</div>
          <div>{s.address}</div>
          <div>Telp: {s.phone} | HP/WA: {s.wa1} / {s.wa2}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">SURAT JALAN</div>
          <div>No: {delivery.sj_no}</div>
          <div>Rit ke-{delivery.rit}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 my-2">
        <div>Tanggal Pengiriman: <b>{fdate(delivery.date)}</b></div>
        <div>Ref. Nota: <b>{sale.invoice_no}</b></div>
        <div>Kepada: <b>{sale.customer?.name}</b> {sale.customer?.phone ? `(${sale.customer.phone})` : ""}</div>
        <div>Gudang Pengambilan: <b>{whName(warehouses, delivery.warehouse)}</b></div>
        <div className="col-span-2">Alamat Kirim: <b>{delivery.address || sale.delivery_address || sale.customer?.address || "-"}</b></div>
        {(delivery.driver || delivery.vehicle) && <div className="col-span-2">Sopir / Kendaraan: {delivery.driver} {delivery.vehicle}</div>}
      </div>
      <table className="doc-table">
        <thead>
          <tr><th>No</th><th>Nama Barang</th><th>Qty</th><th>Panjang</th><th>Total Meter</th><th>Lurus / Lengkung</th></tr>
        </thead>
        <tbody>
          {delivery.items.map((it, i) => (
            <tr key={it.line_id || i}>
              <td>{i + 1}</td>
              <td>{it.name}</td>
              <td>{num(it.qty)} {it.unit}</td>
              <td>{it.is_length ? `${num(it.length)} m` : "-"}</td>
              <td>{it.is_length ? `${num(it.total_meter)} m` : "-"}</td>
              <td>{it.is_length ? bendLabel(it.bend) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sale.notes && <div className="mt-2"><b>Catatan / Instruksi Khusus:</b> {sale.notes}</div>}
      <div className="grid grid-cols-3 gap-4 mt-6 text-center">
        <div>
          <div className="font-bold">Penerima</div>
          <div className="doc-received">Barang diterima dengan baik dan benar</div>
          <div className="doc-sign">( ........................ )</div>
        </div>
        <div><div className="font-bold">Sopir</div><div className="doc-sign mt-8">( ........................ )</div></div>
        <div><div className="font-bold">Hormat Kami / Gudang</div><div className="doc-sign mt-8">( ........................ )</div></div>
      </div>
    </div>
  );
}
