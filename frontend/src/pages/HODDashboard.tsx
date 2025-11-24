import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, FileText, Clock, Package } from "lucide-react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import StatCard from "../components/StatCard";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";
import { useTimezone } from "../hooks/useTimezone";
import { apiClient } from "../utils/client";
import { PurchaseRequest, RequestDocument } from "../utils/types";

const HODDashboard: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const { formatDisplay } = useTimezone();
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      console.log("HOD Dashboard: Fetching requests...");
      const response = await apiClient.get<PurchaseRequest[]>("/api/requests/");
      console.log("HOD Dashboard: Requests fetched successfully:", response.data.length);
      setRequests(response.data);
    } catch (error: any) {
      console.error("HOD Dashboard: Failed to fetch requests:", error);
      console.error("HOD Dashboard: Error response:", error.response?.data);
      console.error("HOD Dashboard: Error status:", error.response?.status);
      
      // If 401/403, user might not be authenticated properly
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.error("HOD Dashboard: Authentication/Authorization error - user will be logged out");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Filter requests pending HOD approval
  const pendingRequests = requests.filter((r) => r.status === "pending_hod");
  const approvedRequests = requests.filter((r) => 
    r.status !== "pending_hod" && 
    r.status !== "rejected_by_hod" && 
    r.hod_reviewer_id === user?.id
  );
  const rejectedRequests = requests.filter((r) => r.status === "rejected_by_hod");

  const handleOpenModal = (request: PurchaseRequest, type: "approve" | "reject") => {
    setSelectedRequest(request);
    setActionType(type);
    setNotes("");
    setRejectionReason("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRequest(null);
    setActionType(null);
    setNotes("");
    setRejectionReason("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !actionType) return;

    setIsSubmitting(true);
    try {
      if (actionType === "approve") {
        await apiClient.put(`/api/requests/${selectedRequest.id}/hod-approve`, {
          notes: notes.trim() || undefined,
        });
      } else {
        if (!rejectionReason.trim()) {
          alert("Please provide a rejection reason");
          return;
        }
        await apiClient.put(`/api/requests/${selectedRequest.id}/hod-reject`, {
          reason: rejectionReason.trim(),
        });
      }
      await fetchRequests();
      handleCloseModal();
    } catch (error: any) {
      console.error("Failed to process request:", error);
      alert(error.response?.data?.detail || "Failed to process request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadDocument = async (requestId: number) => {
    try {
      const response = await apiClient.get(`/api/requests/${requestId}/document`, {
        responseType: "blob",
      });
      const contentDisposition = response.headers["content-disposition"];
      let filename = `request-${requestId}-document.pdf`;
      if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches?.[1]) {
          filename = matches[1].replace(/['"]/g, "");
        }
      }
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Failed to download document:", error);
      alert(error.response?.data?.detail || "Failed to download document");
    }
  };

  if (isLoading) {
    return (
      <Layout title="Head of Department Dashboard" subtitle={user?.department_name}>
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Head of Department Dashboard" subtitle={user?.department_name}>
      <div className="space-y-6">
        {/* Statistics */}
        <div className="grid gap-6 md:grid-cols-3">
          <StatCard
            label="Pending Approval"
            value={pendingRequests.length}
          />
          <StatCard
            label="Approved"
            value={approvedRequests.length}
          />
          <StatCard
            label="Rejected"
            value={rejectedRequests.length}
          />
        </div>

        {/* Pending Requests */}
        <div className="rounded-lg border border-primary/20 bg-white shadow-sm">
          <div className="border-b border-primary/20 bg-primary/5 px-6 py-4">
            <h2 className="text-lg font-semibold text-primary">Pending Approval</h2>
          </div>
          <div className="p-6">
            {pendingRequests.length === 0 ? (
              <p className="text-center text-gray-500">No pending requests</p>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-gray-900">{request.title}</h3>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">{request.description}</p>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                          <span>
                            <strong>Requester:</strong> {request.requester_name}
                          </span>
                          <span>
                            <strong>Department:</strong> {request.department_name}
                          </span>
                          <span>
                            <strong>Category:</strong> {request.category}
                          </span>
                          {request.proposed_budget_amount && (
                            <span>
                              <strong>Budget:</strong> {formatCurrency(request.proposed_budget_amount, request.proposed_budget_currency || 'USD')}
                            </span>
                          )}
                          <span>
                            <strong>Created:</strong> {formatDisplay(request.created_at)}
                          </span>
                        </div>
                        {request.documents && request.documents.length > 0 && (
                          <button
                            onClick={() => downloadDocument(request.id)}
                            className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <FileText className="h-4 w-4" />
                            Download Document
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleOpenModal(request, "approve")}
                          className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleOpenModal(request, "reject")}
                          className="flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Approved Requests */}
        {approvedRequests.length > 0 && (
          <div className="rounded-lg border border-primary/20 bg-white shadow-sm">
            <div className="border-b border-primary/20 bg-green-50 px-6 py-4">
              <h2 className="text-lg font-semibold text-green-700">Approved Requests</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {approvedRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-lg border border-green-200 bg-green-50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{request.title}</h3>
                        <p className="text-sm text-gray-600">
                          Requester: {request.requester_name} • Approved: {formatDisplay(request.hod_reviewed_at!)}
                        </p>
                        {request.hod_notes && (
                          <p className="mt-1 text-sm text-gray-500">
                            <strong>Your Notes:</strong> {request.hod_notes}
                          </p>
                        )}
                        {request.status === "rejected_by_procurement" && request.procurement_rejection_reason && (
                          <p className="mt-1 text-sm text-red-600">
                            <strong>Rejected by Procurement:</strong> {request.procurement_rejection_reason}
                          </p>
                        )}
                        {request.status === "rejected_by_procurement" && request.procurement_notes && (
                          <p className="mt-1 text-sm text-red-600">
                            <strong>Procurement Notes:</strong> {request.procurement_notes}
                          </p>
                        )}
                        {request.status !== "rejected_by_procurement" && request.procurement_notes && (
                          <p className="mt-1 text-sm text-gray-500">
                            <strong>Procurement Review:</strong> {request.procurement_notes}
                          </p>
                        )}
                        {request.rfq_number && (
                          <p className="mt-1 text-sm text-blue-600">
                            <strong>RFQ:</strong> {request.rfq_number} - {request.rfq_title}
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                        {request.status.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rejected Requests */}
        {rejectedRequests.length > 0 && (
          <div className="rounded-lg border border-primary/20 bg-white shadow-sm">
            <div className="border-b border-primary/20 bg-red-50 px-6 py-4">
              <h2 className="text-lg font-semibold text-red-700">Rejected Requests</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {rejectedRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-lg border border-red-200 bg-red-50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{request.title}</h3>
                        <p className="text-sm text-gray-600">
                          {request.requester_name}
                          {request.proposed_budget_amount && ` • ${formatCurrency(request.proposed_budget_amount, request.proposed_budget_currency || 'USD')}`} • 
                          Rejected: {formatDisplay(request.hod_reviewed_at!)}
                        </p>
                        {request.hod_rejection_reason && (
                          <p className="mt-1 text-sm text-red-600">
                            <strong>Reason:</strong> {request.hod_rejection_reason}
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                        REJECTED
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Approval/Rejection Modal */}
      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        title={actionType === "approve" ? "Approve Request" : "Reject Request"}
      >
        {selectedRequest && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <h3 className="font-semibold text-gray-900">{selectedRequest.title}</h3>
              <p className="text-sm text-gray-600">{selectedRequest.description}</p>
              {selectedRequest.proposed_budget_amount && (
                <p className="mt-2 text-sm text-gray-500">
                  <strong>Budget:</strong> {formatCurrency(selectedRequest.proposed_budget_amount, selectedRequest.proposed_budget_currency || 'USD')}
                </p>
              )}
            </div>

            {actionType === "approve" ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={3}
                  placeholder="Add any comments or instructions..."
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={3}
                  placeholder="Explain why this request is being rejected..."
                  required
                />
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                  actionType === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                } disabled:opacity-50`}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Processing..." : actionType === "approve" ? "Approve" : "Reject"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </Layout>
  );
};

export default HODDashboard;
