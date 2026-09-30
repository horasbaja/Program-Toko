import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { CUSTOMER_TYPES } from "@/lib/format";
import { PageHeader } from "@/components/common";
import EntityManager from "@/components/EntityManager";

export function CustomersPage() {
  const { isAdmin } = useAuth();
  const { refresh } = useData();
  return (
    <div>
      <PageHeader title="Database Pelanggan" subtitle="Master Data" />
      <EntityManager title="Pelanggan" endpoint="/customers" testid="customers-manager" canDelete={isAdmin} onChanged={refresh}
        defaults={{ type: "Umum", status: "N" }} filter={{ key: "type", label: "Semua Tipe", options: CUSTOMER_TYPES }}
        fields={[
          { key: "name", label: "Nama" }, { key: "phone", label: "HP / WA" }, { key: "address", label: "Alamat" },
          { key: "type", label: "Tipe Pelanggan", type: "select", options: CUSTOMER_TYPES },
          { key: "status", label: "Status Pelanggan", placeholder: "N / R / VVIP" },
        ]} />
    </div>
  );
}

export function SuppliersPage() {
  const { refresh } = useData();
  return (
    <div>
      <PageHeader title="Supplier / Pabrik" subtitle="Master Data" />
      <EntityManager title="Supplier" endpoint="/suppliers" testid="suppliers-manager" onChanged={refresh}
        fields={[
          { key: "name", label: "Nama Pabrik" }, { key: "prefix", label: "Kode Prefix PO/DO", placeholder: "CMC", render: (r) => <span className="font-mono text-orange-300">{r.prefix}</span> },
          { key: "sales_contact", label: "Kontak Sales" }, { key: "phone", label: "Telp" }, { key: "address", label: "Alamat" },
        ]} />
      <p className="mt-3 font-mono text-xs text-muted-foreground">Format nomor PO otomatis: [PREFIX] + [2 digit tahun] + [4 digit urut] — contoh CMC260001</p>
    </div>
  );
}
