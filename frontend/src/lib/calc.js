const n = (v) => Number(v) || 0;

export function calcLine(it) {
  const qty = n(it.qty);
  const price = n(it.price);
  let total_meter = 0;
  let subtotal;
  let bend_subtotal = 0;
  if (it.is_length) {
    total_meter = Math.round(qty * n(it.length) * 100) / 100;
    subtotal = Math.round(total_meter * price);
    bend_subtotal = it.bend === "lengkung" ? Math.round(qty * n(it.bend_fee)) : 0;
  } else {
    subtotal = Math.round(qty * price);
  }
  return { ...it, total_meter, subtotal, bend_subtotal, line_total: subtotal + bend_subtotal };
}

export function summarize(lines, ongkir = 0, paidList = []) {
  const total_material = lines.reduce((a, l) => a + l.subtotal, 0);
  const total_bend = lines.reduce((a, l) => a + l.bend_subtotal, 0);
  const grand_total = total_material + total_bend + n(ongkir);
  const paid_total = paidList.reduce((a, p) => a + n(p.amount), 0);
  return { total_material, total_bend, ongkir: n(ongkir), grand_total, paid_total, balance: Math.max(grand_total - paid_total, 0) };
}

export function initialPaid(method, grand, dp) {
  if (method === "Tunai" || method === "Transfer") return grand;
  if (method === "DP") return Math.min(n(dp), grand);
  return 0;
}
