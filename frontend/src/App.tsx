import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import DashboardPage from "./pages/DashboardPage";
import SupplierDetailPage from "./pages/SupplierDetailPage";
import LoginPage from "./pages/LoginPage";
import CompanySettingsPage from "./pages/CompanySettingsPage";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route
      path="/*"
      element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/suppliers/:id"
      element={
        <ProtectedRoute>
          <SupplierDetailPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/company-settings"
      element={
        <ProtectedRoute>
          <CompanySettingsPage />
        </ProtectedRoute>
      }
    />
  </Routes>
);

export default App;

