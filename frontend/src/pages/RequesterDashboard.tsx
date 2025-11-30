import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import { useTimezone } from "../hooks/useTimezone";
import { apiClient } from "../utils/client";
import {
  Category,
  Department,
  PurchaseRequest,
  RequestCreatePayload,
  RequestStatus,
  RequestDocument,
  RFQWithQuotations,
} from "../utils/types";

const getDefaultNeededBy = () =>
  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

type RequestFormState = Omit<RequestCreatePayload, "department_id"> & {
  department_id: number | "";
};

const createEmptyRequestForm = (
  category = "",
  departmentId: number | "" = ""
): RequestFormState => ({
  title: "",
  description: "",
  justification: "",
  category,
  department_id: departmentId,
  needed_by: getDefaultNeededBy(),
});

const statusColors: Record<RequestStatus, string> = {
  pending_hod: "bg-blue-100 text-blue-700",
  pending_procurement: "bg-amber-100 text-amber-700",
  pending_finance_approval: "bg-sky-100 text-sky-700",
  finance_approved: "bg-emerald-100 text-emerald-700",
  rfq_issued: "bg-indigo-100 text-indigo-700",
  rejected_by_hod: "bg-rose-100 text-rose-700",
  rejected_by_procurement: "bg-rose-100 text-rose-700",
  rejected_by_finance: "bg-rose-100 text-rose-700",
  completed: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  denied: "bg-rose-100 text-rose-700",
};

const statusLabels: Record<RequestStatus, string> = {
  pending_hod: "Pending HOD Approval",
  pending_procurement: "Pending Procurement",
  pending_finance_approval: "Pending Finance",
  finance_approved: "Finance Approved",
  rfq_issued: "RFQ Issued",
  rejected_by_hod: "Rejected by Head of Department",
  rejected_by_procurement: "Rejected by Procurement",
  rejected_by_finance: "Rejected by Finance",
  completed: "Completed",
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
};

