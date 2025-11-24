import clsx from "clsx";
import { FormEvent, useEffect, useState } from "react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";
import { apiClient } from "../utils/client";
import { Category, Department, SupplierWithUser, User } from "../utils/types";
import { COMMON_TIMEZONES } from "../utils/timezone";
import { 
  BarChart3, 
  DollarSign, 
  ClipboardList, 
  Target, 
  Package, 
  Trophy, 
  Users,
  UserCircle,
  Building2,
  FolderTree
} from "lucide-react";

type TabType = "users" | "suppliers" | "categories" | "departments" | "reports";

const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState<TabType>("reports");
  const [users, setUsers] = useState<User[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierWithUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCreateDepartmentOpen, setIsCreateDepartmentOpen] = useState(false);
  const [departmentForm, setDepartmentForm] = useState({
    name: "",
    description: "",
    budget: "",
  });
  const [userForm, setUserForm] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "Procurement",
    timezone: "Africa/Cairo",
    department_id: "",
  });
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      const { data } = await apiClient.get<User[]>("/api/admin/users");
      setUsers(data);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const loadSuppliers = async () => {
    try {
      const { data } = await apiClient.get<SupplierWithUser[]>("/api/admin/suppliers");
      setSuppliers(data);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    }
  };

  const loadCategories = async () => {
    try {
      const { data } = await apiClient.get<Category[]>("/api/admin/categories");
      setCategories(data);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data } = await apiClient.get<Department[]>("/api/requests/departments");
      setDepartments(data);
    } catch (err) {
      console.error("Failed to load departments:", err);
    }
  };

  const loadAnalytics = async () => {
    try {
      const { data } = await apiClient.get("/api/admin/analytics/summary");
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "users") loadUsers();
    else if (activeTab === "suppliers") loadSuppliers();
    else if (activeTab === "categories") loadCategories();
    else if (activeTab === "departments") loadDepartments();
    else if (activeTab === "reports") loadAnalytics();
  }, [activeTab]);

  useEffect(() => {
    if (isCreateUserOpen) {
      loadDepartments();
    }
  }, [isCreateUserOpen]);

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      // Prepare payload - only include department_id for HeadOfDepartment
      const payload: any = {
        email: userForm.email,
        full_name: userForm.full_name,
        password: userForm.password,
        role: userForm.role,
        timezone: userForm.timezone,
      };
      
      if (userForm.role === "HeadOfDepartment" && userForm.department_id) {
        payload.department_id = parseInt(userForm.department_id);
      }
      
      await apiClient.post("/api/admin/users", payload);
      setSuccess("User created successfully!");
      setIsCreateUserOpen(false);
      setUserForm({ email: "", full_name: "", password: "", role: "Procurement", timezone: "Africa/Cairo", department_id: "" });
      await loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await apiClient.delete(`/api/admin/users/${userId}`);
      setSuccess("User deleted successfully!");
      await loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete user");
    }
  };

  const handleCreateCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.post("/api/admin/categories", categoryForm);
      setSuccess("Category created successfully!");
      setIsCreateCategoryOpen(false);
      setCategoryForm({ name: "", description: "" });
      await loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create category");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await apiClient.delete(`/api/admin/categories/${categoryId}`);
      setSuccess("Category deleted successfully!");
      await loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete category");
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || "",
    });
    setIsEditCategoryOpen(true);
  };

  const handleUpdateCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCategory) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.put(`/api/admin/categories/${editingCategory.id}`, categoryForm);
      setSuccess("Category updated successfully!");
      setIsEditCategoryOpen(false);
      setEditingCategory(null);
      setCategoryForm({ name: "", description: "" });
      await loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update category");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("name", departmentForm.name);
      if (departmentForm.description) formData.append("description", departmentForm.description);
      if (departmentForm.budget) formData.append("budget", departmentForm.budget);
      
      await apiClient.post("/api/admin/departments", formData);
      setSuccess("Department created successfully!");
      setIsCreateDepartmentOpen(false);
      setDepartmentForm({ name: "", description: "", budget: "" });
      await loadDepartments();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create department");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDepartment = async (deptId: number) => {
    if (!confirm("Are you sure you want to delete this department?")) return;
    try {
      await apiClient.delete(`/api/admin/departments/${deptId}`);
      setSuccess("Department deleted successfully!");
      await loadDepartments();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete department");
    }
  };

