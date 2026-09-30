export const rp = (v) => "Rp " + Math.round(Number(v) || 0).toLocaleString("id-ID");
export const num = (v, d = 2) => (Number(v) || 0).toLocaleString("id-ID", { maximumFractionDigits: d });
export const fdate = (s) =>
  s ? new Date(s.length === 10 ? s + "T00:00:00" : s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";
export const todayStr = (off = 0) => new Date(Date.now() + off * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());

export const STATUS = {
  indent: { label: "Proses Indent", color: "#EAB308" },
  ready: { label: "Ready / Belum Dikirim", color: "#3B82F6" },
  partial: { label: "Antar Sebagian", color: "#F97316" },
  close: { label: "Close (Selesai)", color: "#22C55E" },
};
export const RECEIVE_STATUSES = ["Dalam Proses", "Barang Diterima", "Barang Belum Lengkap", "Barang Direject Semua"];
export const PAY_METHODS = ["Tunai", "Transfer", "Piutang", "DP"];
export const CUSTOMER_TYPES = ["Kontraktor", "Tukang", "Umum"];

export const whName = (whs, code) => whs?.find((w) => w.code === code)?.name || code || "-";
export const bendLabel = (b) => (b === "lengkung" ? "Lengkung Standar" : "Lurus");
export const lineQty = (it) =>
  it.is_length ? `${num(it.qty)} ${it.unit} × ${num(it.length)} m = ${num(it.total_meter)} m` : `${num(it.qty)} ${it.unit || "Pcs"}`;

export const waNumber = (p) => {
  let d = (p || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  return d;
};

export function notaText(sale, st = {}) {
  const L = [`*${st.name || "HORAS BAJA"}*`, st.address || "", `Telp ${st.phone || ""} | WA ${st.wa1 || ""}`, "",
    `No. Nota: ${sale.invoice_no}`, `Tanggal: ${fdate(sale.date)}`, `Pelanggan: ${sale.customer?.name}`,
    `Rencana Pengantaran: ${fdate(sale.delivery_date)}`, "------------------------"];
  sale.items.forEach((it, i) => {
    L.push(`${i + 1}. ${it.name}`, `   ${lineQty(it)} @${rp(it.price)}${it.is_length ? "/m" : ""} = ${rp(it.subtotal)}`);
    if (it.bend_subtotal > 0) L.push(`   Upah Lengkung: ${num(it.qty)} ${it.unit} x ${rp(it.bend_fee)} = ${rp(it.bend_subtotal)}`);
  });
  L.push("------------------------", `Ongkir: ${rp(sale.ongkir)}`, `*TOTAL: ${rp(sale.grand_total)}*`,
    `Dibayar: ${rp(sale.paid_total)}`, `Sisa: ${rp(sale.balance)}`);
  if (sale.notes) L.push(`Catatan: ${sale.notes}`);
  L.push("", "Terima kasih - HORAS BAJA");
  return L.join("\n");
}

export const waLink = (sale, st) => `https://wa.me/${waNumber(sale.customer?.phone)}?text=${encodeURIComponent(notaText(sale, st))}`;
