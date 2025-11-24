import axios from "axios";
import clsx from "clsx";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";
import { useNavigate } from "react-router-dom";
import Modal from "../components/Modal";
import RFQTable from "../components/RFQTable";
import StatCard from "../components/StatCard";
import { ClipboardList, FileText, MessageSquare, Search, ShoppingCart, Users, FolderTree, Package, Lock, Calendar, Clock, Lightbulb } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";
import { useTimezone } from "../hooks/useTimezone";
import { apiClient } from "../utils/client";
import { COMMON_TIMEZONES } from "../utils/timezone";
import {
  Category,
  CategoryDetails,
  Message,
  MessageCreate,
  MessageListResponse,
  PurchaseRequest,
  Quotation,
  RFQ,
  RFQWithQuotations,
  RequestProcurementReviewPayload,
  RequestDenialPayload,
  RequestStatus,
  RequestDocument,
  SupplierWithUser,
} from "../utils/types";

interface RFQFormState {
  title: string;
  description: string;
  category: string;
  budget: string;
  currency: string;
  deadline: string;
}

interface PurchaseOrderApi {
  id: number;
  po_number: string;
  supplier_id: number | null;
  supplier_name: string | null;
  supplier_number: string | null;
  amount: number;
  currency: string;
  rfq_id: number;
  rfq_number: string | null;
  rfq_title: string;
  approved_at: string | null;
  submitted_at: string;
}

interface PurchaseOrderRow {
  id: number;
  poNumber: string;
  supplierId?: number | null;
  supplierName: string;
  supplierNumber?: string | null;
  amount: number;
  currency: string;
  rfqTitle: string;
  rfqNumber?: string;
  rfqId: number;
  approvedAt?: string | null;
  submittedAt: string;
}

interface SupplierFormState {
  company_name: string;
  contact_email: string;
  full_name: string;
  password: string;
  contact_phone: string;
  address: string;
  preferred_currency: string;
  category_ids: number[];
  timezone: string;
}

interface InviteSuppliersFormState {
  supplier_ids: number[];
  rfq_deadline: string;
  notes: string;
}

const emptyForm: RFQFormState = {
  title: "",
  description: "",
  category: "",
  budget: "",
  currency: "ZMW",
  deadline: ""
};

const emptyInviteForm: InviteSuppliersFormState = {
  supplier_ids: [],
  rfq_deadline: "",
  notes: "",
};

const parseErrorMessage = (error: unknown): string | null => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") {
      return data;
    }
    const detail = (data as { detail?: unknown })?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg?: unknown }).msg);
          }
          return typeof item === "string" ? item : JSON.stringify(item);
        })
        .join("; ");
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return null;
};

type SearchScope = "rfqs" | "suppliers" | "requests" | "categories" | "purchaseOrders" | "deliveryNotes";

const SEARCH_SCOPE_OPTIONS: { value: SearchScope; label: string }[] = [
  { value: "rfqs", label: "RFQs" },
  { value: "suppliers", label: "Suppliers" },
  { value: "requests", label: "Requests" },
  { value: "categories", label: "Categories" },
  { value: "purchaseOrders", label: "Purchase Orders" },
  { value: "deliveryNotes", label: "Delivery Notes" },
];

const emptySupplierForm: SupplierFormState = {
  company_name: "",
  contact_email: "",
  full_name: "",
  password: "",
  contact_phone: "",
  address: "",
  preferred_currency: "ZMW",
  category_ids: [],
  timezone: "Africa/Cairo",
};

const normalizeCategory = (value: string) => value.trim().toLowerCase();

const currencyOptions = ["ZMW", "USD", "EUR", "GBP"] as const;

interface ApprovalFormState {
  title: string;
  description: string;
  justification: string;
  category: string;
  needed_by: string;
  budget_amount: string;
  budget_currency: string;
  procurement_notes: string;
}

const emptyApprovalForm: ApprovalFormState = {
  title: "",
  description: "",
  justification: "",
  category: "",
  needed_by: "",
  budget_amount: "",
  budget_currency: "ZMW",
  procurement_notes: "",
};

const buildCategoryDetails = (category: Category, rfqs: RFQ[]): CategoryDetails => {
  const relatedRfqs = rfqs.filter((rfq) => rfq.category === category.name);
  const totalBudget = relatedRfqs.reduce((sum, rfq) => sum + Number(rfq.budget ?? 0), 0);
  const toDetail = (rfq: RFQ) => ({
    id: rfq.id,
    rfq_number: rfq.rfq_number,
    title: rfq.title,
    budget: Number(rfq.budget ?? 0),
    currency: rfq.currency,
    deadline: rfq.deadline,
    status: rfq.status,
    created_at: rfq.created_at ?? "",
  });

  return {
    ...category,
    total_rfqs: relatedRfqs.length,
    open_rfqs: relatedRfqs.filter((rfq) => rfq.status === "open").length,
    awarded_rfqs: relatedRfqs.filter((rfq) => rfq.status === "awarded").length,
    total_budget: totalBudget,
    rfqs: relatedRfqs.map(toDetail),
  };
};

const StaffDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const { formatForInput, toUtc, getCurrentLocal, formatDisplay } = useTimezone();
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierWithUser[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);
  const [isLoadingPurchaseOrders, setIsLoadingPurchaseOrders] = useState(false);
  const [deliveredContracts, setDeliveredContracts] = useState<Quotation[]>([]);
  const [isLoadingDeliveredContracts, setIsLoadingDeliveredContracts] = useState(false);
  const prevSearchScopeRef = useRef<SearchScope | null>(null);
  const [selectedRfq, setSelectedRfq] = useState<RFQWithQuotations | null>(null);
  const [selectedRfqId, setSelectedRfqId] = useState<number | null>(null);
  const [isLoadingRfqDetail, setIsLoadingRfqDetail] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateSupplierOpen, setIsCreateSupplierOpen] = useState(false);
  const [form, setForm] = useState<RFQFormState>({ ...emptyForm });
  const [rfqAttachments, setRfqAttachments] = useState<File[]>([]);
  const [rfqSelectedSupplierIds, setRfqSelectedSupplierIds] = useState<number[]>([]);
  const lastRfqCategoryRef = useRef<string | null>(null);
  const [supplierForm, setSupplierForm] = useState<SupplierFormState>({ ...emptySupplierForm });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"rfqs" | "suppliers" | "categories" | "requests" | "purchaseOrders" | "deliveryNotes">("rfqs");
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [isRfqDetailOpen, setIsRfqDetailOpen] = useState(false);
  const [isCategoryDetailOpen, setIsCategoryDetailOpen] = useState(false);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [isQuotationDetailOpen, setIsQuotationDetailOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierWithUser | null>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isSupplierProfileOpen, setIsSupplierProfileOpen] = useState(false);