const actions = (
    <div className="flex gap-2 text-blue-700">
      <button
        onClick={() => navigate("/admin/company-settings")}
        className="rounded-lg border border-white/50 bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-blue-100"
      >
        Company Settings
      </button>
      {activeTab === "users" && (
        <button
          onClick={() => setIsCreateUserOpen(true)}
          className="rounded-lg border border-white/50 bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-blue-100"
        >
          Create User
        </button>
      )}
      {activeTab === "categories" && (
        <button
          onClick={() => setIsCreateCategoryOpen(true)}
          className="rounded-lg border border-white/50 bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-blue-100"
        >
          Add Category
        </button>
      )}
      {activeTab === "departments" && (
        <button
          onClick={() => setIsCreateDepartmentOpen(true)}
          className="rounded-lg border border-white/50 bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-blue-100"
        >
          Add Department
        </button>
      )}
    </div>
  );

  return (
    <Layout
      title="SuperAdmin Dashboard"
      subtitle="Manage users, suppliers, and procurement categories"
      actions={actions}
    >
      {error && (
        <div className="mb-6 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-semibold underline">
            Dismiss
          </button>
        </div>
      )}
      {success && (
        <div className="mb-6 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-600">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 -mx-3 sm:mx-0 overflow-x-auto">
        <div className="flex gap-1 sm:gap-2 border-b border-slate-200 px-3 sm:px-0 min-w-max sm:min-w-0">
          <button
            onClick={() => setActiveTab("reports")}
            className={clsx(
              "group flex items-center gap-1.5 sm:gap-2 border-b-2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap",
              activeTab === "reports"
                ? "border-primary text-primary"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800"
            )}
          >
            <BarChart3
              className={clsx(
                "h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 transition-colors",
                activeTab === "reports" && "text-primary"
              )}
            />
            <span className="hidden sm:inline">Reports & Analytics</span>
            <span className="sm:hidden">Reports</span>
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={clsx(
              "group flex items-center gap-1.5 sm:gap-2 border-b-2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap",
              activeTab === "users"
                ? "border-primary text-primary"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800"
            )}
          >
            <UserCircle
              className={clsx(
                "h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 transition-colors",
                activeTab === "users" && "text-primary"
              )}
            />
            <span>Users ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("suppliers")}
            className={clsx(
              "group flex items-center gap-1.5 sm:gap-2 border-b-2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap",
              activeTab === "suppliers"
                ? "border-primary text-primary"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800"
            )}
          >
            <Building2
              className={clsx(
                "h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 transition-colors",
                activeTab === "suppliers" && "text-primary"
              )}
            />
            <span className="hidden sm:inline">Suppliers ({suppliers.length})</span>
            <span className="sm:hidden">Suppliers</span>
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={clsx(
              "group flex items-center gap-1.5 sm:gap-2 border-b-2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap",
              activeTab === "categories"
                ? "border-primary text-primary"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800"
            )}
          >
            <FolderTree
              className={clsx(
                "h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 transition-colors",
                activeTab === "categories" && "text-primary"
              )}
            />
            <span className="hidden sm:inline">Categories ({categories.length})</span>
            <span className="sm:hidden">Categories</span>
          </button>
          <button
            onClick={() => setActiveTab("departments")}
            className={clsx(
              "group flex items-center gap-1.5 sm:gap-2 border-b-2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap",
              activeTab === "departments"
                ? "border-primary text-primary"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800"
            )}
          >
            <Building2
              className={clsx(
                "h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 transition-colors",
                activeTab === "departments" && "text-primary"
              )}
            />
            <span className="hidden sm:inline">Departments ({departments.length})</span>
            <span className="sm:hidden">Depts</span>
          </button>
        </div>
      </div>

      {/* Reports Tab */}
      {activeTab === "reports" && analytics && (
        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs font-medium uppercase text-slate-500 truncate">Total Requests</p>
                  <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold text-blue-600">{analytics.requests.total}</p>
                  <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-500">{analytics.requests.recent_30_days} last 30d</p>
                </div>
                <div className="rounded-full bg-blue-100 p-2 sm:p-3 self-end sm:self-auto">
                  <svg className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs font-medium uppercase text-slate-500 truncate">Total RFQs</p>
                  <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold text-green-600">{analytics.rfqs.total}</p>
                  <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-500">{analytics.rfqs.open} open</p>
                </div>
                <div className="rounded-full bg-green-100 p-2 sm:p-3 self-end sm:self-auto">
                  <svg className="h-4 w-4 sm:h-6 sm:w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs font-medium uppercase text-slate-500 truncate">Quotations</p>
                  <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold text-purple-600">{analytics.quotations.total}</p>
                  <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-500">{analytics.quotations.approved} approved</p>
                </div>
                <div className="rounded-full bg-purple-100 p-2 sm:p-3 self-end sm:self-auto">
                  <svg className="h-4 w-4 sm:h-6 sm:w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs font-medium uppercase text-slate-500 truncate">Active Suppliers</p>
                  <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold text-orange-600">{analytics.suppliers.active}</p>
                  <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-500">of {analytics.suppliers.total} total</p>
                </div>
                <div className="rounded-full bg-orange-100 p-2 sm:p-3 self-end sm:self-auto">
                  <svg className="h-4 w-4 sm:h-6 sm:w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Budget Overview */}
          <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-slate-800 mb-3 sm:mb-4">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              Budget Overview
            </h3>
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
              <div className="rounded-lg sm:rounded-xl bg-blue-50 p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs font-medium uppercase text-blue-600">Total Requested</p>
                <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-blue-700 break-words">
                  {formatCurrency(analytics.budget.total_requested, analytics.budget.currency)}
                </p>
              </div>
              <div className="rounded-lg sm:rounded-xl bg-green-50 p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs font-medium uppercase text-green-600">Total Approved</p>
                <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-green-700 break-words">
                  {formatCurrency(analytics.budget.total_approved, analytics.budget.currency)}
                </p>
              </div>
              <div className="rounded-lg sm:rounded-xl bg-emerald-50 p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs font-medium uppercase text-emerald-600">Total Awarded</p>
                <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-emerald-700 break-words">
                  {formatCurrency(analytics.budget.total_awarded, analytics.budget.currency)}
                </p>
              </div>
            </div>
          </div>

          {/* Request Status Breakdown */}
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-slate-800 mb-3 sm:mb-4">
                <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                Request Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                    <span className="text-sm text-slate-600">Pending</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{analytics.requests.pending}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    <span className="text-sm text-slate-600">Approved</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{analytics.requests.approved}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                    <span className="text-sm text-slate-600">Rejected</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{analytics.requests.rejected}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm text-slate-600">Completed</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{analytics.requests.completed}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-slate-800 mb-3 sm:mb-4">
                <Target className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                RFQ Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    <span className="text-sm text-slate-600">Open</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{analytics.rfqs.open}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-slate-500"></div>
                    <span className="text-sm text-slate-600">Closed</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{analytics.rfqs.closed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-indigo-500"></div>
                    <span className="text-sm text-slate-600">Awarded</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{analytics.rfqs.awarded}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Categories & Top Suppliers */}
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-slate-800 mb-3 sm:mb-4">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                RFQs by Category
              </h3>
              <div className="space-y-2">
                {analytics.categories.map((cat: any) => (
                  <div key={cat.name} className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-slate-600 truncate pr-2">{cat.name}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold text-primary shrink-0">
                      {cat.rfq_count}
                    </span>
                  </div>
                ))}
                {analytics.categories.length === 0 && (
                  <p className="text-xs sm:text-sm text-slate-500">No categories with RFQs yet</p>
                )}
              </div>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-slate-800 mb-3 sm:mb-4">
                <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                Top Suppliers
              </h3>
              <div className="space-y-2 sm:space-y-3">
                {analytics.suppliers.top_performers.slice(0, 5).map((supplier: any, index: number) => (
                  <div key={supplier.company_name} className="flex items-start justify-between">
                    <div className="flex items-start gap-1.5 sm:gap-2 min-w-0">
                      <span className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] sm:text-xs font-bold text-slate-600">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-slate-800 truncate">{supplier.company_name}</p>
                        <p className="text-[10px] sm:text-xs text-slate-500">
                          {supplier.quotation_count} quotes • {supplier.approved_count} approved
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {analytics.suppliers.top_performers.length === 0 && (
                  <p className="text-xs sm:text-sm text-slate-500">No supplier activity yet</p>
                )}
              </div>
            </div>
          </div>

          {/* User Activity */}
          <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-slate-800 mb-3 sm:mb-4">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
              User Activity
            </h3>
            <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
              <div className="text-center">
                <p className="text-xl sm:text-2xl font-bold text-primary">{analytics.users.total}</p>
                <p className="text-[10px] sm:text-xs text-slate-500">Total Users</p>
              </div>
              <div className="text-center">
                <p className="text-xl sm:text-2xl font-bold text-green-600">{analytics.users.active}</p>
                <p className="text-[10px] sm:text-xs text-slate-500">Active Users</p>
              </div>
              {analytics.users.by_role.map((role: any) => (
                <div key={role.role} className="text-center">
                  <p className="text-xl sm:text-2xl font-bold text-slate-700">{role.count}</p>
                  <p className="text-[10px] sm:text-xs text-slate-500 capitalize truncate">{role.role}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="space-y-3 sm:space-y-0">
          {/* Mobile Card View */}
          <div className="block sm:hidden space-y-3">
            {users.map((u) => (
              <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-slate-800 truncate">{u.full_name}</h4>
                    <p className="text-xs text-slate-600 truncate mt-0.5">{u.email}</p>
                  </div>
                  {u.id !== user?.id && (
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 shrink-0 ml-2"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700">
                    {u.role}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                      u.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="text-sm text-slate-500">No users found</p>
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                      Full Name
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                      Email
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                      Role
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                      Status
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 lg:px-6 py-4 text-sm text-slate-800">{u.full_name}</td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-slate-600">{u.email}</td>
                      <td className="px-4 lg:px-6 py-4">
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            u.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-sm font-semibold text-red-600 hover:text-red-700"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Suppliers Tab */}
      {activeTab === "suppliers" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Company Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Supplier Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Contact Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Invitations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Total Awarded
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr 
                    key={s.id} 
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/suppliers/${s.id}`)}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                      {s.company_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-mono">{s.supplier_number}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{s.contact_email}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {s.contact_phone || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{s.invitations_sent}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                      {formatCurrency(s.total_awarded_value, s.preferred_currency || "USD")}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          s.user_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {s.user_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                      No suppliers found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === "categories" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-800">{cat.name}</h3>
                  {cat.description && (
                    <p className="mt-2 text-sm text-slate-600">{cat.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditCategory(cat)}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="text-sm font-semibold text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="col-span-full rounded-xl border border-slate-200 bg-white p-12 text-center">
              <p className="text-sm text-slate-500">No categories found. Create one to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === "departments" && (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 shrink-0" />
                    <h3 className="text-base sm:text-lg font-semibold text-slate-800 truncate">{dept.name}</h3>
                  </div>
                  {dept.description && (
                    <p className="mt-2 text-xs sm:text-sm text-slate-600 line-clamp-2">{dept.description}</p>
                  )}
                  {dept.budget && (
                    <p className="mt-2 text-xs sm:text-sm font-medium text-slate-700 truncate">
                      Budget: {formatCurrency(dept.budget)}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] sm:text-xs text-slate-500">
                    {dept.head_count} Head{dept.head_count !== 1 ? 's' : ''} of Department
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteDepartment(dept.id)}
                  className="text-xs sm:text-sm font-semibold text-red-600 hover:text-red-700 shrink-0"
                  disabled={dept.head_count > 0}
                  title={dept.head_count > 0 ? "Cannot delete department with assigned HODs" : ""}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {departments.length === 0 && (
            <div className="col-span-full rounded-xl border border-slate-200 bg-white p-8 sm:p-12 text-center">
              <p className="text-xs sm:text-sm text-slate-500">No departments found. Create one to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* Create User Modal */}
      <Modal
        open={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        title="Create New User"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Full Name</label>
            <input
              type="text"
              required
              value={userForm.full_name}
              onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Email</label>
            <input
              type="email"
              required
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Role</label>
            <select
              required
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
            >
              <option value="Procurement">Procurement</option>
              <option value="ProcurementOfficer">Procurement Officer</option>
              <option value="HeadOfDepartment">Head of Department</option>
              <option value="Finance">Finance (Deprecated)</option>
              <option value="Requester">Requester</option>
              <option value="SuperAdmin">SuperAdmin</option>
            </select>
          </div>
          {userForm.role === "HeadOfDepartment" && (
            <div>
              <label className="text-sm font-medium text-slate-600">Department *</label>
              <select
                required
                value={userForm.department_id}
                onChange={(e) => setUserForm({ ...userForm, department_id: e.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                    {dept.head_of_department_name && ` (Current HOD: ${dept.head_of_department_name})`}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                This HOD will be assigned to manage this department's purchase requests.
              </p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-slate-600">Timezone</label>
            <select
              required
              value={userForm.timezone}
              onChange={(e) => setUserForm({ ...userForm, timezone: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Default: Africa/Cairo. Admin and Procurement users can change this later in Settings.
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
          >
            {submitting ? "Creating..." : "Create User"}
          </button>
        </form>
      </Modal>

      {/* Create Category Modal */}
      <Modal
        open={isCreateCategoryOpen}
        onClose={() => setIsCreateCategoryOpen(false)}
        title="Add Procurement Category"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Category Name</label>
            <input
              type="text"
              required
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Description</label>
            <textarea
              rows={3}
              value={categoryForm.description}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
          >
            {submitting ? "Adding..." : "Add Category"}
          </button>
        </form>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        open={isEditCategoryOpen}
        onClose={() => {
          setIsEditCategoryOpen(false);
          setEditingCategory(null);
          setCategoryForm({ name: "", description: "" });
        }}
        title="Edit Category"
      >
        <form onSubmit={handleUpdateCategory} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Category Name</label>
            <input
              type="text"
              required
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Description</label>
            <textarea
              rows={3}
              value={categoryForm.description}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
          >
            {submitting ? "Updating..." : "Update Category"}
          </button>
        </form>
      </Modal>

      {/* Create Department Modal */}
      <Modal
        open={isCreateDepartmentOpen}
        onClose={() => setIsCreateDepartmentOpen(false)}
        title="Create New Department"
      >
        <form onSubmit={handleCreateDepartment} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Department Name</label>
            <input
              type="text"
              required
              value={departmentForm.name}
              onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
              placeholder="e.g., Information Technology"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Description</label>
            <textarea
              rows={3}
              value={departmentForm.description}
              onChange={(e) => setDepartmentForm({ ...departmentForm, description: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
              placeholder="Brief description of the department"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Annual Budget (Optional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={departmentForm.budget}
              onChange={(e) => setDepartmentForm({ ...departmentForm, budget: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
              placeholder="0.00"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
          >
            {submitting ? "Creating..." : "Create Department"}
          </button>
        </form>
      </Modal>
    </Layout>
  );
};

export default SuperAdminDashboard;