const RequesterDashboard: React.FC = () => {
  const { toUtc, getCurrentLocal } = useTimezone();
  const [form, setForm] = useState<RequestFormState>(createEmptyRequestForm());
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [, setIsUploadingDocuments] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [rfqDetails, setRfqDetails] = useState<RFQWithQuotations | null>(null);
  const [isFetchingRfq, setIsFetchingRfq] = useState(false);
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [isUploadingAdditional, setIsUploadingAdditional] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const detailsFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get<PurchaseRequest[]>("/api/requests/me");
      setRequests(data);
    } catch (err) {
      console.error("Failed to load requests", err);
      setError("Unable to load your requests right now. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const { data } = await apiClient.get<Category[]>("/api/requests/categories");
      setCategories(data);
    } catch (err) {
      console.error("Failed to load categories", err);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data } = await apiClient.get<Department[]>("/api/requests/departments");
      setDepartments(data);
    } catch (err) {
      console.error("Failed to load departments", err);
    }
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) {
      return;
    }
    setAttachments((prev) => [...prev, ...files]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAdditionalFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) {
      return;
    }
    setAdditionalFiles((prev) => [...prev, ...files]);
    if (detailsFileInputRef.current) {
      detailsFileInputRef.current.value = "";
    }
  };

  const removeAdditionalFile = (index: number) => {
    setAdditionalFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  useEffect(() => {
    void loadRequests();
    void loadCategories();
    void loadDepartments();
  }, []);

  useEffect(() => {
    setForm((prev) => {
      const nextCategory =
        prev.category && categories.some((category) => category.name === prev.category)
          ? prev.category
          : categories[0]?.name ?? "";
      const nextDepartment =
        prev.department_id && departments.some((department) => department.id === prev.department_id)
          ? prev.department_id
          : departments[0]?.id ?? "";

      if (nextCategory === prev.category && nextDepartment === prev.department_id) {
        return prev;
      }
      return { ...prev, category: nextCategory, department_id: nextDepartment };
    });
  }, [categories, departments]);

  const uploadRequestDocuments = async (
    requestId: number,
    files: File[],
    setUploadingState: (value: boolean) => void
  ): Promise<PurchaseRequest | null> => {
    if (!files.length) {
      return null;
    }
    setUploadingState(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const { data } = await apiClient.post<PurchaseRequest>(
        `/api/requests/${requestId}/documents`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return data;
    } finally {
      setUploadingState(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const category = form.category.trim();
      if (!category) {
        setError("Please select a category for your request.");
        setIsSubmitting(false);
        return;
      }
      if (!form.department_id) {
        setError("Please select the requesting department.");
        setIsSubmitting(false);
        return;
      }
      if (!form.justification.trim()) {
        setError("Please provide a justification so Procurement understands the context.");
        setIsSubmitting(false);
        return;
      }

      // Convert date-only input to ISO datetime (end of day in local time)
      const neededByDate = form.needed_by.includes('T') 
        ? form.needed_by 
        : `${form.needed_by}T17:00:00`;

      const payload: RequestCreatePayload = {
        ...form,
        category,
        department_id: Number(form.department_id),
        needed_by: neededByDate,
      };

      let createdRequest = (
        await apiClient.post<PurchaseRequest>("/api/requests/", payload)
      ).data;

      try {
        const updatedRequest = await uploadRequestDocuments(
          createdRequest.id,
          attachments,
          setIsUploadingDocuments
        );
        if (updatedRequest) {
          createdRequest = updatedRequest;
        }
      } catch (uploadError) {
        console.error("Failed to upload documents", uploadError);
        setError(
          "Request submitted, but supporting documents could not be uploaded. You can add them from the request details panel."
        );
      }

      setRequests((prev) => [createdRequest, ...prev]);
      setSuccess("Request submitted and awaiting procurement review.");
      const resetForm = createEmptyRequestForm(
        categories[0]?.name ?? category,
        departments[0]?.id ?? form.department_id
      );
      resetForm.needed_by = form.needed_by;
      setForm(resetForm);
      setAttachments([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error("Failed to submit request", err);
      setError("Unable to submit the request. Please verify the details and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRequestDetails = async (request: PurchaseRequest) => {
    const current = requests.find((item) => item.id === request.id) ?? request;
    setSelectedRequest(current);
    setIsDetailsOpen(true);
    setAdditionalFiles([]);
    setRfqDetails(null);
    if (detailsFileInputRef.current) {
      detailsFileInputRef.current.value = "";
    }
    if (!current.rfq_id) {
      return;
    }

    setIsFetchingRfq(true);
    try {
      const { data } = await apiClient.get<RFQWithQuotations>(`/api/rfqs/${current.rfq_id}`);
      setRfqDetails(data);
    } catch (err) {
      console.error("Failed to load RFQ details", err);
      setRfqDetails(null);
    } finally {
      setIsFetchingRfq(false);
    }
  };

  const closeRequestDetails = () => {
    setIsDetailsOpen(false);
    setSelectedRequest(null);
    setRfqDetails(null);
    setAdditionalFiles([]);
    if (detailsFileInputRef.current) {
      detailsFileInputRef.current.value = "";
    }
  };

  const submitAdditionalDocuments = async () => {
    if (!selectedRequest || additionalFiles.length === 0) {
      return;
    }
    try {
      const updatedRequest = await uploadRequestDocuments(
        selectedRequest.id,
        additionalFiles,
        setIsUploadingAdditional
      );
      if (!updatedRequest) {
        return;
      }
      setRequests((prev) =>
        prev.map((request) => (request.id === updatedRequest.id ? updatedRequest : request))
      );
      setSelectedRequest(updatedRequest);
      setAdditionalFiles([]);
      if (detailsFileInputRef.current) {
        detailsFileInputRef.current.value = "";
      }
      setSuccess("Documents uploaded successfully.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error("Failed to upload additional documents", err);
      setError("Unable to upload documents. Please try again.");
    }
  };

  // Authenticated download handler
  const handleDownloadDocument = async (requestId: number, documentId: number, filename: string) => {
    try {
      const response = await apiClient.get(`/api/requests/${requestId}/documents/${documentId}`, { responseType: 'blob' });
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download failed:', err);
      setError('Failed to download file. Please try again.');
    }
  };

  const counts = useMemo(() => {
    const procurementCount = requests.filter(
      (request) => request.status === "pending_procurement" || request.status === "pending"
    ).length;
    const rfqCount = requests.filter((request) => request.status === "rfq_issued").length;
    const approvedCount = requests.filter((request) =>
      ["finance_approved", "completed"].includes(request.status)
    ).length;
    const rejectedCount = requests.filter((request) =>
      ["rejected_by_hod", "rejected_by_procurement", "rejected_by_finance", "denied"].includes(request.status)
    ).length;
    return {
      procurement: procurementCount,
      rfqIssued: rfqCount,
      approved: approvedCount,
      rejected: rejectedCount,
    };
  }, [requests]);

  const resolveNotes = (request: PurchaseRequest) => {
    if (request.procurement_rejection_reason) {
      return `Procurement: ${request.procurement_rejection_reason}`;
    }
    if (request.finance_rejection_reason) {
      return `Finance: ${request.finance_rejection_reason}`;
    }
    if (request.finance_notes) {
      return request.finance_notes;
    }
    if (request.procurement_notes) {
      return request.procurement_notes;
    }
    return "No updates shared yet.";
  };

  return (
    <Layout
      title="Requester Dashboard"
      subtitle="Submit needs to Procurement and track approval outcomes."
    >
      <div className="space-y-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-800">Submit Purchase Request</h1>
          <p className="mt-2 text-sm text-slate-600">
            Share what you need with Procurement. They will review, provide a target budget, and
            escalate to Finance when ready.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">New Request</h2>
          <p className="mt-1 text-sm text-slate-600">
            Provide the details Procurement needs to evaluate your request. You can attach supporting
            documents such as specifications or quotes to speed up the review.
          </p>

          <form className="mt-6 grid gap-6 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Title</label>
              <input
                required
                type="text"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="e.g. Laptops for new hires"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Category</label>
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Department</label>
              <select
                value={form.department_id}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    department_id: event.target.value ? Number(event.target.value) : "",
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <textarea
                required
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Describe what is needed, quantities, specifications, and timeframe."
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Justification / Business Impact
              </label>
              <textarea
                required
                rows={3}
                value={form.justification}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, justification: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Help approvers understand why this purchase is necessary."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Needed By</label>
              <input
                required
                type="date"
                value={form.needed_by.split('T')[0]}
                min={new Date().toISOString().split('T')[0]}
                onChange={(event) => setForm((prev) => ({ ...prev, needed_by: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-slate-500">Date must be today or in the future</p>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Supporting Documents</label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleAttachmentChange}
                className="mt-1 block w-full cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-slate-500">
                Optional. Attach specifications, proposals, or any context that helps Procurement.
              </p>
              {attachments.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {attachments.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between rounded border border-slate-200 px-3 py-2"
                    >
                      <span className="truncate pr-3">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="text-xs font-semibold uppercase text-rose-600 hover:text-rose-700"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="md:col-span-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setForm(
                    createEmptyRequestForm(
                      categories[0]?.name ?? "",
                      departments[0]?.id ?? ""
                    )
                  )
                }
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-40"
              >
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
          {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
          {success ? <p className="mt-4 text-sm text-emerald-600">{success}</p> : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Your Requests</h2>
              <p className="text-sm text-slate-500">
                Track progress from procurement review through RFQ invitations and final decisions.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700">
                Procurement: {counts.procurement}
              </span>
              <span className="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-700">
                RFQ Issued: {counts.rfqIssued}
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">
                Approved: {counts.approved}
              </span>
              <span className="rounded-full bg-rose-100 px-3 py-1 font-medium text-rose-700">
                Rejected: {counts.rejected}
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading your requests...</div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              You have not submitted any requests yet. Use the form above to get started.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Request
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Needed By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Updates
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {requests.map((request) => (
                    <tr key={request.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-800">{request.title}</p>
                        <p className="text-xs text-slate-500">Category: {request.category}</p>
                        {request.department_name ? (
                          <p className="text-xs text-slate-500">
                            Department: {request.department_name}
                          </p>
                        ) : null}
                        {request.rfq_id ? (
                          <p className="text-xs text-primary">
                            RFQ Created: #{request.rfq_id}{" "}
                            {request.rfq_title ? `– ${request.rfq_title}` : ""}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(request.needed_by).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusColors[request.status]
                            }`}
                        >
                          {statusLabels[request.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {resolveNotes(request)}
                      </td>
                      <td className="px-6 py-4 text-sm text-primary">
                        <button
                          type="button"
                          onClick={() => openRequestDetails(request)}
                          className="font-semibold hover:underline"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={isDetailsOpen && selectedRequest !== null}
        onClose={closeRequestDetails}
        title={selectedRequest ? `Request Details: ${selectedRequest.title}` : "Request Details"}
      >
        {selectedRequest ? (
          <div className="space-y-6 text-sm text-slate-700">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Category</p>
                <p className="mt-1 font-medium text-slate-800">{selectedRequest.category}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Department</p>
                <p className="mt-1 text-slate-700">
                  {selectedRequest.department_name ?? "Unassigned"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Needed By</p>
                <p className="mt-1 text-slate-700">
                  {new Date(selectedRequest.needed_by).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Status</p>
                <span
                  className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusColors[selectedRequest.status]}`}
                >
                  {statusLabels[selectedRequest.status]}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Description</p>
              <p className="mt-1 whitespace-pre-line text-slate-700">
                {selectedRequest.description}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Justification</p>
              <p className="mt-1 whitespace-pre-line text-slate-700">
                {selectedRequest.justification}
              </p>
            </div>

            <div className="rounded-lg bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-700">Status Highlights</h3>
              <dl className="mt-3 space-y-2 text-xs text-slate-600">
                <div className="flex items-start justify-between gap-4">
                  <dt className="font-semibold text-slate-700">Procurement</dt>
                  <dd className="text-right">
                    {selectedRequest.procurement_reviewed_at
                      ? `Reviewed ${new Date(
                        selectedRequest.procurement_reviewed_at
                      ).toLocaleDateString()}`
                      : "Awaiting review"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="font-semibold text-slate-700">RFQ Issued</dt>
                  <dd className="text-right">
                    {selectedRequest.rfq_id
                      ? selectedRequest.rfq_invited_at
                        ? `Sent to suppliers ${new Date(
                          selectedRequest.rfq_invited_at
                        ).toLocaleDateString()}`
                        : "RFQ linked"
                      : "Not yet issued"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="font-semibold text-slate-700">Approved</dt>
                  <dd className="text-right">
                    {["finance_approved", "completed", "rfq_issued"].includes(selectedRequest.status)
                      ? "Proceeding to sourcing"
                      : "Pending finance decision"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="font-semibold text-slate-700">Rejected</dt>
                  <dd className="text-right">
                    {selectedRequest.procurement_rejection_reason || selectedRequest.finance_rejection_reason
                      ? "See updates below"
                      : "No rejection recorded"}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-700">Latest Updates</h3>
              <p className="mt-2 text-slate-700">{resolveNotes(selectedRequest)}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-700">Supporting Documents</h3>
              {selectedRequest.documents.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {selectedRequest.documents.map((document: RequestDocument) => (
                    <li
                      key={document.id}
                      className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-xs"
                    >
                      <div>
                        <p className="font-medium text-slate-800">{document.original_filename}</p>
                        <p className="text-slate-500">
                          Uploaded {new Date(document.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownloadDocument(selectedRequest.id, document.id, document.original_filename)}
                        className="rounded border border-primary px-3 py-1 font-semibold text-primary hover:bg-primary/10"
                      >
                        Download
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  No supporting documents attached yet.
                </p>
              )}

              <div className="mt-4 space-y-3 rounded-lg border border-dashed border-slate-300 p-3">
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Add more documents
                </label>
                <input
                  ref={detailsFileInputRef}
                  type="file"
                  multiple
                  onChange={handleAdditionalFilesChange}
                  className="block w-full cursor-pointer rounded border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {additionalFiles.length > 0 ? (
                  <ul className="space-y-1 text-xs text-slate-600">
                    {additionalFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center justify-between">
                        <span className="truncate pr-3">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAdditionalFile(index)}
                          className="font-semibold uppercase text-rose-600 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <button
                  type="button"
                  onClick={submitAdditionalDocuments}
                  disabled={isUploadingAdditional || additionalFiles.length === 0}
                  className="rounded bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {isUploadingAdditional ? "Uploading..." : "Upload Documents"}
                </button>
              </div>
            </div>

            {selectedRequest.rfq_id ? (
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-700">
                  RFQ Details (#{selectedRequest.rfq_id})
                </h3>
                {isFetchingRfq ? (
                  <p className="text-xs text-slate-500">Loading RFQ information...</p>
                ) : rfqDetails ? (
                  <div className="space-y-2 text-slate-700">
                    <p className="font-medium text-slate-800">{rfqDetails.title}</p>
                    <p className="text-xs uppercase text-slate-500">
                      Status: <span className="text-slate-700">{rfqDetails.status}</span>
                    </p>
                    <p className="text-xs uppercase text-slate-500">
                      Deadline:{" "}
                      <span className="text-slate-700">
                        {new Date(rfqDetails.deadline).toLocaleDateString()}
                      </span>
                    </p>
                    <p className="text-xs uppercase text-slate-500">Summary</p>
                    <p className="whitespace-pre-line text-sm text-slate-700">
                      {rfqDetails.description}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    RFQ information is not available right now. It may have been closed or archived.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-600">No request selected.</p>
        )}
      </Modal>
    </Layout>
  );
};

export default RequesterDashboard;

