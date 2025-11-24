import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import RequesterDashboard from "./RequesterDashboard";
import SupplierDashboard from "./SupplierDashboard";
import StaffDashboard from "./StaffDashboard";
import FinanceDashboard from "./FinanceDashboard";
import SuperAdminDashboard from "./SuperAdminDashboard";
import HODDashboard from "./HODDashboard";
import SupplierDetailPage from "./SupplierDetailPage";

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Route based on user role
  let DashboardComponent;
  if (user.role === "Supplier") {
    DashboardComponent = SupplierDashboard;
  } else if (user.role === "SuperAdmin") {
    DashboardComponent = SuperAdminDashboard;
  } else if (user.role === "Requester") {
    DashboardComponent = RequesterDashboard;
  } else if (user.role === "HeadOfDepartment") {
    DashboardComponent = HODDashboard;
  } else if (user.role === "Finance") {
    DashboardComponent = FinanceDashboard;
  } else {
    DashboardComponent = StaffDashboard;
  }

  return (
    <Routes>
      <Route path="/" element={<DashboardComponent />} />
      {/* Supplier detail route for nested navigation if needed */}
      <Route path="suppliers/:id" element={<SupplierDetailPage />} />
    </Routes>
  );
};

export default DashboardPage;
