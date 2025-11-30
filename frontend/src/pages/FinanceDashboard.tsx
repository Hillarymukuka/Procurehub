import clsx from "clsx";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";
import { apiClient } from "../utils/client";
import {
  PurchaseRequest,
  Quotation,
  RFQWithQuotations,
  RequestFinanceApprovalPayload,
  RequestFinanceRejectionPayload,
  RequestStatus,
} from "../utils/types";

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


interface FinanceReviewFormState {
  budget_amount: string;
  budget_currency: string;
  finance_notes: string;
  rejection_reason: string;
}
const getQuotationDownloadUrl = (rfqId: number, quotationId: number) => {
  const raw = import.meta.env.VITE_API_BASE_URL ?? "";
  const normalized = raw ? raw.replace(/\/$/, "") : "";
  const apiBase = normalized
    ? normalized.endsWith("/api")
      ? normalized
      : `${normalized}/api`
    : "/api";
  return `${apiBase}/rfqs/${rfqId}/quotations/${quotationId}/download`;
};


const emptyFinanceForm: FinanceReviewFormState = {
  budget_amount: "",
  budget_currency: "ZMW",
  finance_notes: "",
  rejection_reason: "",
};
const currencyOptions = ["ZMW", "USD", "EUR", "GBP"] as const;
const FinanceDashboard: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();

  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [rfqs, setRfqs] = useState<RFQWithQuotations[]>([]);
  const [approvedRfqs, setApprovedRfqs] = useState<RFQWithQuotations[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [selectedRfq, setSelectedRfq] = useState<RFQWithQuotations | null>(null);
  const [rfqDetails, setRfqDetails] = useState<RFQWithQuotations | null>(null);

  const [isLoadingRequests, setIsLoadingRequests] = useState<boolean>(true);
  const [isLoadingRfqs, setIsLoadingRfqs] = useState<boolean>(true);
  const [isLoadingApprovedRfqs, setIsLoadingApprovedRfqs] = useState<boolean>(true);
  const [isLoadingRfq, setIsLoadingRfq] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [financeForm, setFinanceForm] = useState<FinanceReviewFormState>({ ...emptyFinanceForm });

  const loadRequests = async (retryCount = 0) => {
    setIsLoadingRequests(true);
    try {
      const { data } = await apiClient.get<PurchaseRequest[]>("/api/requests/");
      setRequests(data);
    } catch (err: any) {
      // If timeout and first attempt, retry once (likely cold start)
      if (err.code === 'ECONNABORTED' && retryCount === 0) {
        console.log("Server cold start detected, retrying...");
        return loadRequests(1);
      }
      console.error("Failed to load purchase requests:", err);
      setError(parseErrorMessage(err) || "Unable to load purchase requests at the moment.");
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const loadRfqs = async () => {
    setIsLoadingRfqs(true);
    try {
      const { data } = await apiClient.get<RFQWithQuotations[]>("/api/rfqs/pending-finance-approvals");
      setRfqs(data);
    } catch (err) {
      console.error("Failed to load RFQs:", err);
      setError(parseErrorMessage(err) || "Unable to load RFQs at the moment.");
    } finally {
      setIsLoadingRfqs(false);
    }
  };

  const loadApprovedRfqs = async () => {
    setIsLoadingApprovedRfqs(true);
    try {
      const { data } = await apiClient.get<RFQWithQuotations[]>("/api/rfqs/finance-approved");
      setApprovedRfqs(data);
    } catch (err) {
      console.error("Failed to load approved RFQs:", err);
      setError(parseErrorMessage(err) || "Unable to load approved RFQs at the moment.");
    } finally {
      setIsLoadingApprovedRfqs(false);
    }
  };

  const loadRfqDetails = async (rfqId: number) => {
    setIsLoadingRfq(true);
    try {
      const { data } = await apiClient.get<RFQWithQuotations>(`/api/rfqs/${rfqId}`);
      setRfqDetails(data);
    } catch (err) {
      console.error("Failed to load RFQ details:", err);
      setError(parseErrorMessage(err) || "Unable to load RFQ details for the selected request.");
      setRfqDetails(null);
    } finally {
      setIsLoadingRfq(false);
    }
  };

  useEffect(() => {
    loadRequests();
    loadRfqs();
    loadApprovedRfqs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!requests.length) {
      setSelectedRequest(null);
      return;
    }

    if (selectedRequest) {
      const updated = requests.find((request) => request.id === selectedRequest.id);
      if (updated && updated !== selectedRequest) {
        setSelectedRequest(updated);
      }
      return;
    }

    // Only auto-select first request if no RFQ is selected
    if (!selectedRfq) {
      setSelectedRequest(requests[0]);
    }
  }, [requests, selectedRequest, selectedRfq]);

  useEffect(() => {
    // Only load RFQ details if a request is selected (not an RFQ directly)
    if (selectedRequest?.rfq_id && !selectedRfq) {
      loadRfqDetails(selectedRequest.rfq_id);
    } else if (!selectedRequest && !selectedRfq) {
      setRfqDetails(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRequest?.rfq_id]);

  useEffect(() => {
    if (!selectedRequest) {
      setFinanceForm({ ...emptyFinanceForm });
      return;
    }

    setFinanceForm({
      budget_amount: selectedRequest.finance_budget_amount
        ? String(selectedRequest.finance_budget_amount)
        : selectedRequest.proposed_budget_amount
        ? String(selectedRequest.proposed_budget_amount)
        : "",
      budget_currency:
        selectedRequest.finance_budget_currency ??
        selectedRequest.proposed_budget_currency ??
        "ZMW",
      finance_notes: selectedRequest.finance_notes ?? "",
      rejection_reason: "",
    });
  }, [selectedRequest]);

  const budgetOverview = useMemo(() => {
    if (!requests.length) {
      return {
        totalBudget: 0,
        pendingBudget: 0,
        approvedBudget: 0,
        pendingCount: 0,
        approvedCount: 0,
      };
    }

    return requests.reduce(
      (acc, request) => {
        const proposed = Number(request.proposed_budget_amount ?? 0);
        const financeApproved = Number(request.finance_budget_amount ?? proposed);
        acc.totalBudget += proposed;
        if (request.status === "pending_finance_approval" || request.status === "pending") {
          acc.pendingBudget += proposed;
          acc.pendingCount += 1;
        } else if (request.status === "finance_approved" || request.status === "approved") {
          acc.approvedBudget += financeApproved;
          acc.approvedCount += 1;
        }
        return acc;
      },
      {
        totalBudget: 0,
        pendingBudget: 0,
        approvedBudget: 0,
        pendingCount: 0,
        approvedCount: 0,
      }
    );
  }, [requests]);

  const pendingQuotations = useMemo(() => {
    if (!rfqDetails) return [];
    return rfqDetails.quotations.filter((quotation) => quotation.status === "submitted");
  }, [rfqDetails]);

  const primaryCurrency = useMemo(
    () => (requests.length ? requests[0].proposed_budget_currency ?? "USD" : "USD"),
    [requests]
  );
  const hasMixedCurrencies = useMemo(() => {
    if (!requests.length) return false;
    const unique = new Set(
      requests.map((request) => request.proposed_budget_currency ?? "USD")
    );
    return unique.size > 1;
  }, [requests]);

  const financeCurrencyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...currencyOptions, financeForm.budget_currency].filter(
            (value): value is string => Boolean(value)
          )
        )
      ),
    [financeForm.budget_currency]
  );

  const requestStatusStyles: Record<RequestStatus, string> = {
    pending_procurement: "bg-amber-100 text-amber-700",
    pending_finance_approval: "bg-sky-100 text-sky-700",
    finance_approved: "bg-emerald-100 text-emerald-700",
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
    rejected_by_procurement: "Rejected by Procurement",
    rejected_by_finance: "Rejected by Finance",
    completed: "Completed",
    pending: "Pending",
    approved: "Approved",
    denied: "Denied",
  };

  const renderRequestBudgets = (request: PurchaseRequest) => {
    const procurementBudget = request.proposed_budget_amount;
    const financeBudget = request.finance_budget_amount;

    if (!procurementBudget && !financeBudget) {
      return <span className="text-xs text-slate-500">Budget pending</span>;
    }

    return (
      <div className="space-y-1">
        {procurementBudget ? (
          <p className="text-xs text-slate-600">
            Procurement:{" "}
            <span className="font-medium text-slate-800">
              {formatCurrency(
                Number(procurementBudget),
                request.proposed_budget_currency ?? "ZMW"
              )}
            </span>
          </p>
        ) : null}
        {financeBudget ? (
          <p className="text-xs text-slate-600">
            Finance:{" "}
            <span className="font-medium text-slate-800">
              {formatCurrency(
                Number(financeBudget),
                request.finance_budget_currency || request.proposed_budget_currency || "ZMW"
              )}
            </span>
          </p>
        ) : null}
      </div>
    );
  };


  const resolveRequestNotes = (request: PurchaseRequest) => {
    if (request.finance_rejection_reason) {
      return `Finance: ${request.finance_rejection_reason}`;
    }
    if (request.procurement_rejection_reason) {
      return `Procurement: ${request.procurement_rejection_reason}`;
    }
    if (request.finance_notes) {
      return request.finance_notes;
    }
    if (request.procurement_notes) {
      return request.procurement_notes;
    }
    return "—";
  };
  const handleSelectRequest = (request: PurchaseRequest) => {
    setSelectedRequest(request);
    setSelectedRfq(null); // Clear selected RFQ when selecting a request
    setFeedback(null);
    setError(null);
  };

  const handleApproveQuotation = async (rfqId: number, quotation: Quotation) => {
    setSubmitting(true);
    setError(null);
    setFeedback(null);
    try {
      // Send empty form data for Finance approval (no justification needed for pending_finance_approval)
      const formData = new FormData();
      await apiClient.post(`/api/rfqs/${rfqId}/quotations/${quotation.id}/approve`, formData);
      setFeedback("Quotation approved successfully.");
      await loadRfqDetails(rfqId);
      await loadRequests();
      await loadRfqs(); // Reload RFQs to update pending finance approvals list
      await loadApprovedRfqs(); // Reload approved RFQs to show newly approved RFQ
    } catch (err) {
      console.error("Failed to approve quotation:", err);
      setError(parseErrorMessage(err) || "Unable to approve the quotation. Please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinanceApprove = async () => {
    if (!selectedRequest) return;

    const amount = financeForm.budget_amount ? Number(financeForm.budget_amount) : undefined;
    if (financeForm.budget_amount && (Number.isNaN(amount) || amount <= 0)) {
      setError("Please provide a valid budget amount before approving.");
      return;
    }

    const payload: RequestFinanceApprovalPayload = {};
    if (amount !== undefined) {
      payload.budget_amount = amount;
    }
    if (financeForm.budget_currency) {
      payload.budget_currency = financeForm.budget_currency;
    }
    if (financeForm.finance_notes) {
      payload.finance_notes = financeForm.finance_notes;
    }

    try {
      setSubmitting(true);
      setError(null);
      await apiClient.put(`/api/requests/${selectedRequest.id}/finance/approve`, payload);
      setFeedback("Request approved by Finance.");
      await loadRequests();
    } catch (err) {
      console.error("Finance approval failed:", err);
      setError(parseErrorMessage(err) || "Unable to approve the request right now.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinanceReject = async () => {
    if (!selectedRequest) return;
    if (!financeForm.rejection_reason.trim()) {
      setError("Please provide a reason before rejecting a request.");
      return;
    }

    const payload: RequestFinanceRejectionPayload = {
      reason: financeForm.rejection_reason.trim(),
      finance_notes: financeForm.finance_notes || undefined,
    };

    try {
      setSubmitting(true);
      setError(null);
      await apiClient.put(`/api/requests/${selectedRequest.id}/finance/reject`, payload);
      setFeedback("Request rejected by Finance.");
      await loadRequests();
    } catch (err) {
      console.error("Finance rejection failed:", err);
      setError(parseErrorMessage(err) || "Unable to reject the request right now.");
    } finally {
      setSubmitting(false);
    }
  };

  const requestBudgetAmount = selectedRequest
    ? Number(selectedRequest.finance_budget_amount ?? selectedRequest.proposed_budget_amount ?? 0)
    : 0;
  const requestCurrency =
    selectedRequest?.finance_budget_currency ?? selectedRequest?.proposed_budget_currency ?? "USD";

  return (
    <Layout
      title="Finance Workspace"
      subtitle={`Hi ${user?.full_name}, review request budgets and approve compliant quotations.`}
    >
      {error ? (
        <div className="mb-6 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}
      {feedback ? (
        <div className="mb-6 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total Request Budget"
          value={formatCurrency(budgetOverview.totalBudget, primaryCurrency)}
          helperText={`${requests.length} tracked request${requests.length === 1 ? "" : "s"}${
            hasMixedCurrencies ? " • Mixed currencies" : ""
          }`}
        />
        <StatCard
          label="Pending Review"
          value={formatCurrency(budgetOverview.pendingBudget, primaryCurrency)}
          helperText={`${budgetOverview.pendingCount} pending`}
        />
        <StatCard
          label="Approved Budget"
          value={formatCurrency(budgetOverview.approvedBudget, primaryCurrency)}
          helperText={`${budgetOverview.approvedCount} approved`}
        />
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          {/* RFQs with Pending Finance Approvals */}
          {rfqs.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 shadow-sm">
              <div className="border-b border-amber-200 px-5 py-4">
                <h2 className="text-base font-semibold text-amber-900">
                  Quotations Pending Approval
                </h2>
                <p className="text-xs text-amber-700">
                  {isLoadingRfqs ? "Loading..." : `${rfqs.length} RFQ${rfqs.length !== 1 ? 's' : ''} with quotations exceeding budget`}
                </p>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {isLoadingRfqs ? (
                  <div className="flex items-center justify-center px-5 py-10 text-sm text-amber-600">
                    Loading...
                  </div>
                ) : (
                  <ul className="divide-y divide-amber-100">
                    {rfqs.map((rfq) => {
                      const pendingQuotations = rfq.quotations?.filter(q => q.status === "pending_finance_approval") || [];
                      const isActive = selectedRfq?.id === rfq.id;
                      return (
                        <li key={rfq.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRfq(rfq);
                              setSelectedRequest(null);
                              setRfqDetails(rfq);
                            }}
                            className={clsx(
                              "w-full px-5 py-4 text-left transition",
                              isActive
                                ? "bg-amber-100 text-amber-900"
                                : "hover:bg-amber-50 text-amber-800"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold">{rfq.title}</span>
                              <span className="inline-flex rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-900">
                                {pendingQuotations.length} pending
                              </span>
                            </div>
                            <div className="mt-2 text-xs text-amber-700">
                              RFQ #{rfq.rfq_number}
                            </div>
                            <div className="mt-1 text-xs text-amber-600">
                              Budget: {formatCurrency(rfq.budget || 0, rfq.currency)}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Approved RFQs (Finance Approved) */}
          {approvedRfqs.length > 0 && (
            <div className="rounded-2xl border border-green-200 bg-green-50/50 shadow-sm">
              <div className="border-b border-green-200 px-5 py-4">
                <h2 className="text-base font-semibold text-green-900">
                  Finance Approved RFQs
                </h2>
                <p className="text-xs text-green-700">
                  {isLoadingApprovedRfqs ? "Loading..." : `${approvedRfqs.length} approved RFQ${approvedRfqs.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {isLoadingApprovedRfqs ? (
                  <div className="flex items-center justify-center px-5 py-10 text-sm text-green-600">
                    Loading...
                  </div>
                ) : (
                  <ul className="divide-y divide-green-100">
                    {approvedRfqs.map((rfq) => {
                      const approvedQuotation = rfq.quotations?.find(q => q.status === "approved");
                      const isActive = selectedRfq?.id === rfq.id;
                      return (
                        <li key={rfq.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRfq(rfq);
                              setSelectedRequest(null);
                              setRfqDetails(rfq);
                            }}
                            className={clsx(
                              "w-full px-5 py-4 text-left transition",
                              isActive
                                ? "bg-green-100 text-green-900"
                                : "hover:bg-green-50 text-green-800"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold">{rfq.title}</span>
                              <span className="inline-flex rounded-full bg-green-200 px-3 py-1 text-xs font-semibold text-green-900">
                                ✓ Approved
                              </span>
                            </div>
                            <div className="mt-2 text-xs text-green-700">
                              RFQ #{rfq.rfq_number}
                            </div>
                            <div className="mt-1 text-xs text-green-600">
                              Awarded: {approvedQuotation ? formatCurrency(approvedQuotation.amount, approvedQuotation.currency) : '-'}
                            </div>
                            {approvedQuotation?.approved_at && (
                              <div className="mt-1 text-xs text-green-500">
                                Approved: {new Date(approvedQuotation.approved_at).toLocaleDateString()}
                              </div>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Purchase Requests */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-800">Purchase Requests</h2>
              <p className="text-xs text-slate-500">
                {isLoadingRequests ? "Loading..." : `${requests.length} requests`}
              </p>
            </div>
            <div className="max-h-[620px] overflow-y-auto">
            {isLoadingRequests ? (
              <div className="flex items-center justify-center px-5 py-10 text-sm text-slate-500">
                Loading requests...
              </div>
            ) : requests.length ? (
              <ul className="divide-y divide-slate-100">
                {requests.map((request) => {
                  const isActive = selectedRequest?.id === request.id;
                  return (
                    <li key={request.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectRequest(request)}
                        className={clsx(
                          "w-full px-5 py-4 text-left transition",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-slate-50 text-slate-700"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{request.title}</span>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              requestStatusStyles[request.status] ?? "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {requestStatusLabels[request.status] ?? request.status}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          Needed by {new Date(request.needed_by).toLocaleDateString()}
                        </div>
                        <div className="mt-1">
                          {renderRequestBudgets(request)}
                        </div>
                        {request.rfq_number ? (
                          <div className="mt-1 text-xs font-mono text-slate-500">
                            RFQ {request.rfq_number}
                          </div>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex items-center justify-center px-5 py-10 text-sm text-slate-500">
                No purchase requests available.
              </div>
            )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">
              {selectedRfq ? "RFQ Details" : "Request Details"}
            </h2>
            {selectedRfq ? (
              <div className="mt-4 space-y-4 text-sm text-slate-700">
                <div>
                  <p className="text-xs uppercase text-slate-400">RFQ Title</p>
                  <p className="text-base font-semibold text-slate-800">{selectedRfq.title}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Description</p>
                  <p className="whitespace-pre-line">{selectedRfq.description}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase text-slate-400">RFQ Number</p>
                    <p className="font-mono font-medium text-slate-700">{selectedRfq.rfq_number}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Category</p>
                    <p className="font-medium">{selectedRfq.category}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Budget</p>
                    <p className="font-semibold text-slate-800">
                      {formatCurrency(selectedRfq.budget || 0, selectedRfq.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Deadline</p>
                    <p className="font-medium">
                      {new Date(selectedRfq.deadline).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Status</p>
                    <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                      {selectedRfq.status}
                    </span>
                  </div>
                </div>
              </div>
            ) : selectedRequest ? (
              <div className="mt-4 space-y-4 text-sm text-slate-700">
                <div>
                  <p className="text-xs uppercase text-slate-400">Request Title</p>
                  <p className="text-base font-semibold text-slate-800">{selectedRequest.title}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Purpose</p>
                  <p className="whitespace-pre-line">{selectedRequest.description}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Justification</p>
                  <p className="whitespace-pre-line">{selectedRequest.justification}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {selectedRequest.rfq_number ? (
                    <div>
                      <p className="text-xs uppercase text-slate-400">RFQ Number</p>
                      <p className="font-mono font-medium text-slate-700">
                        {selectedRequest.rfq_number}
                      </p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-xs uppercase text-slate-400">Category</p>
                    <p className="font-medium">{selectedRequest.category}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Department</p>
                    <p className="font-medium">{selectedRequest.department_name ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Needed By</p>
                    <p className="font-medium">
                      {new Date(selectedRequest.needed_by).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Status</p>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        requestStatusStyles[selectedRequest.status] ?? "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {requestStatusLabels[selectedRequest.status] ?? selectedRequest.status}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Budgets</p>
                  {renderRequestBudgets(selectedRequest)}
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Notes</p>
                  <p className="text-xs text-slate-600">{resolveRequestNotes(selectedRequest)}</p>
                </div>
              </div>
            ) : (
              <div className="mt-6 text-sm text-slate-500">
                Select a purchase request to view its budget details.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">Finance Review</h2>
            {selectedRequest ? (
              ["pending_finance_approval", "pending"].includes(selectedRequest.status) ? (
                <div className="mt-4 space-y-4 text-sm text-slate-700">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium uppercase text-slate-400">Budget Amount</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={financeForm.budget_amount}
                        onChange={(event) =>
                          setFinanceForm((prev) => ({ ...prev, budget_amount: event.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium uppercase text-slate-400">Currency</label>
                      <select
                        value={financeForm.budget_currency}
                        onChange={(event) =>
                          setFinanceForm((prev) => ({ ...prev, budget_currency: event.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none"
                      >
                        {financeCurrencyOptions.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium uppercase text-slate-400">Finance Notes</label>
                      <textarea
                        rows={3}
                        value={financeForm.finance_notes}
                        onChange={(event) =>
                          setFinanceForm((prev) => ({ ...prev, finance_notes: event.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none"
                        placeholder="Add context for procurement (optional)."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium uppercase text-slate-400">Rejection Reason</label>
                      <textarea
                        rows={2}
                        value={financeForm.rejection_reason}
                        onChange={(event) =>
                          setFinanceForm((prev) => ({ ...prev, rejection_reason: event.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none"
                        placeholder="Required if rejecting the request."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleFinanceReject}
                      disabled={submitting}
                      className="rounded-lg border border-rose-500 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={handleFinanceApprove}
                      disabled={submitting}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {submitting ? "Saving..." : "Approve"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <p>Finance decision recorded. You can adjust notes and budgets once procurement reopens the request.</p>
                  <div>{renderRequestBudgets(selectedRequest)}</div>
                  {selectedRequest.finance_rejection_reason ? (
                    <p className="text-xs text-rose-600">Reason: {selectedRequest.finance_rejection_reason}</p>
                  ) : null}
                  {selectedRequest.finance_notes ? (
                    <p className="text-xs text-slate-500">Notes: {selectedRequest.finance_notes}</p>
                  ) : null}
                </div>
              )) : (
              <div className="mt-4 text-sm text-slate-500">Select a request or RFQ to review.</div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Quotations</h2>
              <p className="text-xs uppercase text-slate-400">
                {selectedRfq ? (
                  `${rfqDetails?.quotations.length ?? 0} submissions`
                ) : selectedRequest?.rfq_id ? (
                  isLoadingRfq
                    ? "Loading..."
                    : `${rfqDetails?.quotations.length ?? 0} submissions`
                ) : (
                  "RFQ not issued"
                )}
              </p>
            </div>

            {!selectedRequest && !selectedRfq ? (
              <div className="mt-6 text-sm text-slate-500">
                Select a request or RFQ to inspect supplier quotations.
              </div>
            ) : selectedRequest && !selectedRequest.rfq_id ? (
              <div className="mt-6 text-sm text-slate-500">
                No RFQ has been created for this request yet.
              </div>
            ) : isLoadingRfq ? (
              <div className="mt-6 text-sm text-slate-500">Loading quotations...</div>
            ) : rfqDetails && rfqDetails.quotations.length ? (
              <div className="mt-4 space-y-4">
                {rfqDetails.quotations.map((quotation) => {
                  const effectiveTotal = Number(quotation.amount ?? 0);
                  const rfqBudget = selectedRfq ? selectedRfq.budget : requestBudgetAmount;
                  const withinBudget = effectiveTotal <= (rfqBudget || 0);
                  const delta = effectiveTotal - (rfqBudget || 0);

                  return (
                    <div
                      key={quotation.id}
                      className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-700"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-800">
                            {quotation.supplier_name ?? `Supplier #${quotation.supplier_id}`}
                          </p>
                          {quotation.supplier_number && (
                            <p className="text-xs text-slate-600">{quotation.supplier_number}</p>
                          )}
                          <p className="text-base font-bold text-slate-900">
                            {formatCurrency(effectiveTotal, quotation.currency)}
                            {quotation.vat_rate || quotation.tot_rate ? (
                              <span className="ml-1 text-xs text-slate-500">(includes taxes)</span>
                            ) : null}
                          </p>
                          <p className="text-xs text-slate-500">
                            Submitted {new Date(quotation.submitted_at).toLocaleDateString()}
                          </p>
                          <p
                            className={clsx(
                              "text-xs font-semibold",
                              withinBudget ? "text-emerald-600" : "text-rose-600"
                            )}
                          >
                            {withinBudget
                              ? "Within requested budget"
                              : `Over budget by ${formatCurrency(Math.abs(delta), quotation.currency)}`}
                          </p>
                          {quotation.notes ? (
                            <p className="text-xs text-slate-500">Notes: {quotation.notes}</p>
                          ) : null}
                          {quotation.budget_override_justification && quotation.status === "approved" ? (
                            <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                              <p className="text-xs font-semibold text-amber-900 mb-1">Budget Override Justification:</p>
                              <p className="text-xs text-amber-800">{quotation.budget_override_justification}</p>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span
                            className={clsx(
                              "rounded-full px-3 py-1 text-xs font-semibold uppercase",
                              quotation.status === "approved"
                                ? "bg-emerald-100 text-emerald-700"
                                : quotation.status === "rejected"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-700"
                            )}
                          >
                            {quotation.status}
                          </span>
                          {quotation.document_path && quotation.original_filename ? (
                            <a
                              href={getQuotationDownloadUrl(selectedRfq.id, quotation.id)}
                              className="text-xs font-semibold text-primary hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View Document
                            </a>
                          ) : null}
                          {quotation.status === "pending_finance_approval" ? (
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                                Pending Your Approval
                              </span>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => {
                                  const rfqId = selectedRfq ? selectedRfq.id : selectedRequest?.rfq_id;
                                  if (rfqId) {
                                    handleApproveQuotation(rfqId, quotation);
                                  }
                                }}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold uppercase text-white hover:bg-emerald-700 transition disabled:opacity-50"
                              >
                                {submitting ? "Approving..." : "Approve"}
                              </button>
                            </div>
                          ) : quotation.status === "submitted" ? (
                            <button
                              type="button"
                              disabled={submitting || !withinBudget}
                              onClick={() => {
                                const rfqId = selectedRfq ? selectedRfq.id : selectedRequest?.rfq_id;
                                if (rfqId) {
                                  handleApproveQuotation(rfqId, quotation);
                                }
                              }}
                              className={clsx(
                                "rounded-lg px-3 py-2 text-xs font-semibold uppercase text-white transition",
                                withinBudget
                                  ? "bg-emerald-600 hover:bg-emerald-700"
                                  : "bg-slate-300 cursor-not-allowed"
                              )}
                            >
                              {withinBudget ? (submitting ? "Approving..." : "Approve") : "Over Budget"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!pendingQuotations.length ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-500">
                    All quotations for this RFQ have been processed.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-6 text-sm text-slate-500">No quotations submitted yet.</div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default FinanceDashboard;

