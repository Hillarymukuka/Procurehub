import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import DashboardPage from "./pages/DashboardPage";
import SupplierDetailPage from "./pages/SupplierDetailPage";
import LoginPage from "./pages/LoginPage";
import CompanySettingsPage from "./pages/CompanySettingsPage";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const [showSlowMessage, setShowSlowMessage] = React.useState(false);

  React.useEffect(() => {
    if (isLoading) {
      // Show message if loading takes more than 3 seconds
      const timer = setTimeout(() => setShowSlowMessage(true), 3000);
      return () => clearTimeout(timer);
    } else {
      setShowSlowMessage(false);
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        {showSlowMessage && (
          <div className="text-center px-4">
            <p className="text-sm text-slate-600">
              Server is waking up, this may take up to a minute...
            </p>
            <p className="text-xs text-slate-500 mt-2">
              (Free tier backend is starting from sleep mode)
            </p>
          </div>
        )}
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

