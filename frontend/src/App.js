import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { PrintProvider } from "@/components/PrintProvider";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Sales from "@/pages/Sales";
import Purchases from "@/pages/Purchases";
import Stock from "@/pages/Stock";
import Products from "@/pages/Products";
import { CustomersPage, SuppliersPage } from "@/pages/Masters";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";

function Guard({ children, admin }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (admin && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<Guard><AppShell /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="pos" element={<POS />} />
        <Route path="sales" element={<Sales />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="stock" element={<Stock />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="products" element={<Guard admin><Products /></Guard>} />
        <Route path="suppliers" element={<Guard admin><SuppliersPage /></Guard>} />
        <Route path="reports" element={<Guard admin><Reports /></Guard>} />
        <Route path="settings" element={<Guard admin><Settings /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <TooltipProvider delayDuration={100}>
          <PrintProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
            <Toaster theme="dark" richColors position="top-right" />
          </PrintProvider>
        </TooltipProvider>
      </DataProvider>
    </AuthProvider>
  );
}