const [isMessageCenterOpen, setIsMessageCenterOpen] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);
  const [messageViewMode, setMessageViewMode] = useState<"sent" | "received">("sent");
  const [selectedMessageInCenter, setSelectedMessageInCenter] = useState<Message | null>(null);
  const [isMessageDetailOpen, setIsMessageDetailOpen] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("rfqs");
  const [messageForm, setMessageForm] = useState<MessageCreate>({
    recipient_id: 0,
    supplier_id: 0,
    subject: "",
    content: ""
  });
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [approvalForm, setApprovalForm] = useState<ApprovalFormState>(emptyApprovalForm);
  const [isApproveReadOnly, setIsApproveReadOnly] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteSuppliersFormState>({ ...emptyInviteForm });
  const [inviteRequest, setInviteRequest] = useState<PurchaseRequest | null>(null);
  const [isBudgetOverrideModalOpen, setIsBudgetOverrideModalOpen] = useState(false);
  const [budgetOverrideJustification, setBudgetOverrideJustification] = useState("");
  const [pendingApproval, setPendingApproval] = useState<{ rfqId: number; quotationId: number } | null>(null);
  const [deadlineTimer, setDeadlineTimer] = useState<string>("");
  
  // Delivery tracking state
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [deliveryQuotation, setDeliveryQuotation] = useState<{ rfqId: number; quotationId: number } | null>(null);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryNote, setDeliveryNote] = useState<File | null>(null);
  
  // Notification badges state
  const [unreadRfqUpdates, setUnreadRfqUpdates] = useState(0);
  const [unreadRequestUpdates, setUnreadRequestUpdates] = useState(0);
  const [lastRfqCheckTime, setLastRfqCheckTime] = useState<number>(0);
  const [lastRequestCheckTime, setLastRequestCheckTime] = useState<number>(0);
  
  // Draft RFQ approval with supplier selection
  const [isApproveRfqModalOpen, setIsApproveRfqModalOpen] = useState(false);
  const [rfqToApprove, setRfqToApprove] = useState<RFQ | null>(null);
  const [selectedSupplierIdsForApproval, setSelectedSupplierIdsForApproval] = useState<number[]>([]);
  
  const canCreate = user?.role === "Procurement" || user?.role === "ProcurementOfficer" || user?.role === "SuperAdmin";
  const canApprove = user?.role === "Procurement" || user?.role === "SuperAdmin" || user?.role === "Finance";
  const canApproveRfq = user?.role === "Procurement" || user?.role === "SuperAdmin";
  const isProcurementOfficer = user?.role === "ProcurementOfficer";
  const currencyOptionsWithCurrent = useMemo(
    () =>
      Array.from(
        new Set(
          [...currencyOptions, approvalForm.budget_currency].filter(
            (value): value is string => Boolean(value)
          )
        )
      ),
    [approvalForm.budget_currency]
  );

  const getSupplierBuckets = (category: string) => {
    const normalized = normalizeCategory(category);
    if (!normalized) {
      return { recommended: [] as SupplierWithUser[], others: suppliers };
    }

    const recommended = suppliers.filter((supplier) => {
      const categories =
        supplier.categories?.map((category) => normalizeCategory(category.name)) ?? [];
      return categories.includes(normalized);
    });
    const recommendedIds = new Set(recommended.map((supplier) => supplier.id));
    const others = suppliers.filter((supplier) => !recommendedIds.has(supplier.id));
    return { recommended, others };
  };

  const inviteBuckets = useMemo(() => {
    if (!inviteRequest) {
      return { recommended: [] as SupplierWithUser[], others: suppliers };
    }
    return getSupplierBuckets(inviteRequest.category ?? "");
  }, [inviteRequest, suppliers]);

  const createRfqBuckets = useMemo(() => {
    return getSupplierBuckets(form.category ?? "");
  }, [form.category, suppliers]);

  const getDefaultInviteDeadline = (request: PurchaseRequest) => {
    const neededBy = request.needed_by ? new Date(request.needed_by) : null;
    if (neededBy && neededBy.getTime() > Date.now()) {
      const oneDayBefore = new Date(neededBy.getTime() - 24 * 60 * 60 * 1000);
      return toDateTimeLocal(oneDayBefore);
    }
    return toDateTimeLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  };

  const requestStatusStyles: Record<RequestStatus, string> = {
    pending_procurement: "bg-amber-100 text-amber-700",
    pending_finance_approval: "bg-sky-100 text-sky-700",
    finance_approved: "bg-emerald-100 text-emerald-700",
    rfq_issued: "bg-blue-100 text-blue-700",
    rejected_by_procurement: "bg-rose-100 text-rose-700",
    rejected_by_finance: "bg-rose-100 text-rose-700",
    completed: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    denied: "bg-rose-100 text-rose-700",
  };

  const requestStatusLabels: Record<RequestStatus, string> = {
    pending_procurement: "Pending Procurement",
    pending_finance_approval: "Pending Finance",
    finance_approved: "Finance Approved",
    rfq_issued: "RFQ Issued",
    rejected_by_procurement: "Rejected by Procurement",
    rejected_by_finance: "Rejected by Finance",
    completed: "Completed",
    pending: "Pending",
    approved: "Approved",
    denied: "Denied",
  };

  const rfqStatusStyles: Record<string, string> = {
    open: "bg-emerald-100 text-emerald-700",
    closed: "bg-slate-200 text-slate-700",
    awarded: "bg-purple-100 text-purple-700",
  };

  const handleRfqAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) {
      return;
    }
    setRfqAttachments((prev) => [...prev, ...files]);
    event.target.value = "";
  };

  const handleRemoveRfqAttachment = (index: number) => {
    setRfqAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const toggleCreateSupplierSelection = (supplierId: number) => {
    setRfqSelectedSupplierIds((prev) =>
      prev.includes(supplierId)
        ? prev.filter((id) => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  const toggleSupplierCategorySelection = (categoryId: number) => {
    setSupplierForm((prev) => {
      const isSelected = prev.category_ids.includes(categoryId);
      if (isSelected) {
        return {
          ...prev,
          category_ids: prev.category_ids.filter((id) => id !== categoryId),
        };
      }
      if (prev.category_ids.length >= 2) {
        return prev;
      }
      return {
        ...prev,
        category_ids: [...prev.category_ids, categoryId],
      };
    });
  };

  const loadRfqs = async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get<RFQ[]>("/api/rfqs/");
      setRfqs(data);
      if (!data.length) {
        setSelectedRfq(null);
        setSelectedRfqId(null);
        return;
      }

      const currentId = selectedRfqId;
      const hasCurrent = currentId ? data.some((rfq) => rfq.id === currentId) : false;
      const nextId = hasCurrent ? currentId! : data[0].id;

      await loadRfqDetails(nextId);
    } finally {
      setIsLoading(false);
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

  const loadSuppliers = async () => {
    if (!canCreate) return; // Only load for Procurement/SuperAdmin
    try {
      const { data } = await apiClient.get<SupplierWithUser[]>("/api/admin/suppliers");
      setSuppliers(
        data.map((supplier) => {
          const categories = [...(supplier.categories ?? [])].sort((a, b) => {
            if (a.category_type === b.category_type) {
              return 0;
            }
            return a.category_type === "primary" ? -1 : 1;
          });
          return {
            ...supplier,
            categories,
          };
        })
      );
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    }
  };

  const loadRequests = async () => {
    if (!canCreate) return; // Only load for Procurement/SuperAdmin
    try {
      const { data } = await apiClient.get<PurchaseRequest[]>("/api/requests/");
      setRequests(data);
      if (data.length) {
        setSelectedRequest((prev) => {
          if (!prev) {
            return data[0];
          }
          const updated = data.find((request) => request.id === prev.id);
          return updated ?? data[0];
        });
      } else {
        setSelectedRequest(null);
      }
    } catch (err) {
      console.error("Failed to load purchase requests:", err);
    }
  };

  const loadPurchaseOrders = async () => {
    setIsLoadingPurchaseOrders(true);
    try {
      const { data } = await apiClient.get<PurchaseOrderApi[]>("/api/rfqs/purchase-orders");
      const rows = data.map((order) => ({
        id: order.id,
        poNumber: order.po_number,
        supplierId: order.supplier_id,
        supplierName: order.supplier_name ?? (order.supplier_id ? `Supplier #${order.supplier_id}` : "Supplier"),
        supplierNumber: order.supplier_number,
        amount: Number(order.amount ?? 0),
        currency: order.currency,
        rfqTitle: order.rfq_title,
        rfqNumber: order.rfq_number ?? undefined,
        rfqId: order.rfq_id,
        approvedAt: order.approved_at,
        submittedAt: order.submitted_at,
      }));
      setPurchaseOrders(rows);
    } catch (err) {
      console.error("Failed to load purchase orders:", err);
    } finally {
      setIsLoadingPurchaseOrders(false);
    }
  };

  const loadDeliveredContracts = async () => {
    setIsLoadingDeliveredContracts(true);
    try {
      // Get all RFQs and filter for those with delivered quotations
      const { data: allRfqs } = await apiClient.get<RFQ[]>("/api/rfqs/");
      const deliveredQuotations: Quotation[] = [];
      
      // Fetch details for each RFQ to get quotations
      for (const rfq of allRfqs) {
        try {
          const { data: rfqDetails } = await apiClient.get<RFQWithQuotations>(`/api/rfqs/${rfq.id}`);
          const delivered = rfqDetails.quotations?.filter(q => q.delivery_status === "delivered") || [];
          
          // Add RFQ info to each quotation for display
          delivered.forEach(q => {
            (q as any).rfq_title = rfqDetails.title;
            (q as any).rfq_number = rfqDetails.rfq_number;
            (q as any).rfq_category = rfqDetails.category;
          });
          
          deliveredQuotations.push(...delivered);
        } catch (err) {
          console.error(`Failed to load details for RFQ ${rfq.id}:`, err);
        }
      }
      
      // Sort by delivery date (most recent first)
      deliveredQuotations.sort((a, b) => {
        const dateA = a.delivered_at ? new Date(a.delivered_at).getTime() : 0;
        const dateB = b.delivered_at ? new Date(b.delivered_at).getTime() : 0;
        return dateB - dateA;
      });
      
      setDeliveredContracts(deliveredQuotations);
    } catch (err) {
      console.error("Failed to load delivered contracts:", err);
    } finally {
      setIsLoadingDeliveredContracts(false);
    }
  };

  const handleSelectRequestItem = (request: PurchaseRequest) => {
    setSelectedRequest(request);
    if (isApproveModalOpen) {
      setIsApproveModalOpen(false);
      setIsApproveReadOnly(false);
    }
  };

  const loadRfqDetails = async (rfqId: number) => {
    setSelectedRfqId(rfqId);
    setIsLoadingRfqDetail(true);
    try {
      const { data } = await apiClient.get<RFQWithQuotations>(`/api/rfqs/${rfqId}`);
      setSelectedRfq(data);
    } catch (err) {
      console.error("Failed to load RFQ details:", err);
      setError(parseErrorMessage(err) || "Unable to load RFQ details at the moment.");
    } finally {
      setIsLoadingRfqDetail(false);
    }
  };

  const handleSelectRfqListItem = (rfq: RFQ) => {
    void loadRfqDetails(rfq.id);
  };

  const loadCategoryDetails = async (categoryId: number) => {
    const category = categories.find((item) => item.id === categoryId);
    try {
      const { data } = await apiClient.get<CategoryDetails>(`/api/admin/categories/${categoryId}/details`);
      setSelectedCategory(data);
      setIsCategoryDetailOpen(true);
    } catch (err) {
      console.error("Failed to load category details:", err);
      if (axios.isAxiosError(err)) {
        console.error("Response status:", err.response?.status);
        console.error("Response data:", err.response?.data);
      }

      if (category) {
        const derivedDetails = buildCategoryDetails(category, rfqs);
        setSelectedCategory(derivedDetails);
        setIsCategoryDetailOpen(true);
        setError(null);
        return;
      }

      const message = parseErrorMessage(err) || "Failed to load category details.";
      setError(message);
    }
  };

  useEffect(() => {
    loadRfqs();
    loadCategories();
    loadSuppliers();
    loadRequests();
    loadPurchaseOrders();
    loadDeliveredContracts();
    
    // Auto-refresh requests every 30 seconds to catch finance approvals
    const requestsInterval = setInterval(() => {
      loadRequests();
    }, 30000); // 30 seconds
    
    return () => {
      clearInterval(requestsInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track RFQ updates and show notification badge
  useEffect(() => {
    if (rfqs.length > 0) {
      // On first load (when lastRfqCheckTime is 0), set it to current time
      // This prevents showing updates from the past as "new"
      if (lastRfqCheckTime === 0) {
        setLastRfqCheckTime(Date.now());
      } else {
        // Count how many RFQs were updated after the last check
        const newUpdates = rfqs.filter(rfq => {
          const updatedAt = rfq.updated_at ? new Date(rfq.updated_at).getTime() : 0;
          return updatedAt > lastRfqCheckTime;
        }).length;
        setUnreadRfqUpdates(newUpdates);
      }
    }
  }, [rfqs, lastRfqCheckTime]);

  // Track request updates and show notification badge
  useEffect(() => {
    if (requests.length > 0) {
      // On first load (when lastRequestCheckTime is 0), set it to current time
      // This prevents showing updates from the past as "new"
      if (lastRequestCheckTime === 0) {
        setLastRequestCheckTime(Date.now());
      } else {
        // Count how many requests were updated after the last check
        const newUpdates = requests.filter(request => {
          const updatedAt = request.updated_at ? new Date(request.updated_at).getTime() : 0;
          return updatedAt > lastRequestCheckTime;
        }).length;
        setUnreadRequestUpdates(newUpdates);
      }
    }
  }, [requests, lastRequestCheckTime]);

  // Mark as read when tabs are clicked
  useEffect(() => {
    if (activeTab === "rfqs") {
      setUnreadRfqUpdates(0);
      setLastRfqCheckTime(Date.now());
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "requests") {
      setUnreadRequestUpdates(0);
      setLastRequestCheckTime(Date.now());
    }
  }, [activeTab]);

  const closeCreateRfqModal = () => {
    setIsCreateOpen(false);
    setForm({ ...emptyForm });
    setRfqAttachments([]);
    setRfqSelectedSupplierIds([]);
    lastRfqCategoryRef.current = null;
  };

  const handleCreateRfq = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Validate deadline is in the future
      const deadline = new Date(form.deadline);
      const now = new Date();
      if (deadline <= now) {
        setError("RFQ deadline must be in the future. Please select a later date and time.");
        setSubmitting(false);
        return;
      }
      
      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("category", form.category);
      formData.append("budget", form.budget);
      formData.append("currency", form.currency);
      // Convert deadline from user's timezone to UTC before sending to backend
      formData.append("deadline", toUtc(form.deadline));
      rfqSelectedSupplierIds.forEach((supplierId) =>
        formData.append("supplier_ids", String(supplierId))
      );
      rfqAttachments.forEach((file) => formData.append("files", file));

      await apiClient.post("/api/rfqs/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      closeCreateRfqModal();
      await loadRfqs();
    } catch (err) {
      console.error(err);
      const message =
        parseErrorMessage(err) || "Unable to create RFQ. Please review the details and try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      // Create FormData to handle file uploads
      const formData = new FormData();
      formData.append("company_name", supplierForm.company_name);
      formData.append("contact_email", supplierForm.contact_email);
      formData.append("full_name", supplierForm.full_name);
      formData.append("password", supplierForm.password);
      
      if (supplierForm.contact_phone) {
        formData.append("contact_phone", supplierForm.contact_phone);
      }
      if (supplierForm.address) {
        formData.append("address", supplierForm.address);
      }
      if (supplierForm.preferred_currency) {
        formData.append("preferred_currency", supplierForm.preferred_currency);
      }
      if (supplierForm.category_ids.length) {
        supplierForm.category_ids.forEach((categoryId) => {
          formData.append("category_ids", String(categoryId));
        });
      }

      // Append files from the form
      const form = event.currentTarget;
      const taxClearanceInput = form.querySelector('input[name="tax_clearance"]') as HTMLInputElement;
      const certInput = form.querySelector('input[name="certificate_of_incorporation"]') as HTMLInputElement;
      const otherDocsInput = form.querySelector('input[name="other_documents"]') as HTMLInputElement;

      if (taxClearanceInput?.files?.[0]) {
        formData.append("tax_clearance", taxClearanceInput.files[0]);
      }
      if (certInput?.files?.[0]) {
        formData.append("certificate_of_incorporation", certInput.files[0]);
      }
      if (otherDocsInput?.files) {
        Array.from(otherDocsInput.files).forEach((file) => {
          formData.append("other_documents", file);
        });
      }

      await apiClient.post("/api/admin/suppliers", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      
      setIsCreateSupplierOpen(false);
      setSupplierForm({ ...emptySupplierForm });
      setSuccess("Supplier created successfully! Login credentials have been emailed.");
      await loadSuppliers();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error("Full error:", err);
      if (axios.isAxiosError(err)) {
        console.error("Response data:", err.response?.data);
        console.error("Response status:", err.response?.status);
        console.error("Validation errors:", JSON.stringify(err.response?.data, null, 2));
      }
      const message =
        parseErrorMessage(err) ||
        "Unable to create supplier. Please check the details and try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const openApproveRfqModal = (rfq: RFQ) => {
    setRfqToApprove(rfq);
    setSelectedSupplierIdsForApproval([]);
    setIsApproveRfqModalOpen(true);
  };

  const closeApproveRfqModal = () => {
    setIsApproveRfqModalOpen(false);
    setRfqToApprove(null);
    setSelectedSupplierIdsForApproval([]);
  };

  const handleApproveDraftRfq = async () => {
    if (!rfqToApprove) return;
    
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/api/rfqs/${rfqToApprove.id}/approve-draft`, {
        supplier_ids: selectedSupplierIdsForApproval
      });
      setSuccess("RFQ approved and invitations sent to selected suppliers!");
      closeApproveRfqModal();
      await loadRfqs();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error(err);
      const message = parseErrorMessage(err) || "Unable to approve RFQ. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveQuotation = async (rfqId: number, quotationId: number, overrideJustification?: string) => {
    try {
      // Check if quotation exceeds budget before approval
      if (!overrideJustification) {
        const quotation = selectedRfq?.quotations?.find((q) => q.id === quotationId);
        const rfq = selectedRfq;
        
        if (quotation && rfq?.budget) {
          const quotationTotal = quotation.amount + (quotation.tax_amount || 0);
          const approvedBudget = rfq.budget;
          
          if (quotationTotal > approvedBudget) {
            // Check if user is Procurement - they need to request finance approval
            if (user?.role?.toLowerCase() === "procurement") {
              // Show modal to request finance approval instead
              setPendingApproval({ rfqId, quotationId });
              setIsBudgetOverrideModalOpen(true);
              return;
            }
            
            // Show budget override modal for Finance/SuperAdmin
            setPendingApproval({ rfqId, quotationId });
            setIsBudgetOverrideModalOpen(true);
            return;
          }
        }
      }
      
      const params = overrideJustification 
        ? { budget_override_justification: overrideJustification }
        : {};
        
      await apiClient.post(`/api/rfqs/${rfqId}/quotations/${quotationId}/approve`, null, { params });
      await loadRfqDetails(rfqId);
      await loadRfqs();
      await loadPurchaseOrders();
      
      // Clear pending approval state
      setPendingApproval(null);
      setBudgetOverrideJustification("");
      setIsBudgetOverrideModalOpen(false);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 403) {
        setError("You do not have permission to approve this quotation. Only Finance or SuperAdmin can approve quotations that exceed the budget.");
      } else {
        setError("Failed to approve quotation. Please retry.");
      }
    }
  };

  const handleRequestFinanceApproval = async () => {
    if (!pendingApproval || !budgetOverrideJustification.trim()) {
      setError("Please provide a justification for the budget override.");
      return;
    }
    
    try {
      const { rfqId, quotationId } = pendingApproval;
      
      await apiClient.post(
        `/api/rfqs/${rfqId}/quotations/${quotationId}/request-finance-approval`,
        null,
        { params: { budget_override_justification: budgetOverrideJustification } }
      );
      
      await loadRfqDetails(rfqId);
      await loadRfqs();
      
      // Clear pending approval state
      setPendingApproval(null);
      setBudgetOverrideJustification("");
      setIsBudgetOverrideModalOpen(false);
      
      // Show success message
      setError("Finance approval request submitted successfully. Waiting for Finance team to review.");
    } catch (err: any) {
      console.error(err);
      setError("Failed to submit finance approval request. Please retry.");
    }
  };

  const handleMarkDelivered = async () => {
    if (!deliveryQuotation || !deliveryDate || !deliveryNote) {
      setError("Please provide delivery date and upload delivery note.");
      return;
    }
    
    setSubmitting(true);
    try {
      const { rfqId, quotationId } = deliveryQuotation;
      
      const formData = new FormData();
      formData.append("delivered_at", deliveryDate);
      formData.append("delivery_note", deliveryNote);
      
      await apiClient.post(
        `/api/rfqs/${rfqId}/quotations/${quotationId}/mark-delivered`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      
      await loadRfqDetails(rfqId);
      await loadRfqs();
      await loadDeliveredContracts();
      
      // Clear state and close modal
      setDeliveryQuotation(null);
      setDeliveryDate("");
      setDeliveryNote(null);
      setIsDeliveryModalOpen(false);
      
      setError("Contract marked as delivered successfully!");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to mark contract as delivered. Please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  const openQuotationDetails = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setIsQuotationDetailOpen(true);
  };

  const closeQuotationDetails = () => {
    setSelectedQuotation(null);
    setIsQuotationDetailOpen(false);
  };

  const handleDownloadDeliveryNote = async (rfqId: number, quotationId: number, filename?: string) => {
    try {
      const response = await apiClient.get(
        `/api/rfqs/${rfqId}/quotations/${quotationId}/delivery-note/download`,
        {
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename || 'delivery_note.pdf');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to download delivery note:', err);
      setError('Failed to download delivery note. Please try again.');
    }
  };

  const handleDownloadQuotation = async (rfqId: number, quotationId: number, filename?: string) => {
    try {
      const response = await apiClient.get(
        `/api/rfqs/${rfqId}/quotations/${quotationId}/download`,
        {
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename || 'quotation.pdf');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to download quotation:', err);
      setError('Failed to download quotation. Please try again.');
    }
  };

  const getDownloadUrl = (documentPath: string) => {
    // If path contains 'uploads' (old absolute paths), extract relative part
    const uploadIndex = documentPath.lastIndexOf('uploads');
    if (uploadIndex !== -1) {
      const relativePath = documentPath.substring(uploadIndex + 7).replace(/^[\/\\]+/, '');
      return `http://localhost:8000/uploads/${relativePath}`;
    }
    
    // For new relative paths, just prepend the uploads base URL
    return `http://localhost:8000/uploads/${documentPath}`;
  };

  const isImageDocument = (document: RequestDocument) => {
    const name = (document.original_filename || document.file_path || "").toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
  };

  const imageDocuments = selectedRequest?.documents?.filter(isImageDocument) ?? [];
  const otherDocuments = selectedRequest?.documents?.filter((document) => !isImageDocument(document)) ?? [];
  const selectedRequestIsPending =
    selectedRequest?.status === "pending_procurement" || selectedRequest?.status === "pending";
  const selectedRequestCanInvite =
    (selectedRequest?.status === "finance_approved" || selectedRequest?.status === "rfq_issued") &&
    !selectedRequest?.rfq_invited_at;
  const canSendToSuppliers = user?.role === "Procurement" || user?.role === "SuperAdmin";

  const selectedRfqHasApprovedQuotation = useMemo(
    () => selectedRfq?.quotations?.some((quotation) => quotation.status === "approved") ?? false,
    [selectedRfq]
);

  const handleCreateCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/api/admin/categories", categoryForm);
      setSuccess("Category created successfully!");
      setIsCreateCategoryOpen(false);
      setCategoryForm({ name: "", description: "" });
      await loadCategories();
      setTimeout(() => setSuccess(null), 5000);
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
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete category");
    }
  };

  const openMessageModal = (supplier: SupplierWithUser) => {
    setSelectedSupplier(supplier);
    setMessageForm({
      recipient_id: 0, // Will be set based on supplier user
      supplier_id: supplier.id,
      subject: "",
      content: ""
    });
    setIsMessageModalOpen(true);
  };

  const openSupplierProfile = (supplier: SupplierWithUser) => {
    setSelectedSupplier(supplier);
    setIsSupplierProfileOpen(true);
  };

  const closeSupplierProfile = () => {
    setIsSupplierProfileOpen(false);
    setSelectedSupplier(null);
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSupplier) return;

    try {
      setSubmitting(true);
      
      // Get the supplier's user ID
      const userResponse = await apiClient.get(`/api/admin/suppliers/${selectedSupplier.id}/user`);
      const messageData = {
        ...messageForm,
        recipient_id: userResponse.data.user_id
      };
      
      await apiClient.post("/api/messages/", messageData);
      setSuccess("Message sent successfully!");
      setIsMessageModalOpen(false);
      setMessageForm({
        recipient_id: 0,
        supplier_id: 0,
        subject: "",
        content: ""
      });
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to send message");
    } finally {
      setSubmitting(false);
    }
  };

  // Keep tab and search scope in sync
  useEffect(() => {
    const scopeForTab: Record<typeof activeTab, SearchScope> = {
      rfqs: "rfqs",
      suppliers: "suppliers",
      categories: "categories",
      requests: "requests",
      purchaseOrders: "purchaseOrders",
      deliveryNotes: "deliveryNotes",
    };
    const tabForScope: Record<SearchScope, typeof activeTab> = {
      rfqs: "rfqs",
      suppliers: "suppliers",
      categories: "categories",
      requests: "requests",
      purchaseOrders: "purchaseOrders",
      deliveryNotes: "deliveryNotes",
    };
    
    const expectedScope = scopeForTab[activeTab];
    const expectedTab = tabForScope[searchScope];
    
    // Check if searchScope changed (user selected from dropdown)
    const scopeChanged = prevSearchScopeRef.current !== null && prevSearchScopeRef.current !== searchScope;
    
    if (scopeChanged) {
      // User changed scope from dropdown, update tab
      if (activeTab !== expectedTab) {
        setActiveTab(expectedTab);
      }
    } else {
      // Tab was clicked or initial load, update scope
      if (searchScope !== expectedScope) {
        setSearchScope(expectedScope);
      }
    }
    
    // Update ref for next render
    prevSearchScopeRef.current = searchScope;
  }, [activeTab, searchScope]);

  // Countdown timer for RFQ deadline
  useEffect(() => {
    if (!selectedRfq || !selectedRfq.deadline) {
      setDeadlineTimer("");
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const deadline = new Date(selectedRfq.deadline).getTime();
      const distance = deadline - now;

      if (distance < 0) {
        setDeadlineTimer("Deadline passed");
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      if (days > 0) {
        setDeadlineTimer(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else if (hours > 0) {
        setDeadlineTimer(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setDeadlineTimer(`${minutes}m ${seconds}s`);
      } else {
        setDeadlineTimer(`${seconds}s`);
      }
    };

    updateTimer(); // Initial update
    const interval = setInterval(updateTimer, 1000); // Update every second

    return () => clearInterval(interval);
  }, [selectedRfq]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const rfqsToDisplay = useMemo(() => {
    if (searchScope !== "rfqs" || !normalizedSearch) {
      return rfqs;
    }
    return rfqs.filter((rfq) => {
      const fields = [
        rfq.title,
        rfq.description,
        rfq.category,
        rfq.rfq_number,
        rfq.status,
      ];
      return fields.some((field) =>
        String(field ?? "").toLowerCase().includes(normalizedSearch)
      );
    });
  }, [rfqs, searchScope, normalizedSearch]);

  const suppliersToDisplay = useMemo(() => {
    if (searchScope !== "suppliers" || !normalizedSearch) {
      return suppliers;
    }
    return suppliers.filter((supplier) => {
      const categoryNames = supplier.categories?.map((category) => category.name) ?? [];
      const fields = [
        supplier.company_name,
        supplier.user_email,
        supplier.contact_phone,
        supplier.preferred_currency,
        supplier.supplier_number,
        ...categoryNames,
      ];
      return fields.some((field) =>
        String(field ?? "").toLowerCase().includes(normalizedSearch)
      );
    });
  }, [suppliers, searchScope, normalizedSearch]);

  const categoriesToDisplay = useMemo(() => {
    if (searchScope !== "categories" || !normalizedSearch) {
      return categories;
    }
    return categories.filter((category) => {
      const fields = [category.name, category.description];
      return fields.some((field) =>
        String(field ?? "").toLowerCase().includes(normalizedSearch)
      );
    });
  }, [categories, searchScope, normalizedSearch]);

  const requestsToDisplay = useMemo(() => {
    if (searchScope !== "requests" || !normalizedSearch) {
      return requests;
    }
    return requests.filter((request) => {
      const fields = [
        request.title,
        request.description,
        request.justification,
        request.category,
        request.status,
        request.requester_name,
        request.department_name,
        request.rfq_number,
        String(request.id),
      ];
      return fields.some((field) =>
        String(field ?? "").toLowerCase().includes(normalizedSearch)
      );
    });
  }, [requests, searchScope, normalizedSearch]);
  const purchaseOrdersToDisplay = useMemo(() => {
    if (searchScope !== "purchaseOrders" || !normalizedSearch) {
      return purchaseOrders;
    }
    return purchaseOrders.filter((order) => {
      const fields = [
        order.poNumber,
        order.supplierName,
        order.supplierNumber ?? "",
        order.rfqTitle,
        order.rfqNumber ?? "",
        String(order.id),
      ];
      return fields.some((field) => String(field).toLowerCase().includes(normalizedSearch));
    });
  }, [purchaseOrders, searchScope, normalizedSearch]);

  const deliveredContractsToDisplay = useMemo(() => {
    if (searchScope !== "deliveryNotes" || !normalizedSearch) {
      return deliveredContracts;
    }
    return deliveredContracts.filter((contract) => {
      const fields = [
        contract.rfq_title,
        contract.rfq_number ?? "",
        contract.supplier_name,
        contract.supplier_number ?? "",
        String(contract.quotation_id),
      ];
      return fields.some((field) => String(field).toLowerCase().includes(normalizedSearch));
    });
  }, [deliveredContracts, searchScope, normalizedSearch]);

  const activeSearchLabel = useMemo(() => {
    const match = SEARCH_SCOPE_OPTIONS.find((option) => option.value === searchScope);
    return match ? match.label : "Items";
  }, [searchScope]);

  const suppliersHeaderCount =
    searchScope === "suppliers" && normalizedSearch.length > 0
      ? `${suppliersToDisplay.length} of ${suppliers.length}`
      : `${suppliers.length}`;

  const rfqsHeaderCount =
    searchScope === "rfqs" && normalizedSearch.length > 0
      ? `${rfqsToDisplay.length} of ${rfqs.length}`
      : `${rfqs.length}`;

  const categoriesHeaderCount =
    searchScope === "categories" && normalizedSearch.length > 0
      ? `${categoriesToDisplay.length} of ${categories.length}`
      : `${categories.length}`;

  const purchaseOrdersHeaderCount =
    searchScope === "purchaseOrders" && normalizedSearch.length > 0
      ? `${purchaseOrdersToDisplay.length} of ${purchaseOrders.length}`
      : `${purchaseOrders.length}`;

  const deliveryNotesHeaderCount =
    searchScope === "deliveryNotes" && normalizedSearch.length > 0
      ? `${deliveredContractsToDisplay.length} of ${deliveredContracts.length}`
      : `${deliveredContracts.length}`;

  const purchaseOrderSupplierCount = useMemo(() => {
    const unique = new Set<string>();
    purchaseOrders.forEach((order) => unique.add(order.supplierName));
    return unique.size;
  }, [purchaseOrders]);

  const purchaseOrdersThisMonth = useMemo(() => {
    const now = new Date();
    return purchaseOrders.filter((order) => {
      const reference = order.approvedAt ?? order.submittedAt;
      if (!reference) return false;
      const referenceDate = new Date(reference);
      return referenceDate.getFullYear() === now.getFullYear() && referenceDate.getMonth() === now.getMonth();
    }).length;
  }, [purchaseOrders]);

  const purchaseOrderAmountsByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    purchaseOrders.forEach((order) => {
      const currency = order.currency ?? "USD";
      totals.set(currency, (totals.get(currency) ?? 0) + order.amount);
    });
    return totals;
  }, [purchaseOrders]);

  const purchaseOrderAmountSummary = useMemo(() => {
    if (purchaseOrderAmountsByCurrency.size === 0) {
      return "-";
    }
    return Array.from(purchaseOrderAmountsByCurrency.entries())
      .map(([currency, amount]) => formatCurrency(amount, currency))
      .join(" � ");
  }, [purchaseOrderAmountsByCurrency, formatCurrency]);

  const pendingRequestCount = requests.filter((request) =>
    request.status === "pending_procurement" || request.status === "pending"
  ).length;

  const requestsHeaderCount =
    searchScope === "requests" && normalizedSearch.length > 0
      ? `${requestsToDisplay.length} of ${requests.length}`
      : `${pendingRequestCount}`;

  const handleSearchScopeChange = (value: SearchScope) => {
    setSearchScope(value);
    const tabForScope: Record<SearchScope, typeof activeTab> = {
      rfqs: "rfqs",
      suppliers: "suppliers",
      requests: "requests",
      categories: "categories",
      purchaseOrders: "purchaseOrders",
    };
    setActiveTab(tabForScope[value]);
  };

  const handleOpenMessageCenter = async () => {
    setIsMessageCenterOpen(true);
    setIsLoadingMessages(true);
    setSentMessages([]);
    setReceivedMessages([]);
    try {
      const [sentRes, receivedRes] = await Promise.all([
        apiClient.get<MessageListResponse>("/api/messages/sent"),
        apiClient.get<MessageListResponse>("/api/messages/received")
      ]);
      setSentMessages(sentRes.data.messages ?? []);
      setReceivedMessages(receivedRes.data.messages ?? []);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load messages");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const closeMessageCenter = () => {
    setIsMessageCenterOpen(false);
    setMessageViewMode("sent");
    setSelectedMessageInCenter(null);
  };

  const handleViewMessage = async (message: Message) => {
    setSelectedMessageInCenter(message);
    setIsMessageDetailOpen(true);
    setReplyContent("");
    
    // Mark as read if it's an unread received message
    if (messageViewMode === "received" && message.status === "sent") {
      try {
        await apiClient.put(`/api/messages/${message.id}/read`);
        
        // Update the local state to mark as read
        setReceivedMessages(prev => 
          prev.map(msg => 
            msg.id === message.id 
              ? { ...msg, status: "read", read_at: new Date().toISOString() }
              : msg
          )
        );
      } catch (err) {
        console.error("Failed to mark message as read:", err);
      }
    }
  };

  const handleReplyToMessage = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!selectedMessageInCenter || !replyContent.trim()) {
      return;
    }

    try {
      const replyData = {
        recipient_id: selectedMessageInCenter.sender_id,
        supplier_id: selectedMessageInCenter.supplier_id,
        subject: `Re: ${selectedMessageInCenter.subject}`,
        content: replyContent
      };

      await apiClient.post("/api/messages/reply", replyData);
      
      setReplyContent("");
      setIsMessageDetailOpen(false);
      setSelectedMessageInCenter(null);
      
      // Reload messages to show the new sent message
      await loadMessages();
      
      setError(null);
      setSuccess("Reply sent successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = parseErrorMessage(err) || "Failed to send reply";
      setError(message);
    }
  };

  const toDateTimeLocal = (value: string | Date | null | undefined): string => {
    if (!value) {
      return "";
    }
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const pad = (input: number) => String(input).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const buildApprovalFormState = (request: PurchaseRequest): ApprovalFormState => {
    const preferredAmount = request.finance_budget_amount ?? request.proposed_budget_amount;
    const preferredCurrency =
      request.finance_budget_currency ??
      request.proposed_budget_currency ??
      "ZMW";

    return {
      title: request.title,
      description: request.description,
      justification: request.justification,
      category: request.category,
      needed_by: toDateTimeLocal(request.needed_by),
      budget_amount: preferredAmount ? String(preferredAmount) : "",
      budget_currency: preferredCurrency,
      procurement_notes: request.procurement_notes ?? "",
    };
  };

  const closeApproveModal = () => {
    setIsApproveModalOpen(false);
    setSelectedRequest(null);
    setIsApproveReadOnly(false);
    setApprovalForm(emptyApprovalForm);
  };

  const handleApproveRequest = (request: PurchaseRequest) => {
    setSelectedRequest(request);
    setIsApproveReadOnly(false);
    setApprovalForm(buildApprovalFormState(request));
    setIsApproveModalOpen(true);
  };

  const handleViewRequest = (request: PurchaseRequest) => {
    setSelectedRequest(request);
    setIsApproveReadOnly(true);
    setApprovalForm(buildApprovalFormState(request));
    setIsApproveModalOpen(true);
  };

  const submitApproval = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRequest || isApproveReadOnly) {
      return;
    }
    try {
      setSubmitting(true);
      setError(null);

      const amount = Number(approvalForm.budget_amount);
      if (Number.isNaN(amount) || amount <= 0) {
        setError("Please provide a valid budget amount before approving.");
        setSubmitting(false);
        return;
      }

      const payload: RequestProcurementReviewPayload = {
        budget_amount: amount,
        budget_currency:
          approvalForm.budget_currency ||
          selectedRequest.proposed_budget_currency ||
          "ZMW",
        procurement_notes: approvalForm.procurement_notes || undefined,
      };

      if (approvalForm.title && approvalForm.title !== selectedRequest.title) {
        payload.title = approvalForm.title;
      }
      if (approvalForm.description && approvalForm.description !== selectedRequest.description) {
        payload.description = approvalForm.description;
      }
      if (approvalForm.justification && approvalForm.justification !== selectedRequest.justification) {
        payload.justification = approvalForm.justification;
      }
      if (approvalForm.category && approvalForm.category.trim() !== selectedRequest.category) {
        payload.category = approvalForm.category.trim();
      }
      if (approvalForm.needed_by) {
        const neededByDate = new Date(approvalForm.needed_by);
        if (!Number.isNaN(neededByDate.getTime())) {
          payload.needed_by = neededByDate.toISOString();
        }
      }

      await apiClient.put(`/api/requests/${selectedRequest.id}/approve`, payload);

      setSuccess("Request approved successfully. Ready to send to suppliers.");
      closeApproveModal();
      await loadRequests();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error("Approval error:", err);
      const message = parseErrorMessage(err) || "Failed to approve request";
      setError(message);
      setTimeout(() => setError(null), 10000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDenyRequest = async (requestId: number, reason?: string) => {
    try {
      setSubmitting(true);
      const payload: RequestDenialPayload = {
        reason: reason || "Request denied by Procurement",
      };
      await apiClient.put(`/api/requests/${requestId}/deny`, payload);
      if (isApproveModalOpen) {
        closeApproveModal();
      }
      setSuccess("Request denied successfully!");
      loadRequests(); // Refresh the requests list
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to deny request");
      setTimeout(() => setError(null), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const openInviteModal = (request: PurchaseRequest) => {
    setInviteRequest(request);
    setInviteForm({
      supplier_ids: [],
      rfq_deadline: getDefaultInviteDeadline(request),
      notes: request.procurement_notes ?? "",
    });
    setError(null);
    setIsInviteModalOpen(true);
  };

  const closeInviteModal = () => {
    setIsInviteModalOpen(false);
    setInviteRequest(null);
    setInviteForm({ ...emptyInviteForm });
  };

  const toggleSupplierSelection = (supplierId: number) => {
    setInviteForm((prev) => {
      const alreadySelected = prev.supplier_ids.includes(supplierId);
      const supplier_ids = alreadySelected
        ? prev.supplier_ids.filter((id) => id !== supplierId)
        : [...prev.supplier_ids, supplierId];
      return { ...prev, supplier_ids };
    });
  };

  const submitSupplierInvites = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteRequest) {
      return;
    }

    if (!inviteForm.supplier_ids.length) {
      setError("Select at least one supplier before sending invitations.");
      return;
    }

    if (!inviteForm.rfq_deadline) {
      setError("Choose an RFQ deadline before sending invitations.");
      return;
    }

    const deadline = new Date(inviteForm.rfq_deadline);
    if (Number.isNaN(deadline.getTime())) {
      setError("Provide a valid RFQ deadline.");
      return;
    }

    // Validate deadline is in the future
    const now = new Date();
    if (deadline <= now) {
      setError("RFQ deadline must be in the future. Please select a later date and time.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await apiClient.post(`/api/requests/${inviteRequest.id}/invite-suppliers`, {
        supplier_ids: inviteForm.supplier_ids,
        rfq_deadline: toUtc(inviteForm.rfq_deadline),
        notes: inviteForm.notes || undefined,
      });

      setSuccess("Supplier invitations sent successfully.");
      closeInviteModal();
      await Promise.all([loadRequests(), loadRfqs()]);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error("Supplier invite error:", err);
      const message = parseErrorMessage(err) || "Failed to send supplier invitations.";
      setError(message);
      setTimeout(() => setError(null), 10000);
    } finally {
      setSubmitting(false);
    }
  };

  const renderBudgetSummary = (request: PurchaseRequest) => {
    const budget = request.proposed_budget_amount;

    if (!budget) {
      return <span className="text-xs text-slate-500">Budget pending</span>;
    }

    return (
      <p className="text-xs text-slate-600">
        Budget:{' '}
        <span className="font-medium text-slate-800">
          {formatCurrency(
            Number(budget),
            request.proposed_budget_currency ?? "ZMW"
          )}
        </span>
      </p>
    );
  };

  const resolveRequestNotes = (request: PurchaseRequest) => {
    if (request.procurement_rejection_reason) {
      return `Procurement: ${request.procurement_rejection_reason}`;
    }
    if (request.procurement_notes) {
      return request.procurement_notes;
    }
    return "No additional notes.";
  };

  const stats = useMemo(() => {
    const byStatus = rfqs.reduce(
      (acc, rfq) => {
        acc[rfq.status] = (acc[rfq.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const totalBudget = rfqs.reduce((sum, rfq) => sum + Number(rfq.budget ?? 0), 0);
    return {
      open: byStatus.open ?? 0,
      closed: byStatus.closed ?? 0,
      awarded: byStatus.awarded ?? 0,
      totalBudget
    };
  }, [rfqs]);

  const activeRfqSummary = useMemo(() => {
    if (!selectedRfqId) {
      return null;
    }
    return rfqs.find((rfq) => rfq.id === selectedRfqId) ?? null;
  }, [rfqs, selectedRfqId]);

  const activeRfqDetail =
    selectedRfq && selectedRfqId === selectedRfq.id ? selectedRfq : null;

const actions = canCreate ? (
    <button
      onClick={handleOpenMessageCenter}
      className="rounded-lg border border-secondary bg-white px-4 py-2 text-sm font-semibold text-secondary shadow-sm transition hover:bg-secondary hover:text-white flex items-center gap-2 relative"
    >
      <MessageSquare className="h-4 w-4" />
      Messages
      {receivedMessages.filter((m) => m.status === "sent").length > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs text-white">
          {receivedMessages.filter((m) => m.status === "sent").length}
        </span>
      )}
    </button>
  ) : null;

  return (
    <Layout title="Procurement Dashboard" subtitle="Monitor sourcing activities and supplier responses." actions={actions}>
      {error ? (
        <div className="mb-6 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-6 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-600">
          {success}
        </div>
      ) : null}

      {canCreate ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-center gap-4 sm:gap-5 text-center">
            <button
              onClick={() => {
                setForm((prev) => ({
                  ...emptyForm,
                  category: categories.length ? categories[0].name : "",
                }));
                setRfqAttachments([]);
                setIsCreateOpen(true);
              }}
              className="flex-1 min-w-[200px] rounded-xl bg-secondary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-secondary/80 sm:flex-none sm:w-auto"
            >
              Create RFQ
            </button>
            <button
              onClick={() => {
                setSupplierForm({ ...emptySupplierForm });
                setIsCreateSupplierOpen(true);
              }}
              className="flex-1 min-w-[200px] rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 sm:flex-none sm:w-auto"
            >
              Add Supplier
            </button>
            <button
              onClick={() => setIsCreateCategoryOpen(true)}
              className="flex-1 min-w-[200px] rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 sm:flex-none sm:w-auto"
            >
              Add Category
            </button>
          </div>
          <div className="mb-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_240px] md:items-end">
            <div className="w-full">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Search</label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={`Search ${activeSearchLabel.toLowerCase()}...`}
                  className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm focus:border-secondary focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Scope</label>
              <select
                value={searchScope}
                onChange={(event) => handleSearchScopeChange(event.target.value as SearchScope)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-secondary focus:outline-none md:w-full"
              >
                {SEARCH_SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      ) : (
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="w-full md:max-w-xl">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Search</label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={`Search ${activeSearchLabel.toLowerCase()}...`}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-secondary focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 md:w-auto">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Scope</label>
            <select
              value={searchScope}
              onChange={(event) => handleSearchScopeChange(event.target.value as SearchScope)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-secondary focus:outline-none md:w-52"
            >
              {SEARCH_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Tabs for RFQs, Suppliers, and Categories */}
      {canCreate && (
        <div className="mb-6 -mx-3 sm:mx-0">
          <div className="border-b border-slate-200 overflow-x-auto">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 px-3 sm:px-0 min-w-max">
              <button
                onClick={() => setActiveTab("rfqs")}
                className={clsx(
                  "group flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors relative whitespace-nowrap",
                  activeTab === "rfqs"
                    ? "border-secondary text-secondary"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800"
                )}
              >
                <ClipboardList
                  className={clsx(
                    "h-4 w-4 text-slate-500 transition-colors",
                    activeTab === "rfqs" && "text-secondary"
                  )}
                />
                <span>RFQs</span>
                {unreadRfqUpdates > 0 && (
                  <span className="absolute top-2 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                    {unreadRfqUpdates > 99 ? "99+" : unreadRfqUpdates}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("suppliers")}
                className={clsx(
                  "group flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors whitespace-nowrap",
                  activeTab === "suppliers"
                    ? "border-secondary text-secondary"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800"
                )}
              >
                <Users
                  className={clsx(
                    "h-4 w-4 text-slate-500 transition-colors",
                    activeTab === "suppliers" && "text-secondary"
                  )}
                />
                <span>Suppliers ({suppliersHeaderCount})</span>
              </button>
              <button
                onClick={() => setActiveTab("purchaseOrders")}
                className={clsx(
                  "group flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors whitespace-nowrap",
                  activeTab === "purchaseOrders"
                    ? "border-secondary text-secondary"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800"
                )}
              >
                <ShoppingCart
                  className={clsx(
                    "h-4 w-4 text-slate-500 transition-colors",
                    activeTab === "purchaseOrders" && "text-secondary"
                  )}
                />
                <span>Purchase Orders ({purchaseOrdersHeaderCount})</span>
              </button>
              <button
                onClick={() => setActiveTab("deliveryNotes")}
                className={clsx(
                  "group flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors whitespace-nowrap",
                  activeTab === "deliveryNotes"
                    ? "border-secondary text-secondary"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800"
                )}
              >
                <Package
                  className={clsx(
                    "h-4 w-4 text-slate-500 transition-colors",
                    activeTab === "deliveryNotes" && "text-secondary"
                  )}
                />
                <span>Delivery Notes ({deliveryNotesHeaderCount})</span>
              </button>
              <button
                onClick={() => setActiveTab("categories")}
                className={clsx(
                  "group flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors whitespace-nowrap",
                  activeTab === "categories"
                    ? "border-secondary text-secondary"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800"
                )}
              >
                <FolderTree
                  className={clsx(
                    "h-4 w-4 text-slate-500 transition-colors",
                    activeTab === "categories" && "text-secondary"
                  )}
                />
                <span>Categories ({categoriesHeaderCount})</span>
              </button>
              <button
                onClick={() => setActiveTab("requests")}
                className={clsx(
                  "group flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors relative whitespace-nowrap",
                  activeTab === "requests"
                    ? "border-secondary text-secondary"
                    : "border-transparent text-primary/60 hover:border-secondary/40 hover:text-secondary"
                )}
              >
                <FileText
                  className={clsx(
                    "h-4 w-4 text-slate-500 transition-colors",
                    activeTab === "requests" && "text-secondary"
                  )}
                />
                <span>Requests ({requestsHeaderCount})</span>
                {unreadRequestUpdates > 0 && (
                  <span className="absolute top-2 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                    {unreadRequestUpdates > 99 ? "99+" : unreadRequestUpdates}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>
      )}

      {activeTab === "rfqs" && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Open RFQs" value={stats.open} helperText="Currently receiving supplier quotations." />
            <StatCard label="Closed RFQs" value={stats.closed} helperText="Closed due to deadlines or awards." />
            <StatCard label="Awarded RFQs" value={stats.awarded} helperText="Awaiting contract finalization." />
          </div>

          {/* Sidebar Layout for RFQs */}
          <section className="mt-10 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            {/* Left Sidebar - RFQ List */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-primary">All RFQs</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {rfqsHeaderCount} total �?� {stats.open} open
                </p>
              </div>
              <div className="max-h-[720px] overflow-y-auto p-4 space-y-3">
                {rfqsToDisplay.length > 0 ? (
                  rfqsToDisplay.map((rfq) => {
                    const isSelected = selectedRfqId === rfq.id;
                    const statusColors = {
                      open: "bg-green-100 text-green-800",
                      closed: "bg-slate-200 text-slate-700",
                      awarded: "bg-indigo-100 text-indigo-700",
                      draft: "bg-yellow-100 text-yellow-700"
                    };
                    
                    return (
                      <button
                        key={rfq.id}
                        onClick={() => loadRfqDetails(rfq.id)}
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          isSelected
                            ? "border-secondary bg-secondary/5"
                            : "border-slate-200 hover:border-secondary hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-primary text-sm leading-tight">
                            {rfq.title}
                          </h3>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${
                            statusColors[rfq.status as keyof typeof statusColors] ?? "bg-slate-200 text-slate-700"
                          }`}>
                            {rfq.status}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-600 line-clamp-2">{rfq.description}</p>
                        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-700">{rfq.category}</span>
                          <span className="text-slate-500">
                            {formatDisplay(rfq.deadline, { dateStyle: 'medium' })}
                          </span>
                        </div>
                        {rfq.budget !== undefined && (
                          <p className="mt-2 text-xs font-semibold text-secondary">
                            {formatCurrency(Number(rfq.budget), rfq.currency)}
                          </p>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                      <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-600">{searchScope === "rfqs" && normalizedSearch.length > 0 ? "No RFQs match your search." : "No RFQs yet"}</p>
                    <p className="mt-1 text-xs text-slate-500">{searchScope === "rfqs" && normalizedSearch.length > 0 ? "Try adjusting your keywords or switching search scope." : "Create your first RFQ to get started"}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - RFQ Details */}
            <div className="space-y-6">
              {selectedRfq ? (
                <>
                  {/* RFQ Header Card */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="text-sm font-mono text-slate-500">{selectedRfq.rfq_number}</div>
                        <h2 className="text-xl font-bold text-primary">{selectedRfq.title}</h2>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={clsx(
                            "inline-block rounded-full px-3 py-1 text-xs font-semibold",
                            selectedRfq.status === "draft" && "bg-yellow-100 text-yellow-800",
                            selectedRfq.status === "open" && "bg-green-100 text-green-800",
                            selectedRfq.status === "closed" && "bg-slate-200 text-slate-700",
                            selectedRfq.status === "awarded" && "bg-indigo-100 text-indigo-700"
                          )}>
                            {selectedRfq.status}
                          </span>
                          {selectedRfq.status === "draft" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                              <Clock className="h-3 w-3" strokeWidth={2.5} />
                              Pending Approval
                            </span>
                          )}
                          {selectedRfq.response_locked && new Date(selectedRfq.deadline) > new Date() && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-3 py-1 text-xs font-semibold text-secondary">
                              <Lock className="h-3 w-3" strokeWidth={2.5} />
                              Responses Locked
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-slate-600 mb-4">{selectedRfq.description}</p>
                    
                    {/* Created By Info for Draft RFQs */}
                    {selectedRfq.status === "draft" && selectedRfq.created_by_name && (
                      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <h4 className="text-sm font-semibold text-amber-900 mb-2">Draft RFQ Details</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-amber-800">Created by:</span>
                            <span className="text-amber-900">{selectedRfq.created_by_name}</span>
                            {selectedRfq.created_by_role && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                                {selectedRfq.created_by_role}
                              </span>
                            )}
                          </div>
                          {selectedRfq.documents && selectedRfq.documents.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-medium text-amber-800 mb-2">Attachments:</p>
                              <div className="space-y-1">
                                {selectedRfq.documents.map((doc) => (
                                  <div key={doc.id} className="flex items-center gap-2 text-sm">
                                    <FileText className="h-4 w-4 text-amber-600" />
                                    <a
                                      href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/rfqs/${selectedRfq.id}/documents/${doc.id}/download`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-amber-700 hover:text-amber-900 hover:underline"
                                    >
                                      {doc.original_filename}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Approve Draft RFQ Button for Procurement */}
                    {selectedRfq.status === "draft" && canApproveRfq && (
                      <div className="mb-4">
                        <button
                          onClick={() => openApproveRfqModal(selectedRfq)}
                          disabled={submitting}
                          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Users className="h-4 w-4" />
                          Select Suppliers & Approve
                        </button>
                        <p className="mt-2 text-xs text-slate-500">
                          Choose which suppliers to invite before approving this RFQ.
                        </p>
                      </div>
                    )}
                    
                    <div className="grid gap-4 md:grid-cols-4 text-sm">
                      <div>
                        <p className="text-xs font-medium uppercase text-slate-500">Category</p>
                        <p className="mt-1 font-semibold text-slate-800">{selectedRfq.category}</p>
                      </div>
                      {selectedRfq.budget !== undefined && (
                        <div>
                          <p className="text-xs font-medium uppercase text-slate-500">Budget</p>
                          <p className="mt-1 font-semibold text-slate-800">
                            {formatCurrency(Number(selectedRfq.budget), selectedRfq.currency)}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium uppercase text-slate-500">Deadline</p>
                        <p className="mt-1 font-semibold text-slate-800">
                          {formatDisplay(selectedRfq.deadline, { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase text-slate-500">Quotations</p>
                        <p className="mt-1 font-semibold text-slate-800">
                          {selectedRfq.quotations?.length ?? 0} received
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quotations Card */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-primary">Supplier Quotations</h3>
                      <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
                        {selectedRfq.quotations?.length ?? 0} submissions
                      </span>
                    </div>
                    
                    {/* Locked Status Banner - Show before deadline */}
                    {new Date(selectedRfq.deadline) > new Date() && (
                      <div className="mb-4 rounded-lg border-2 border-secondary/30 bg-gradient-to-r from-secondary/5 to-secondary/10 p-5 shadow-sm">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-secondary/20">
                            <Lock className="h-6 w-6 text-secondary" strokeWidth={2.5} />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-base font-bold text-secondary flex items-center gap-2">
                              Quotations Hidden Until Deadline
                            </h4>
                            <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                              To ensure <strong>fair and unbiased evaluation</strong>, supplier quotations will remain hidden until the deadline passes. 
                              This prevents any advantage or disadvantage based on submission time.
                            </p>
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-secondary flex-shrink-0" strokeWidth={2} />
                                <span className="font-medium text-slate-600">Deadline:</span>
                                <span className="font-semibold text-slate-900">
                                  {formatDisplay(selectedRfq.deadline, { dateStyle: 'medium', timeStyle: 'short' })}
                                </span>
                              </div>
                              {deadlineTimer && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Clock className="h-4 w-4 text-secondary flex-shrink-0" strokeWidth={2} />
                                  <span className="font-medium text-slate-600">Time Remaining:</span>
                                  <span className="font-mono font-bold text-lg text-secondary bg-white px-3 py-1 rounded-md shadow-sm">
                                    {deadlineTimer}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="mt-3 pt-3 border-t border-secondary/20">
                              <div className="flex items-start gap-2 text-xs text-slate-700">
                                <Lightbulb className="h-4 w-4 text-secondary flex-shrink-0 mt-0.5" strokeWidth={2} />
                                <span><strong>Tip:</strong> You can review quotations immediately after the deadline passes. 
                                The system will automatically unlock access at that time.</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      {selectedRfq.quotations && selectedRfq.quotations.length > 0 ? (
                        selectedRfq.quotations.map((quotation: Quotation) => (
                          <div
                            key={quotation.id}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100 cursor-pointer"
                            onClick={() => openQuotationDetails(quotation)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-primary text-sm">
                                  {quotation.supplier_name ?? `Supplier #${quotation.supplier_id}`}
                                </h4>
                                {quotation.supplier_number && (
                                  <p className="text-xs text-slate-500 mt-0.5">{quotation.supplier_number}</p>
                                )}
                                <p className="mt-1 text-lg font-bold text-secondary">
                                  {formatCurrency(Number(quotation.amount), quotation.currency)}
                                </p>
                                {quotation.notes && (
                                  <p className="mt-2 text-xs text-slate-600 line-clamp-2">{quotation.notes}</p>
                                )}
                                <p className="mt-2 text-xs text-slate-500">
                                  Submitted: {new Date(quotation.submitted_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span className={clsx(
                                  "rounded-full px-3 py-1 text-xs font-semibold uppercase whitespace-nowrap",
                                  quotation.status === "approved" && "bg-green-100 text-green-700",
                                  quotation.status === "rejected" && "bg-red-100 text-red-700",
                                  quotation.status === "submitted" && "bg-yellow-100 text-yellow-700"
                                )}>
                                  {quotation.status}
                                </span>
                                {quotation.delivery_status === "delivered" && (
                                  <span className="rounded-full px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700 uppercase">
                                    ✓ Delivered
                                  </span>
                                )}
                                {quotation.status !== "approved" && canApprove && !selectedRfqHasApprovedQuotation && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApproveQuotation(selectedRfq.id, quotation.id);
                                    }}
                                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 whitespace-nowrap"
                                  >
                                    Approve
                                  </button>
                                )}
                                {quotation.status === "approved" && !quotation.delivery_status && canApproveRfq && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeliveryQuotation({ rfqId: selectedRfq.id, quotationId: quotation.id });
                                      setDeliveryDate("");
                                      setDeliveryNote(null);
                                      setIsDeliveryModalOpen(true);
                                    }}
                                    className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 whitespace-nowrap"
                                  >
                                    Mark Delivered
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center">
                          <p className="text-sm text-slate-600">
                            {selectedRfq.response_locked && new Date(selectedRfq.deadline) > new Date()
                              ? "Quotations are locked until deadline"
                              : "No quotations submitted yet"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {selectedRfq.response_locked && new Date(selectedRfq.deadline) > new Date()
                              ? "Check back after the deadline to view supplier responses"
                              : "Suppliers will submit their quotes here"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                    <svg className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">Select an RFQ</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Choose an RFQ from the sidebar to view details and manage quotations
                  </p>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {activeTab === "purchaseOrders" && (
        <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
            <StatCard label="Total Purchase Orders" value={purchaseOrders.length} helperText="Approved quotations converted to purchase orders." />
            <StatCard label="Suppliers" value={purchaseOrderSupplierCount} helperText="Unique vendors with approved orders." />
            <StatCard label="This Month" value={purchaseOrdersThisMonth} helperText="Purchase orders approved this month." />
            <StatCard label="Total Value" value={purchaseOrderAmountSummary} helperText="Aggregated PO value by currency." />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-3 sm:px-6 py-3 sm:py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-primary">Purchase Order Log</h2>
                <p className="text-[10px] sm:text-xs text-slate-500">
                  {purchaseOrdersHeaderCount} purchase orders tracked.
                </p>
              </div>
              <button
                onClick={() => void loadPurchaseOrders()}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-secondary hover:text-secondary disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoadingPurchaseOrders}
              >
                {isLoadingPurchaseOrders ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            {isLoadingPurchaseOrders ? (
              <div className="p-8 text-center text-sm text-slate-600">Loading purchase orders...</div>
            ) : purchaseOrdersToDisplay.length ? (
              <>
                {/* Mobile Card Layout */}
                <div className="sm:hidden divide-y divide-slate-200">
                  {purchaseOrdersToDisplay.map((order) => {
                    const approvedLabel = order.approvedAt ? formatDisplay(order.approvedAt, { dateStyle: 'medium' }) : "Pending";
                    const submittedLabel = order.submittedAt ? formatDisplay(order.submittedAt, { dateStyle: 'medium' }) : "";
                    return (
                      <div key={`${order.id}-${order.poNumber}`} className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-primary truncate">{order.poNumber}</div>
                            <div className="text-xs font-medium text-slate-800 truncate">{order.supplierName}</div>
                            {order.supplierNumber && (
                              <div className="text-[10px] text-slate-500 truncate">{order.supplierNumber}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-semibold text-slate-800">{formatCurrency(order.amount, order.currency)}</div>
                            <div className="text-[10px] text-slate-500">{order.currency}</div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-slate-800 truncate">{order.rfqTitle}</div>
                          {order.rfqNumber && (
                            <div className="text-[10px] font-mono text-slate-500 truncate">{order.rfqNumber}</div>
                          )}
                          <div className="text-[10px] text-slate-600">Approved: {approvedLabel}</div>
                          {submittedLabel && (
                            <div className="text-[10px] text-slate-500">Submitted: {submittedLabel}</div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setActiveTab("rfqs");
                            void loadRfqDetails(order.rfqId);
                          }}
                          className="w-full inline-flex items-center justify-center rounded-lg border border-secondary px-3 py-1.5 text-xs font-semibold text-secondary transition hover:bg-secondary/10"
                        >
                          View RFQ
                        </button>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop Table Layout */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-600">PO Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-600">Supplier</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-600">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-600">RFQ</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-600">Approved</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {purchaseOrdersToDisplay.map((order) => {
                        const approvedLabel = order.approvedAt ? formatDisplay(order.approvedAt, { dateStyle: 'medium' }) : "Pending";
                        const submittedLabel = order.submittedAt ? formatDisplay(order.submittedAt, { dateStyle: 'medium' }) : "";
                        return (
                          <tr key={`${order.id}-${order.poNumber}`} className="hover:bg-slate-50">
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-primary">{order.poNumber}</td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-slate-800">{order.supplierName}</div>
                              {order.supplierNumber ? (
                                <div className="text-xs text-slate-500">{order.supplierNumber}</div>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="text-sm font-semibold text-slate-800">{formatCurrency(order.amount, order.currency)}</div>
                              <div className="text-xs text-slate-500">{order.currency}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-slate-800">{order.rfqTitle}</div>
                              {order.rfqNumber ? (
                                <div className="text-xs font-mono text-slate-500">{order.rfqNumber}</div>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="text-sm text-slate-800">{approvedLabel}</div>
                              {submittedLabel ? (
                                <div className="text-xs text-slate-500">Submitted {submittedLabel}</div>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <button
                                onClick={() => {
                                  setActiveTab("rfqs");
                                  void loadRfqDetails(order.rfqId);
                                }}
                                className="inline-flex items-center rounded-lg border border-secondary px-3 py-1.5 text-xs font-semibold text-secondary transition hover:bg-secondary/10"
                              >
                                View RFQ
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-sm text-slate-600">
                {searchScope === "purchaseOrders" && normalizedSearch.length > 0
                  ? "No purchase orders match your search."
                  : "No purchase orders have been issued yet."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suppliers Tab */}
      {activeTab === "suppliers" && canCreate && (
        <div className="mt-4 sm:mt-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Mobile Card Layout */}
            <div className="sm:hidden">
              {suppliersToDisplay.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {suppliersToDisplay.map((supplier) => (
                    <div key={supplier.id} className="p-3 space-y-2" onClick={() => openSupplierProfile(supplier)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">{supplier.company_name}</div>
                          <div className="text-[10px] font-mono text-slate-700 truncate">{supplier.supplier_number}</div>
                          {supplier.address && (
                            <div className="text-[10px] text-slate-500 truncate">{supplier.address}</div>
                          )}
                        </div>
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold whitespace-nowrap ${
                          supplier.user_active
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}>
                          {supplier.user_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-slate-700 truncate">{supplier.user_email}</div>
                        <div className="text-xs text-slate-700">{supplier.contact_phone || "-"}</div>
                        <div className="text-xs text-slate-700">{supplier.preferred_currency}</div>
                      </div>
                      {supplier.categories && supplier.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {supplier.categories.map((category) => (
                            <span
                              key={`${category.id}-${category.category_type}`}
                              className="inline-flex items-center rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-medium text-secondary"
                            >
                              {category.category_type === "primary" ? "Primary" : "Secondary"}{" · "}{category.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openMessageModal(supplier);
                        }}
                        className="w-full rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Send Message
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-8 text-center text-sm text-slate-600">
                  {searchScope === "suppliers" && normalizedSearch.length > 0
                    ? "No suppliers match your search."
                    : "No suppliers yet. Click \"Add Supplier\" to get started."}
                </div>
              )}
            </div>
            {/* Desktop Table Layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                      Supplier Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                      Contact Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                      Categories
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                      Preferred Currency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {suppliersToDisplay.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-6 py-4 cursor-pointer" onClick={() => openSupplierProfile(supplier)}>
                        <div className="text-sm font-medium text-slate-900">{supplier.company_name}</div>
                        {supplier.address && (
                          <div className="text-xs text-slate-500">{supplier.address}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 cursor-pointer font-mono text-sm text-slate-700" onClick={() => openSupplierProfile(supplier)}>
                        {supplier.supplier_number}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 cursor-pointer" onClick={() => openSupplierProfile(supplier)}>
                          <div className="text-sm text-slate-700">{supplier.user_email}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 cursor-pointer" onClick={() => openSupplierProfile(supplier)}>
                        <div className="text-sm text-slate-700">
                          {supplier.contact_phone || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => openSupplierProfile(supplier)}>
                        {supplier.categories && supplier.categories.length ? (
                          <div className="flex flex-wrap gap-2 text-xs">
                            {supplier.categories.map((category) => (
                              <span
                      key={`${category.id}-${category.category_type}`}
                      className="inline-flex items-center rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary"
                    >
                      {category.category_type === "primary" ? "Primary" : "Secondary"}{" \u00B7 "}{category.name}
                    </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">No categories</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 cursor-pointer" onClick={() => openSupplierProfile(supplier)}>
                        <div className="text-sm text-slate-700">
                          {supplier.preferred_currency}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 cursor-pointer" onClick={() => openSupplierProfile(supplier)}>
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            supplier.user_active
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                            {supplier.user_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openMessageModal(supplier);
                          }}
                          className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Send Message
                        </button>
                      </td>
                    </tr>
                  ))}
                    {suppliersToDisplay.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-600">
                          {searchScope === "suppliers" && normalizedSearch.length > 0
                            ? "No suppliers match your search."
                            : "No suppliers available yet."}
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
              {suppliers.length === 0 && (
                <div className="px-6 py-8 text-center text-sm text-slate-600">
                  No suppliers yet. Click "Add Supplier" to get started.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === "categories" && (
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="p-3 sm:p-6">
            <h2 className="mb-3 sm:mb-4 text-base sm:text-lg font-semibold text-primary">Procurement Categories</h2>
            {/* Mobile Card Layout */}
            <div className="sm:hidden">
              {categoriesToDisplay.length > 0 ? (
                <div className="space-y-3">
                  {categoriesToDisplay.map((category) => (
                    <div
                      key={category.id}
                      className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer"
                      onClick={() => loadCategoryDetails(category.id)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="text-sm font-medium text-slate-900 truncate flex-1">{category.name}</div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(category.id);
                          }}
                          className="text-xs font-medium text-red-600 hover:text-red-900 whitespace-nowrap"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="text-xs text-slate-700 mb-1 line-clamp-2">{category.description || "-"}</div>
                      <div className="text-[10px] text-slate-500">
                        Created: {category.created_at ? new Date(category.created_at).toLocaleDateString() : "-"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-8 text-center text-sm text-slate-600">
                  {searchScope === "categories" && normalizedSearch.length > 0
                    ? "No categories match your search."
                    : "No categories yet. Click \"Add Category\" to get started."}
                </div>
              )}
            </div>
            {/* Desktop Table Layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {categoriesToDisplay.map((category) => (
                    <tr 
                      key={category.id} 
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => loadCategoryDetails(category.id)}
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-medium text-slate-900">{category.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-700">{category.description || "-"}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-slate-700">
                          {category.created_at ? new Date(category.created_at).toLocaleDateString() : "-"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(category.id);
                          }}
                          className="text-sm font-medium text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {categoriesToDisplay.length === 0 && (
                <div className="px-6 py-8 text-center text-sm text-slate-600">
                  {searchScope === "categories" && normalizedSearch.length > 0
                    ? "No categories match your search."
                    : "No categories yet. Click \"Add Category\" to get started."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === "requests" && (
        <section className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-primary">Purchase Requests</h2>
              <p className="text-xs text-slate-500">
                {requestsToDisplay.length ? (searchScope === "requests" && normalizedSearch.length > 0 ? `${requestsToDisplay.length} match${requestsToDisplay.length === 1 ? "" : "es"}` : `${requests.length} total`) : "No requests yet"}
              </p>
            </div>
            <div className="max-h-[620px] overflow-y-auto">
              {requestsToDisplay.length ? (
                <ul className="divide-y divide-slate-100">
                  {requestsToDisplay.map((request) => {
                    const isActive = selectedRequest?.id === request.id;
                    const isPendingProcurement =
                      request.status === "pending_procurement" || request.status === "pending";
                    const effectiveAmount =
                      request.finance_budget_amount ?? request.proposed_budget_amount ?? null;
                    const effectiveCurrency =
                      request.finance_budget_currency ?? request.proposed_budget_currency ?? "ZMW";
                    return (
                      <li key={request.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectRequestItem(request)}
                          className={clsx(
                            "w-full px-5 py-4 text-left transition",
                            isActive
                              ? "bg-secondary/10 text-secondary"
                              : "text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold">{request.title}</span>
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                requestStatusStyles[request.status] ?? "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {requestStatusLabels[request.status] ?? request.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            Needed by {new Date(request.needed_by).toLocaleDateString()}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Requester: {request.requester_name || "Unknown"}
                          </p>
                          {request.department_name ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Department: {request.department_name}
                            </p>
                          ) : null}
                          {request.rfq_number ? (
                            <p className="mt-1 text-xs font-mono text-slate-500">
                              RFQ #: {request.rfq_number}
                            </p>
                          ) : null}
                          {effectiveAmount ? (
                            <p className="mt-1 text-xs font-medium text-slate-700">
                              Budget {formatCurrency(Number(effectiveAmount), effectiveCurrency)}
                            </p>
                          ) : (
                            isPendingProcurement && (
                              <p className="mt-1 text-xs text-amber-600">
                                Budget pending procurement review
                              </p>
                            )
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex items-center justify-center px-5 py-10 text-sm text-slate-600">
                  {searchScope === "requests" && normalizedSearch.length > 0
                    ? "No purchase requests match your search."
                    : "Requesters have not submitted any purchase requests yet."}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Request Overview</h2>
                  <p className="text-sm text-slate-600">
                    {selectedRequest
                      ? "Inspect request context, notes, and supporting documents."
                      : "Select a purchase request to see its details."}
                  </p>
                </div>
                {selectedRequest ? (
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      requestStatusStyles[selectedRequest.status] ?? "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {requestStatusLabels[selectedRequest.status] ?? selectedRequest.status}
                  </span>
                ) : null}
              </div>

              {selectedRequest ? (
                <div className="mt-6 space-y-5 text-sm text-slate-700">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase text-slate-500">Requester</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">
                        {selectedRequest.requester_name || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-500">Needed By</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">
                        {new Date(selectedRequest.needed_by).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-500">Category</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">
                        {selectedRequest.category}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-500">Department</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">
                        {selectedRequest.department_name ?? "Not provided"}
                      </p>
                    </div>
                    {selectedRequest.rfq_number ? (
                      <div>
                        <p className="text-xs uppercase text-slate-500">RFQ Number</p>
                        <p className="mt-1 text-sm font-mono text-slate-800">{selectedRequest.rfq_number}</p>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <p className="text-xs uppercase text-slate-500">Purpose</p>
                    <p className="mt-2 whitespace-pre-line">{selectedRequest.description}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-slate-500">Budget Summary</p>
                    <div className="mt-2 text-sm text-slate-700">
                      {renderBudgetSummary(selectedRequest)}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-slate-500">Latest Note</p>
                    <p className="mt-2 text-sm text-slate-700">
                      {resolveRequestNotes(selectedRequest)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-slate-500">Supporting Documents</p>
                    {selectedRequest.documents.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">
                        No supporting documents were attached.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {selectedRequest.documents.slice(0, 4).map((document) => (
                          <a
                            key={document.id}
                            href={getDownloadUrl(document.file_path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-xs text-slate-700 transition hover:border-secondary hover:text-secondary"
                          >
                            <span className="truncate pr-3">{document.original_filename}</span>
                            <span className="text-[10px] uppercase text-slate-500">
                              {new Date(document.uploaded_at).toLocaleDateString()}
                            </span>
                          </a>
                        ))}
                        {selectedRequest.documents.length > 4 ? (
                          <button
                            type="button"
                            onClick={() => handleViewRequest(selectedRequest)}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            View all documents
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {selectedRequest.rfq_id ? (
                    <div className="rounded-lg border border-secondary/20 bg-secondary/5 px-4 py-3 text-xs text-secondary">
                      RFQ #{selectedRequest.rfq_id} has been created for this request.
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-6 text-sm text-slate-600">
                  Choose a purchase request from the list to see its details.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-primary">Next Actions</h2>
              {selectedRequest ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  {selectedRequestIsPending ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApproveRequest(selectedRequest)}
                        disabled={submitting}
                        className="rounded border border-secondary px-4 py-2 text-xs font-semibold uppercase text-secondary hover:bg-secondary/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Review &amp; Forward
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDenyRequest(selectedRequest.id)}
                        disabled={submitting}
                        className="rounded border border-rose-500 px-4 py-2 text-xs font-semibold uppercase text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                  {selectedRequestCanInvite ? (
                    <button
                      type="button"
                      onClick={() => openInviteModal(selectedRequest)}
                      disabled={submitting || !canSendToSuppliers}
                      className={`rounded border px-4 py-2 text-xs font-semibold uppercase disabled:cursor-not-allowed disabled:opacity-50 ${
                        canSendToSuppliers 
                          ? 'border-emerald-500 text-emerald-600 hover:bg-emerald-50' 
                          : 'border-slate-300 text-slate-400 bg-slate-50'
                      }`}
                      title={!canSendToSuppliers ? "Only Procurement users can send to suppliers" : ""}
                    >
                      Send to Suppliers
                    </button>
                  ) : null}
                  {selectedRequest?.rfq_invited_at && 
                   (selectedRequest?.status === "finance_approved" || selectedRequest?.status === "rfq_issued") && (
                    <div className="mt-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
                      <p className="text-xs text-blue-700">
                        ✓ Invitations already sent to suppliers on{" "}
                        {new Date(selectedRequest.rfq_invited_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  Select a request to enable the available actions.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <Modal
        open={isApproveModalOpen}
        onClose={closeApproveModal}
        title={selectedRequest ? `${isApproveReadOnly ? "Request Details" : "Approve Request"}: ${selectedRequest.title}` : "Approve Request"}
      >
        {selectedRequest ? (
          <form onSubmit={submitApproval} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Title</label>
                <input
                  type="text"
                  value={approvalForm.title}
                  onChange={(event) =>
                    setApprovalForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  disabled={isApproveReadOnly || submitting}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-secondary focus:outline-none"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea
                  rows={3}
                  value={approvalForm.description}
                  onChange={(event) =>
                    setApprovalForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  disabled={isApproveReadOnly || submitting}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-secondary focus:outline-none"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Justification</label>
                <textarea
                  rows={3}
                  value={approvalForm.justification}
                  onChange={(event) =>
                    setApprovalForm((prev) => ({ ...prev, justification: event.target.value }))
                  }
                  disabled={isApproveReadOnly || submitting}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-secondary focus:outline-none"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">
                    Requester Attachments
                  </label>
                  <span className="text-xs uppercase text-slate-500">Procurement only</span>
                </div>
                {selectedRequest.documents.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-600">
                    No supporting documents were attached to this request.
                  </p>
                ) : (
                  <div className="mt-3 space-y-4">
                    {imageDocuments.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Photos
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {imageDocuments.map((document) => (
                            <a
                              key={document.id}
                              href={getDownloadUrl(document.file_path)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group overflow-hidden rounded-lg border border-slate-200 shadow-sm transition hover:border-secondary hover:shadow-md"
                            >
                              <div className="aspect-video w-full bg-slate-100">
                                <img
                                  src={getDownloadUrl(document.file_path)}
                                  alt={document.original_filename}
                                  className="h-full w-full object-cover transition group-hover:scale-105"
                                />
                              </div>
                              <p className="truncate px-3 py-2 text-xs text-slate-700 group-hover:text-secondary">
                                {document.original_filename}
                              </p>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {otherDocuments.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Other files
                        </p>
                        <ul className="mt-2 space-y-2">
                          {otherDocuments.map((document) => (
                            <li
                              key={document.id}
                              className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-xs text-slate-800"
                            >
                              <span className="truncate pr-3 font-medium text-slate-800">
                                {document.original_filename}
                              </span>
                              <a
                                href={getDownloadUrl(document.file_path)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded border border-primary px-3 py-1 font-semibold uppercase text-primary hover:bg-primary/10"
                              >
                                Open
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Category</label>
                <input
                  list="request-category-options"
                  value={approvalForm.category}
                  onChange={(event) =>
                    setApprovalForm((prev) => ({ ...prev, category: event.target.value }))
                  }
                  disabled={isApproveReadOnly || submitting}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-secondary focus:outline-none"
                  required
                />
                <datalist id="request-category-options">
                  {categories.map((category) => (
                    <option key={category.id} value={category.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Needed By</label>
                <input
                  type="datetime-local"
                  value={approvalForm.needed_by}
                  onChange={(event) =>
                    setApprovalForm((prev) => ({ ...prev, needed_by: event.target.value }))
                  }
                  disabled={isApproveReadOnly || submitting}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-secondary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Budget Amount</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={approvalForm.budget_amount}
                  onChange={(event) =>
                    setApprovalForm((prev) => ({ ...prev, budget_amount: event.target.value }))
                  }
                  disabled={isApproveReadOnly || submitting}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-secondary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Budget Currency</label>
                <select
                  value={approvalForm.budget_currency}
                  onChange={(event) =>
                    setApprovalForm((prev) => ({ ...prev, budget_currency: event.target.value }))
                  }
                  disabled={isApproveReadOnly || submitting}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-secondary focus:outline-none"
                >
                  {currencyOptionsWithCurrent.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Procurement Notes</label>
                <textarea
                  rows={3}
                  value={approvalForm.procurement_notes}
                  onChange={(event) =>
                    setApprovalForm((prev) => ({ ...prev, procurement_notes: event.target.value }))
                  }
                  disabled={isApproveReadOnly || submitting}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-secondary focus:outline-none"
                  placeholder="Add notes about this request (e.g., quotes reviewed, target suppliers, special requirements)."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={closeApproveModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
                disabled={submitting}
              >
                {isApproveReadOnly ? "Close" : "Cancel"}
              </button>
              {!isApproveReadOnly ? (
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Approve Request"}
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="py-8 text-center text-sm text-slate-600">
            Select a request to approve.
          </div>
        )}
      </Modal>
      <Modal
        open={isInviteModalOpen}
        onClose={closeInviteModal}
        title={inviteRequest ? `Send to Suppliers: ${inviteRequest.title}` : "Send to Suppliers"}
      >
        {inviteRequest ? (
          <form onSubmit={submitSupplierInvites} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">RFQ Deadline</label>
                <input
                  type="datetime-local"
                  value={inviteForm.rfq_deadline}
                  onChange={(event) =>
                    setInviteForm((prev) => ({ ...prev, rfq_deadline: event.target.value }))
                  }
                  min={getCurrentLocal(60000)}
                  required
                  disabled={submitting}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-secondary focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-600">
                  Suppliers must submit quotations before this deadline (must be in the future).
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Procurement Notes (optional)</label>
                <textarea
                  rows={3}
                  value={inviteForm.notes}
                  onChange={(event) =>
                    setInviteForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  disabled={submitting}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-secondary focus:outline-none"
                  placeholder="Store context about this RFQ invitation for the team."
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Recommended Suppliers</h3>
                <p className="text-xs text-slate-600">
                  Based on the {inviteRequest.category} category.
                </p>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {inviteBuckets.recommended.length ? (
                    inviteBuckets.recommended.map((supplier) => (
                      <label
                        key={supplier.id}
                        className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:border-secondary"
                      >
                        <input
                          type="checkbox"
                          checked={inviteForm.supplier_ids.includes(supplier.id)}
                          onChange={() => toggleSupplierSelection(supplier.id)}
                          disabled={submitting}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <div>
                          <p className="font-semibold text-slate-800">{supplier.company_name}</p>
                          <p className="text-xs font-mono text-slate-600">{supplier.supplier_number}</p>
                          <p className="text-xs text-slate-600">{supplier.user_email}</p>
                          {supplier.preferred_currency ? (
                            <p className="text-xs text-slate-600">Currency: {supplier.preferred_currency}</p>
                          ) : null}
                        </div>
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-slate-600">
                      {suppliers.length
                        ? "No suppliers are tagged for this category yet."
                        : "No suppliers available. Add suppliers to invite them."}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Other Suppliers</h3>
                <p className="text-xs text-slate-600">
                  Select additional suppliers who should receive the RFQ.
                </p>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {inviteBuckets.others.length ? (
                    inviteBuckets.others.map((supplier) => (
                      <label
                        key={supplier.id}
                        className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:border-secondary"
                      >
                        <input
                          type="checkbox"
                          checked={inviteForm.supplier_ids.includes(supplier.id)}
                          onChange={() => toggleSupplierSelection(supplier.id)}
                          disabled={submitting}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <div>
                          <p className="font-semibold text-slate-800">{supplier.company_name}</p>
                          <p className="text-xs font-mono text-slate-600">{supplier.supplier_number}</p>
                          <p className="text-xs text-slate-600">{supplier.user_email}</p>
                          {supplier.categories && supplier.categories.length ? (
                            <p className="text-xs text-slate-600">
                              Categories:{" "}
                              {supplier.categories.map((category) => category.name).join(", ")}
                            </p>
                          ) : null}
                        </div>
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-slate-600">
                      {suppliers.length
                        ? "All suppliers matching this category are already listed above."
                        : "No suppliers available. Add suppliers first."}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={closeInviteModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || inviteForm.supplier_ids.length === 0}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Inviting Suppliers..." : "Send Invitations"}
              </button>
            </div>
          </form>
        ) : (
          <div className="py-8 text-center text-sm text-slate-600">
            Select a finance-approved request to choose suppliers.
          </div>
        )}
      </Modal>
      <Modal open={isCreateOpen} onClose={closeCreateRfqModal} title="Create RFQ">
        <form onSubmit={handleCreateRfq} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea
              required
              rows={3}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Category</label>
              {categories.length > 0 ? (
                <select
                  required
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
                >
                  <option value="">Select category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
                  placeholder="e.g., IT Equipment"
                />
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Budget</label>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={form.budget}
                onChange={(event) => setForm((prev) => ({ ...prev, budget: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Currency</label>
              <select
                value={form.currency}
                onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
              >
                {currencyOptions.map((currencyOption) => (
                  <option key={currencyOption} value={currencyOption}>
                    {currencyOption}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Deadline</label>
            <input
              type="datetime-local"
              required
              min={getCurrentLocal(60000)}
              value={form.deadline}
              onChange={(event) => setForm((prev) => ({ ...prev, deadline: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">Deadline must be in the future</p>
          </div>
          
          {/* Supplier selection - only for Procurement and SuperAdmin */}
          {/* Procurement Officers create drafts without selecting suppliers */}
          {!isProcurementOfficer && (
            <div>
              <label className="text-sm font-medium text-slate-700">Invite Suppliers</label>
              <p className="mt-1 text-xs text-slate-600">
                Recommended suppliers are pre-selected based on the RFQ category. Adjust the list before publishing.
              </p>
              <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Recommended</p>
                {createRfqBuckets.recommended.length ? (
                  <div className="mt-2 space-y-2">
                    {createRfqBuckets.recommended.map((supplier) => {
                      const checked = rfqSelectedSupplierIds.includes(supplier.id);
                      return (
                        <label
                          key={supplier.id}
                          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                            checked ? "border-secondary bg-secondary/10 text-secondary" : "border-slate-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={submitting}
                            onChange={() => toggleCreateSupplierSelection(supplier.id)}
                            className="mt-1 h-4 w-4"
                          />
                          <div className="text-slate-800">
                            <span className="font-medium">{supplier.company_name}</span>
                            <span className="block text-xs font-mono text-slate-600">{supplier.supplier_number}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">No recommended suppliers for this category.</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Other Suppliers</p>
                {createRfqBuckets.others.length ? (
                  <div className="mt-2 space-y-2">
                    {createRfqBuckets.others.map((supplier) => {
                      const checked = rfqSelectedSupplierIds.includes(supplier.id);
                      return (
                        <label
                          key={supplier.id}
                          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                            checked ? "border-secondary bg-secondary/10 text-secondary" : "border-slate-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={submitting}
                            onChange={() => toggleCreateSupplierSelection(supplier.id)}
                            className="mt-1 h-4 w-4"
                          />
                          <div className="text-slate-800">
                            <span className="font-medium">{supplier.company_name}</span>
                            <span className="block text-xs font-mono text-slate-600">{supplier.supplier_number}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">No additional suppliers available.</p>
                )}
              </div>
            </div>
          </div>
          )}
          
          {/* Procurement Officers see a note about draft creation */}
          {isProcurementOfficer && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm text-amber-900">
                <strong>Note:</strong> You are creating a draft RFQ. The main Procurement team will review your draft, select suppliers, and approve it before invitations are sent.
              </p>
            </div>
          )}
          
          <div>
            <label className="text-sm font-medium text-slate-700">Supporting Documents</label>
            <input
              type="file"
              multiple
              onChange={handleRfqAttachmentChange}
              className="mt-2 block w-full cursor-pointer rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-secondary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-secondary hover:border-secondary/60"
            />
            {rfqAttachments.length ? (
              <ul className="mt-3 space-y-2 text-xs text-slate-700">
                {rfqAttachments.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2"
                  >
                    <span className="truncate pr-3">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRfqAttachment(index)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-600">
                Attach specifications, scopes of work, or any supporting documents for this RFQ.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={closeCreateRfqModal}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary/80 disabled:opacity-70"
            >
              {submitting ? "Creating..." : "Create RFQ"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Supplier Modal */}
      <Modal
        open={isCreateSupplierOpen}
        onClose={() => setIsCreateSupplierOpen(false)}
        title="Add New Supplier"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Company Name *</label>
            <input
              type="text"
              required
              value={supplierForm.company_name}
              onChange={(event) =>
                setSupplierForm((prev) => ({ ...prev, company_name: event.target.value }))
              }
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
              placeholder="ABC Corporation"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Contact Email *</label>
              <input
                type="email"
                required
                value={supplierForm.contact_email}
                onChange={(event) =>
                  setSupplierForm((prev) => ({ ...prev, contact_email: event.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
                placeholder="contact@abc.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Contact Phone</label>
              <input
                type="tel"
                value={supplierForm.contact_phone}
                onChange={(event) =>
                  setSupplierForm((prev) => ({ ...prev, contact_phone: event.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
                placeholder="+260 xxx xxx xxx"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Full Name *</label>
              <input
                type="text"
                required
                value={supplierForm.full_name}
                onChange={(event) =>
                  setSupplierForm((prev) => ({ ...prev, full_name: event.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Password *</label>
              <input
                type="password"
                required
                minLength={6}
                value={supplierForm.password}
                onChange={(event) =>
                  setSupplierForm((prev) => ({ ...prev, password: event.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
                placeholder="Min. 6 characters"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Address</label>
            <textarea
              rows={2}
              value={supplierForm.address}
              onChange={(event) =>
                setSupplierForm((prev) => ({ ...prev, address: event.target.value }))
              }
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
              placeholder="123 Main St, Lusaka"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Preferred Currency</label>
            <select
              value={supplierForm.preferred_currency}
              onChange={(event) =>
                setSupplierForm((prev) => ({ ...prev, preferred_currency: event.target.value }))
              }
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
            >
              <option value="USD">USD ($)</option>
              <option value="ZMW">ZMW (K)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Timezone</label>
            <select
              value={supplierForm.timezone}
              onChange={(event) =>
                setSupplierForm((prev) => ({ ...prev, timezone: event.target.value }))
              }
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Default: Africa/Cairo. All dates and times will display in this timezone.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Categories</label>
            <p className="mt-1 text-xs text-slate-600">
              Select up to two categories (primary and secondary focus).
            </p>
            {categories.length ? (
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {categories.map((category) => {
                  const checked = supplierForm.category_ids.includes(category.id);
                  return (
                    <label
                      key={category.id}
                      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                        checked ? "border-secondary bg-secondary/10 text-secondary" : "border-slate-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSupplierCategorySelection(category.id)}
                        disabled={!checked && supplierForm.category_ids.length >= 2}
                        className="mt-1 h-4 w-4"
                      />
                      <span className="text-slate-800">{category.name}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-600">
                No categories available yet. Create categories in the Categories tab first.
              </p>
            )}
          </div>

          <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-600">
            <strong>Note:</strong> Login credentials will be sent to the supplier's email address.
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Tax Clearance Certificate</label>
            <input type="file" name="tax_clearance" accept="application/pdf,image/*" className="mt-2 w-full" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Certificate of Incorporation</label>
            <input type="file" name="certificate_of_incorporation" accept="application/pdf,image/*" className="mt-2 w-full" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Other Documents</label>
            <input type="file" name="other_documents" multiple accept="application/pdf,image/*" className="mt-2 w-full" />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-70"
          >
            {submitting ? "Creating Supplier..." : "Create Supplier"}
          </button>
        </form>
      </Modal>

      {/* Create Category Modal */}
      <Modal
        open={isCreateCategoryOpen}
        onClose={() => setIsCreateCategoryOpen(false)}
        title="Create Category"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Name *</label>
            <input
              type="text"
              required
              value={categoryForm.name}
              onChange={(event) =>
                setCategoryForm((prev) => ({ ...prev, name: event.target.value }))
              }
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
              placeholder="e.g., Office Supplies"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea
              rows={3}
              value={categoryForm.description}
              onChange={(event) =>
                setCategoryForm((prev) => ({ ...prev, description: event.target.value }))
              }
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-secondary focus:outline-none"
              placeholder="Brief description of this category"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white hover:bg-purple-700 disabled:opacity-70"
          >
            {submitting ? "Creating Category..." : "Create Category"}
          </button>
        </form>
      </Modal>

      {/* RFQ Detail Modal */}
      <Modal
        open={isRfqDetailOpen}
        onClose={() => setIsRfqDetailOpen(false)}
        title={selectedRfq ? `RFQ: ${selectedRfq.title}` : "RFQ Details"}
      >
        {selectedRfq ? (
          <div className="space-y-6">
            {/* RFQ Information */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium uppercase text-slate-500">Description</label>
                <p className="mt-1 text-sm text-slate-800">{selectedRfq.description}</p>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium uppercase text-slate-500">Category</label>
                  <p className="mt-1 text-sm font-medium text-slate-800">{selectedRfq.category}</p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase text-slate-500">Budget</label>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {formatCurrency(Number(selectedRfq.budget ?? 0), selectedRfq.currency)}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase text-slate-500">Deadline</label>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {new Date(selectedRfq.deadline).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase text-slate-500">Status</label>
                  <p className="mt-1">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      selectedRfq.status === "open"
                        ? "bg-green-100 text-green-800"
                        : selectedRfq.status === "awarded"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-200 text-slate-700"
                    }`}>
                      {selectedRfq.status.toUpperCase()}
                    </span>
                  </p>
                </div>
              </div>

              {/* Temporarily disabled - RFQ documents feature needs to be re-implemented
              <div>
                <label className="text-xs font-medium uppercase text-slate-500">Supporting Documents</label>
                <p className="mt-2 text-xs text-slate-600">No attachments uploaded.</p>
              </div>
              */}

            </div>

            {/* Supplier Quotations */}
            {selectedRfq.quotations && selectedRfq.quotations.length > 0 && (
              <div>
                <h3 className="mb-3 text-base font-semibold text-slate-800">Supplier Quotations</h3>
                <div className="space-y-3">
                  {selectedRfq.quotations.map((quotation: Quotation) => (
                    <div
                      key={quotation.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-4"
                    >
                      <div>
                        <p className="font-medium text-slate-800">
                          {formatCurrency(quotation.amount)} {quotation.currency}
                        </p>
                        <p className="text-xs text-slate-600">
                          {quotation.supplier_name ?? `Supplier #${quotation.supplier_id}`}
                          {quotation.supplier_number && ` (${quotation.supplier_number})`} �?� Submitted{" "}
                          {new Date(quotation.submitted_at).toLocaleDateString()}
                        </p>
                        {quotation.notes && (
                          <p className="mt-1 text-xs text-slate-700">{quotation.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          quotation.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : quotation.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {quotation.status}
                        </span>
                        {canApprove && quotation.status === "pending" && !selectedRfqHasApprovedQuotation && (
                          <button
                            onClick={() => {
                              handleApproveQuotation(selectedRfq.id, quotation.id);
                              setIsRfqDetailOpen(false);
                            }}
                            className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedRfq.quotations && selectedRfq.quotations.length === 0 && (
              <div className="rounded-lg border border-slate-200 bg-sand/30 p-4 text-center text-sm text-slate-600">
                No quotations submitted yet.
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-600">Loading RFQ details...</div>
        )}
      </Modal>

      {/* Category Detail Modal */}
      <Modal
        open={isCategoryDetailOpen}
        onClose={() => setIsCategoryDetailOpen(false)}
        title={selectedCategory ? `Category: ${selectedCategory.name}` : "Category Details"}
      >
        {selectedCategory ? (
          <div className="space-y-6">
            {/* Category Information */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium uppercase text-slate-500">Description</label>
                <p className="mt-1 text-sm text-slate-800">
                  {selectedCategory.description || "No description provided"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium uppercase text-slate-500">Created</label>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {selectedCategory.created_at 
                      ? new Date(selectedCategory.created_at).toLocaleDateString() 
                      : "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase text-slate-500">Last Updated</label>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {selectedCategory.updated_at 
                      ? new Date(selectedCategory.updated_at).toLocaleDateString() 
                      : "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-4 gap-4 rounded-lg bg-sand/30 p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{selectedCategory.total_rfqs}</div>
                <div className="text-xs text-slate-700">Total RFQs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{selectedCategory.open_rfqs}</div>
                <div className="text-xs text-slate-700">Open</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{selectedCategory.awarded_rfqs}</div>
                <div className="text-xs text-slate-700">Awarded</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-800">
                  {formatCurrency(selectedCategory.total_budget, "USD")}
                </div>
                <div className="text-xs text-slate-700">Total Budget</div>
              </div>
            </div>

            {/* RFQs List */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">RFQs in this Category</h3>
              {selectedCategory.rfqs.length > 0 ? (
                <div className="space-y-2">
                  {selectedCategory.rfqs.map((rfq) => (
                    <div
                      key={rfq.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-sand/30"
                    >
                      <div className="flex-1">
                        <div className="text-xs font-mono text-slate-600">{rfq.rfq_number}</div>
<div className="text-sm font-medium text-slate-900">{rfq.title}</div>
                        <div className="mt-1 flex items-center gap-4 text-xs text-slate-600">
                          <span>Budget: {formatCurrency(rfq.budget, rfq.currency)}</span>
                          <span>Deadline: {new Date(rfq.deadline).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          rfq.status === "open"
                            ? "bg-green-100 text-green-800"
                            : rfq.status === "awarded"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {rfq.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-sand/30 p-4 text-center text-sm text-slate-600">
                  No RFQs in this category yet.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-600">Loading category details...</div>
        )}
      </Modal>

      {/* Message Center Modal */}
      <Modal
        open={isMessageCenterOpen}
        onClose={closeMessageCenter}
        title="Messages"
      >
        {isLoadingMessages ? (
          <div className="flex justify-center py-10">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Toggle between Sent and Received */}
            <div className="flex gap-2 border-b border-slate-200">
              <button
                onClick={() => setMessageViewMode("sent")}
                className={`px-4 py-2 text-sm font-medium transition ${
                  messageViewMode === "sent"
                    ? "border-b-2 border-primary text-primary"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                Sent ({sentMessages.length})
              </button>
              <button
                onClick={() => setMessageViewMode("received")}
                className={`px-4 py-2 text-sm font-medium transition ${
                  messageViewMode === "received"
                    ? "border-b-2 border-primary text-primary"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                Received ({receivedMessages.length})
              </button>
            </div>

            {/* Messages List */}
            {messageViewMode === "sent" ? (
              sentMessages.length ? (
                <div className="max-h-[70vh] space-y-4 overflow-y-auto">
                  {sentMessages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <span className="text-sm font-semibold text-slate-800">
                          {message.subject || "No subject"}
                        </span>
                        <span className="text-xs text-slate-600">
                          {new Date(message.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">
                        To: {message.recipient_name}{" \u00B7 "}Supplier: {message.supplier_name}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{message.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-slate-600">No messages sent yet.</div>
              )
            ) : receivedMessages.length ? (
              <div className="max-h-[70vh] space-y-4 overflow-y-auto">
                {receivedMessages.map((message) => (
                  <button
                    key={message.id}
                    onClick={() => handleViewMessage(message)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-left hover:border-primary/30 hover:bg-slate-50 transition"
                  >
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <span className="text-sm font-semibold text-slate-800">
                        {message.subject || "No subject"}
                      </span>
                      <div className="flex items-center gap-2">
                        {message.status === "sent" && (
                          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                            New
                          </span>
                        )}
                        <span className="text-xs text-slate-600">
                          {new Date(message.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      From: {message.sender_name}{" \u00B7 "}Supplier: {message.supplier_name}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{message.content}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-slate-600">No messages received yet.</div>
            )}
          </div>
        )}
      </Modal>

      {/* Message Detail Modal with Reply */}
      <Modal
        open={isMessageDetailOpen}
        onClose={() => {
          setIsMessageDetailOpen(false);
          setSelectedMessageInCenter(null);
          setReplyContent("");
        }}
        title="Message Details"
      >
        {selectedMessageInCenter && (
          <div className="space-y-6">
            {/* Message Header */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {selectedMessageInCenter.subject || "No subject"}
                  </h3>
                  <div className="mt-2 space-y-1 text-sm text-slate-600">
                    <p>
                      <span className="font-medium">From:</span> {selectedMessageInCenter.sender_name}
                    </p>
                    {selectedMessageInCenter.supplier_name && (
                      <p>
                        <span className="font-medium">Supplier:</span> {selectedMessageInCenter.supplier_name}
                      </p>
                    )}
                    <p>
                      <span className="font-medium">Date:</span>{" "}
                      {new Date(selectedMessageInCenter.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                {selectedMessageInCenter.status === "sent" && (
                  <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                    New
                  </span>
                )}
              </div>
            </div>

            {/* Message Content */}
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="whitespace-pre-wrap text-sm text-slate-800">
                {selectedMessageInCenter.content}
              </p>
            </div>

            {/* Reply Section */}
            <div className="border-t border-slate-200 pt-4">
              <h4 className="mb-3 text-sm font-semibold text-slate-900">Reply</h4>
              <form onSubmit={handleReplyToMessage} className="space-y-4">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Type your reply..."
                  rows={5}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
                  required
                />
                
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMessageDetailOpen(false);
                      setSelectedMessageInCenter(null);
                      setReplyContent("");
                    }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!replyContent.trim()}
                    className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send Reply
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Modal>

      {/* Send Message Modal */}
      <Modal
        open={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        title={selectedSupplier ? `Send Message to ${selectedSupplier.company_name}` : "Send Message"}
      >
        {selectedSupplier ? (
          <form onSubmit={handleSendMessage} className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-sand/30 px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-800">{selectedSupplier.company_name}</p>
              <p className="mt-1 font-mono text-xs text-slate-600">{selectedSupplier.supplier_number}</p>
              <p className="text-xs text-slate-600">{selectedSupplier.contact_email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800">Subject</label>
              <input
                type="text"
                required
                value={messageForm.subject}
                onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Enter message subject..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-800">Message</label>
              <textarea
                required
                rows={6}
                value={messageForm.content}
                onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Type your message..."
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsMessageModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-sand/30"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Sending..." : "Send Message"}
              </button>
            </div>
          </form>
        ) : (
          <div className="py-8 text-center text-sm text-slate-600">Supplier not selected.</div>
        )}
      </Modal>

      {/* Supplier Profile Modal */}
      <Modal
        open={isSupplierProfileOpen}
        onClose={closeSupplierProfile}
        title={selectedSupplier ? `${selectedSupplier.company_name} - Full Profile` : "Supplier Profile"}
      >
        {selectedSupplier ? (
          <div className="space-y-6">
            {/* Company Information */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Supplier Number</p>
                <p className="mt-1 text-sm font-mono text-slate-800">{selectedSupplier.supplier_number}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Company Name</p>
                <p className="mt-1 text-sm text-slate-800">{selectedSupplier.company_name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Email</p>
                <p className="mt-1 text-sm text-slate-800">{selectedSupplier.contact_email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Phone</p>
                <p className="mt-1 text-sm text-slate-800">{selectedSupplier.contact_phone || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Preferred Currency</p>
                <p className="mt-1 text-sm text-slate-800">{selectedSupplier.preferred_currency}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Address</p>
                <p className="mt-1 text-sm text-slate-800">{selectedSupplier.address || "N/A"}</p>
              </div>
            </div>

            {/* Categories */}
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Categories</p>
              {selectedSupplier.categories && selectedSupplier.categories.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedSupplier.categories.map((category) => (
                    <span
                      key={`${category.id}-${category.category_type}`}
                      className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                    >
                                            {category.category_type === "primary" ? "Primary" : "Secondary"}{" \u00B7 "} {category.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-600">No categories assigned</p>
              )}
            </div>

            {/* Statistics */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Invitations Sent</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{selectedSupplier.invitations_sent}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Total Awarded Value</p>
                <p className="mt-1 text-sm font-medium text-emerald-600">
                  {formatCurrency(selectedSupplier.total_awarded_value, selectedSupplier.preferred_currency || "ZMW")}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Account Status</p>
                <p className="mt-1">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                    selectedSupplier.user_active
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}>
                    {selectedSupplier.user_active ? "Active" : "Inactive"}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Registered Date</p>
                <p className="mt-1 text-sm text-slate-800">
                  {new Date(selectedSupplier.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Documents */}
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 mb-3">Uploaded Documents</p>
              {selectedSupplier.documents && selectedSupplier.documents.length > 0 ? (
                <div className="space-y-2">
                  {selectedSupplier.documents.map((document) => (
                    <div
                      key={document.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-sand/30 px-4 py-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">
                          {document.document_type.replace(/_/g, " ").toUpperCase()}
                        </p>
                        <p className="text-xs text-slate-600">{document.original_filename}</p>
                        <p className="text-xs text-slate-500">
                          Uploaded: {new Date(document.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                      <a
                        href={getDownloadUrl(document.file_path)}
                        download
                        className="ml-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">No documents uploaded</p>
              )}
            </div>

            <div className="flex justify-end space-x-3 border-t pt-4">
              <button
                type="button"
                onClick={closeSupplierProfile}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-sand/30"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  closeSupplierProfile();
                  openMessageModal(selectedSupplier);
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Send Message
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-600">Supplier not selected.</div>
        )}
      </Modal>

      {/* Quotation Details Modal */}
      <Modal
        open={isQuotationDetailOpen}
        onClose={closeQuotationDetails}
        title="Quotation Details"
      >
        {selectedQuotation ? (
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="rounded-lg bg-sand/30 p-4">
              <h3 className="text-lg font-semibold text-sand mb-4">Quotation Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-800">Supplier</label>
                  <p className="text-base font-semibold text-slate-900">
                    {selectedQuotation.supplier_name ?? `Supplier #${selectedQuotation.supplier_id}`}
                  </p>
                  {selectedQuotation.supplier_number && (
                    <p className="text-sm text-slate-700">{selectedQuotation.supplier_number}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">Amount</label>
                  <p className="text-lg font-bold text-slate-900">
                    {formatCurrency(Number(selectedQuotation.amount), selectedQuotation.currency)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">Status</label>
                  <span className="inline-block rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold uppercase text-slate-700">
                    {selectedQuotation.status}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">Submitted</label>
                  <p className="text-sm text-slate-700">
                    {new Date(selectedQuotation.submitted_at).toLocaleDateString()}
                  </p>
                </div>
                {selectedQuotation.approved_at && (
                  <div>
                    <label className="block text-sm font-medium text-slate-800">Approved</label>
                    <p className="text-sm text-slate-700">
                      {new Date(selectedQuotation.approved_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {selectedQuotation.notes && (
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-2">Notes</label>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">
                    {selectedQuotation.notes}
                  </p>
                </div>
              </div>
            )}

            {/* Budget Override Justification */}
            {selectedQuotation.budget_override_justification && (
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-2">Budget Override Justification</label>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">
                    {selectedQuotation.budget_override_justification}
                  </p>
                </div>
              </div>
            )}

            {/* Attached File */}
            {selectedQuotation.original_filename && selectedQuotation.document_path && (
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-2">Attached Document</label>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {selectedQuotation.original_filename}
                        </p>
                        <p className="text-xs text-slate-600">
                          Click to download
                        </p>
                      </div>
                    </div>
                    <a
                      href={getDownloadUrl(selectedQuotation.document_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
                    >
                      Download
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
              {selectedQuotation.status !== "approved" && canApprove && selectedRfq && !selectedRfqHasApprovedQuotation ? (
                <button
                  onClick={() => {
                    handleApproveQuotation(selectedRfq.id, selectedQuotation.id);
                    closeQuotationDetails();
                  }}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
                >
                  Approve Quotation
                </button>
              ) : null}
              <button
                onClick={closeQuotationDetails}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-sand/30"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-600">No quotation selected.</div>
        )}
      </Modal>

      {/* Delivery Notes Tab */}
      {activeTab === "deliveryNotes" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-primary">Delivery Notes</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                All delivered contracts with uploaded delivery notes
              </p>
            </div>
          </div>

          {isLoadingDeliveredContracts ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-600">Loading delivered contracts...</div>
            </div>
          ) : deliveredContractsToDisplay.length > 0 ? (
            <div className="grid gap-3 sm:gap-4">
              {deliveredContractsToDisplay.map((contract) => (
                <div
                  key={contract.id}
                  className="rounded-lg border border-slate-200 bg-white p-3 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                    <div className="flex-1 w-full">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="rounded-full px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold bg-blue-100 text-blue-700 uppercase">
                          ✓ Delivered
                        </span>
                        <span className="text-[10px] sm:text-xs text-slate-500">
                          {contract.delivered_at && new Date(contract.delivered_at).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <h3 className="text-sm sm:text-lg font-semibold text-primary truncate">
                        {(contract as any).rfq_title || "Contract"}
                      </h3>
                      
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                        <div>
                          <span className="text-slate-600">RFQ Number:</span>
                          <span className="ml-2 font-medium text-slate-900 truncate">
                            {(contract as any).rfq_number || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600">Category:</span>
                          <span className="ml-2 font-medium text-slate-900 truncate">
                            {(contract as any).rfq_category || "-"}
                          </span>
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                          <span className="text-slate-600">Supplier:</span>
                          <span className="ml-2 font-medium text-slate-900 truncate">
                            {contract.supplier_name || `Supplier #${contract.supplier_id}`}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600">Supplier Number:</span>
                          <span className="ml-2 font-medium text-slate-900 truncate">
                            {contract.supplier_number || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600">Contract Amount:</span>
                          <span className="ml-2 font-bold text-secondary">
                            {formatCurrency(Number(contract.amount), contract.currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600">Approved On:</span>
                          <span className="ml-2 font-medium text-slate-900">
                            {contract.approved_at ? new Date(contract.approved_at).toLocaleDateString() : "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600">Delivered On:</span>
                          <span className="ml-2 font-medium text-green-700">
                            {contract.delivered_at ? new Date(contract.delivered_at).toLocaleDateString() : "-"}
                          </span>
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                          <span className="text-slate-600">Delivery Note:</span>
                          <span className="ml-2 font-medium text-slate-900 truncate">
                            {contract.delivery_note_filename || "No file"}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row">
                      {contract.delivery_note_path && (
                        <button
                          onClick={() => handleDownloadDeliveryNote(contract.rfq_id, contract.id, contract.delivery_note_filename)}
                          className="flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg bg-blue-500 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-600"
                        >
                          <Package className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span>Download Note</span>
                        </button>
                      )}
                      {contract.document_path && (
                        <button
                          onClick={() => handleDownloadQuotation(contract.rfq_id, contract.id, contract.original_filename)}
                          className="flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg border border-slate-300 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span>Quotation</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-12 text-center">
              <Package className="mx-auto h-12 w-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {searchScope === "deliveryNotes" && normalizedSearch.length > 0
                  ? "No delivery notes match your search."
                  : "No Delivered Contracts Yet"}
              </h3>
              <p className="text-sm text-slate-600">
                {searchScope === "deliveryNotes" && normalizedSearch.length > 0
                  ? "Try adjusting your search terms."
                  : "Delivered contracts with delivery notes will appear here."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Budget Override Justification Modal */}
      <Modal open={isBudgetOverrideModalOpen} onClose={() => {
        setIsBudgetOverrideModalOpen(false);
        setPendingApproval(null);
        setBudgetOverrideJustification("");
      }} title={user?.role?.toLowerCase() === "procurement" ? "Request Finance Approval" : "Budget Override Required"}>
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm text-amber-800">
              {user?.role?.toLowerCase() === "procurement" 
                ? "⚠️ The selected quotation exceeds the finance-approved budget. Submit a request to Finance for approval."
                : "⚠️ The selected quotation exceeds the finance-approved budget. Please provide a justification for approving this quotation."
              }
            </p>
          </div>
          
          {pendingApproval && selectedRfq && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Finance Approved Budget:</span>
                <span className="font-medium">{formatCurrency(Number(selectedRfq.budget) || 0, selectedRfq.currency)}</span>
              </div>
              {(() => {
                const quotation = selectedRfq.quotations?.find((q) => q.id === pendingApproval.quotationId);
                if (quotation) {
                  const baseAmount = Number(quotation.amount) || 0;
                  const taxAmount = Number(quotation.tax_amount) || 0;
                  const quotationTotal = baseAmount + taxAmount;
                  const approvedBudget = Number(selectedRfq.budget) || 0;
                  const difference = quotationTotal - approvedBudget;
                  
                  return (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Base Amount:</span>
                        <span className="font-medium">{formatCurrency(baseAmount, quotation.currency)}</span>
                      </div>
                      {taxAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">Tax ({quotation.tax_type}):</span>
                          <span className="font-medium">{formatCurrency(taxAmount, quotation.currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold pt-1 border-t border-slate-200">
                        <span className="text-slate-700">Total Quotation Amount:</span>
                        <span>{formatCurrency(quotationTotal, quotation.currency)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-200">
                        <span className="text-slate-600">Exceeds Budget by:</span>
                        <span className="font-semibold text-rose-600">{formatCurrency(difference, quotation.currency)}</span>
                      </div>
                    </>
                  );
                }
                return null;
              })()}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Justification for Budget Override <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={budgetOverrideJustification}
              onChange={(e) => setBudgetOverrideJustification(e.target.value)}
              placeholder="Explain why this quotation should be approved despite exceeding the budget..."
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => {
                setIsBudgetOverrideModalOpen(false);
                setPendingApproval(null);
                setBudgetOverrideJustification("");
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-sand/30"
            >
              Cancel
            </button>
            {user?.role?.toLowerCase() === "procurement" ? (
              <button
                onClick={handleRequestFinanceApproval}
                disabled={!budgetOverrideJustification.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Request Finance Approval
              </button>
            ) : (
              <button
                onClick={() => {
                  if (pendingApproval && budgetOverrideJustification.trim()) {
                    handleApproveQuotation(
                      pendingApproval.rfqId,
                      pendingApproval.quotationId,
                      budgetOverrideJustification
                    );
                  }
                }}
                disabled={!budgetOverrideJustification.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve with Override
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Mark as Delivered Modal */}
      <Modal open={isDeliveryModalOpen} onClose={() => {
        setIsDeliveryModalOpen(false);
        setDeliveryQuotation(null);
        setDeliveryDate("");
        setDeliveryNote(null);
      }} title="Mark Contract as Delivered">
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm text-blue-800">
              📦 Mark this approved contract as delivered by providing the delivery date and uploading the stamped delivery note from the supplier.
            </p>
          </div>
          
          {deliveryQuotation && selectedRfq && (
            <div className="space-y-2 text-sm bg-slate-50 rounded-lg p-3">
              {(() => {
                const quotation = selectedRfq.quotations?.find((q) => q.id === deliveryQuotation.quotationId);
                if (quotation) {
                  return (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Supplier:</span>
                        <span className="font-medium">{quotation.supplier_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Contract Amount:</span>
                        <span className="font-medium">{formatCurrency(Number(quotation.amount), quotation.currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Approved On:</span>
                        <span className="font-medium">
                          {quotation.approved_at ? new Date(quotation.approved_at).toLocaleDateString() : "N/A"}
                        </span>
                      </div>
                    </>
                  );
                }
                return null;
              })()}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Delivery Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              min={deliveryQuotation && selectedRfq?.quotations?.find((q) => q.id === deliveryQuotation.quotationId)?.approved_at
                ? new Date(selectedRfq.quotations.find((q) => q.id === deliveryQuotation.quotationId)!.approved_at!).toISOString().slice(0, 16)
                : undefined
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Delivery date must be after the approval date
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Delivery Note (Stamped) <span className="text-rose-500">*</span>
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setDeliveryNote(e.target.files?.[0] || null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Upload the stamped delivery note from the supplier (PDF, JPG, or PNG)
            </p>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => {
                setIsDeliveryModalOpen(false);
                setDeliveryQuotation(null);
                setDeliveryDate("");
                setDeliveryNote(null);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-sand/30"
            >
              Cancel
            </button>
            <button
              onClick={handleMarkDelivered}
              disabled={!deliveryDate || !deliveryNote || submitting}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Marking as Delivered..." : "Mark as Delivered"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Approve Draft RFQ Modal - Supplier Selection */}
      <Modal 
        open={isApproveRfqModalOpen} 
        onClose={closeApproveRfqModal} 
        title="Approve Draft RFQ & Select Suppliers"
      >
        {rfqToApprove && (
          <div className="space-y-4">
            {/* RFQ Info */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{rfqToApprove.title}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-600">Category:</span>
                  <span className="ml-2 font-medium">{rfqToApprove.category}</span>
                </div>
                <div>
                  <span className="text-slate-600">Created by:</span>
                  <span className="ml-2 font-medium">{rfqToApprove.created_by_name}</span>
                </div>
              </div>
            </div>

            {/* Supplier Selection */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">
                Select Suppliers to Invite ({selectedSupplierIdsForApproval.length} selected)
              </h4>
              
              {suppliers.length > 0 ? (
                <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
                  {/* Suppliers in matching category */}
                  {suppliers
                    .filter(supplier => 
                      supplier.categories?.some(cat => cat.name === rfqToApprove.category)
                    ).length > 0 && (
                    <>
                      <div className="sticky top-0 bg-primary/5 px-3 py-2 border-b border-slate-200">
                        <p className="text-xs font-semibold text-primary uppercase">
                          Matching Category: {rfqToApprove.category}
                        </p>
                      </div>
                      {suppliers
                        .filter(supplier => 
                          supplier.categories?.some(cat => cat.name === rfqToApprove.category)
                        )
                        .map((supplier) => (
                          <div
                            key={supplier.id}
                            className="flex items-start gap-3 p-3 border-b border-slate-100 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={selectedSupplierIdsForApproval.includes(supplier.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSupplierIdsForApproval([...selectedSupplierIdsForApproval, supplier.id]);
                                } else {
                                  setSelectedSupplierIdsForApproval(
                                    selectedSupplierIdsForApproval.filter((id) => id !== supplier.id)
                                  );
                                }
                              }}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-slate-900">{supplier.company_name}</div>
                              <div className="text-xs text-slate-600">
                                {supplier.supplier_number && `#${supplier.supplier_number} • `}
                                {supplier.contact_email}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {supplier.categories?.map((cat) => (
                                  <span
                                    key={cat.id}
                                    className={clsx(
                                      "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                                      cat.name === rfqToApprove.category
                                        ? "bg-primary/10 text-primary"
                                        : "bg-slate-100 text-slate-600"
                                    )}
                                  >
                                    {cat.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                    </>
                  )}
                  
                  {/* Suppliers from other categories */}
                  {suppliers
                    .filter(supplier => 
                      !supplier.categories?.some(cat => cat.name === rfqToApprove.category)
                    ).length > 0 && (
                    <>
                      <div className="sticky top-0 bg-slate-50 px-3 py-2 border-b border-slate-200">
                        <p className="text-xs font-semibold text-slate-600 uppercase">
                          Other Categories
                        </p>
                      </div>
                      {suppliers
                        .filter(supplier => 
                          !supplier.categories?.some(cat => cat.name === rfqToApprove.category)
                        )
                        .map((supplier) => (
                          <div
                            key={supplier.id}
                            className="flex items-start gap-3 p-3 border-b border-slate-100 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={selectedSupplierIdsForApproval.includes(supplier.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSupplierIdsForApproval([...selectedSupplierIdsForApproval, supplier.id]);
                                } else {
                                  setSelectedSupplierIdsForApproval(
                                    selectedSupplierIdsForApproval.filter((id) => id !== supplier.id)
                                  );
                                }
                              }}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-slate-900">{supplier.company_name}</div>
                              <div className="text-xs text-slate-600">
                                {supplier.supplier_number && `#${supplier.supplier_number} • `}
                                {supplier.contact_email}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {supplier.categories?.map((cat) => (
                                  <span
                                    key={cat.id}
                                    className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600"
                                  >
                                    {cat.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                    </>
                  )}
                  
                  {suppliers.length === 0 && (
                    <div className="p-8 text-center text-sm text-slate-600">
                      No suppliers available.
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-slate-600">
                  Loading suppliers...
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  if (suppliers.filter(s => s.categories?.some(cat => cat.name === rfqToApprove.category)).length > 0) {
                    const matchingSuppliers = suppliers
                      .filter(s => s.categories?.some(cat => cat.name === rfqToApprove.category))
                      .map(s => s.id);
                    setSelectedSupplierIdsForApproval(matchingSuppliers);
                  }
                }}
                className="text-sm text-primary hover:underline"
              >
                Select All in Category
              </button>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeApproveRfqModal}
                  disabled={submitting}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApproveDraftRfq}
                  disabled={submitting || selectedSupplierIdsForApproval.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Approving..." : `Approve & Invite ${selectedSupplierIdsForApproval.length} Supplier${selectedSupplierIdsForApproval.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default StaffDashboard;



















