import axios from "axios";
import clsx from "clsx";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import RFQTable from "../components/RFQTable";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";
import { useTimezone } from "../hooks/useTimezone";
import { apiClient } from "../utils/client";
import {
  RFQ,
  SupplierInvitation,
  SupplierProfile,
  Quotation,
  PurchaseOrder,
  Message,
  MessageListResponse,
} from "../utils/types";

const invitationStatusLabels: Record<string, string> = {
  invited: "Invited",
  responded: "Submitted",
  awarded: "Awarded",
  not_selected: "Not Selected",
};

const invitationStatusStyles: Record<string, string> = {
  invited: "bg-slate-200 text-slate-600",
  responded: "bg-blue-100 text-blue-700",
  awarded: "bg-emerald-100 text-emerald-700",
  not_selected: "bg-rose-100 text-rose-700",
};

const SupplierDashboard: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const { formatDisplay } = useTimezone();
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [invitations, setInvitations] = useState<SupplierInvitation[]>([]);
  const [activeRfqs, setActiveRfqs] = useState<RFQ[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedRfq, setSelectedRfq] = useState<RFQ | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [selectedInvitation, setSelectedInvitation] = useState<SupplierInvitation | null>(null);
  const [openedInvitationIds, setOpenedInvitationIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState<boolean>(false);
  const [isInvitationDetailsOpen, setIsInvitationDetailsOpen] = useState<boolean>(false);
  const [quoteAmount, setQuoteAmount] = useState<string>("");
  const [quoteCurrency, setQuoteCurrency] = useState<string>("ZMW");
  const [quoteTaxType, setQuoteTaxType] = useState<string>("None");
  const [quoteNotes, setQuoteNotes] = useState<string>("");
  const [quoteFile, setQuoteFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [isReplyMode, setIsReplyMode] = useState<boolean>(false);
  const [replyContent, setReplyContent] = useState<string>("");

  const loadSupplierData = async () => {
    setIsLoading(true);
    try {
      const [profileRes, invitationsRes, rfqsRes, ordersRes, messagesRes] = await Promise.all([
        apiClient.get<SupplierProfile>("/api/suppliers/me/profile"),
        apiClient.get<SupplierInvitation[]>("/api/suppliers/me/invitations"),
        apiClient.get<RFQ[]>("/api/suppliers/me/rfqs/active"),
        apiClient.get<PurchaseOrder[]>("/api/suppliers/me/purchase-orders"),
        apiClient.get<MessageListResponse>("/api/messages/received")
      ]);
      setProfile(profileRes.data);
      setInvitations(invitationsRes.data);
      setActiveRfqs(rfqsRes.data);
      setPurchaseOrders(ordersRes.data);
      setMessages(messagesRes.data.messages);
    } catch (err) {
      console.error(err);
      setError("Unable to load supplier data. Please refresh the page.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSupplierData();
  }, []);

  useEffect(() => {
    setOpenedInvitationIds((prev) => {
      const respondedIds = invitations.filter((inv) => inv.has_responded).map((inv) => inv.rfq_id);
      const stillRelevant = prev.filter((id) => invitations.some((inv) => inv.rfq_id === id));
      const merged = Array.from(new Set<number>([...respondedIds, ...stillRelevant]));
      return merged;
    });
  }, [invitations]);

  const profileCategories = useMemo(() => {
    if (!profile?.categories) {
      return [];
    }
    return [...profile.categories]
      .sort((a, b) =>
        a.category_type === b.category_type ? 0 : a.category_type === "primary" ? -1 : 1
      )
      .map((category) => category.name);
  }, [profile]);

  const invitationCategories = useMemo(
    () => Array.from(new Set(invitations.map((inv) => inv.category))),
    [invitations]
  );

  const focusCategories = profileCategories.length ? profileCategories : invitationCategories;

  // Use activeRfqs (no annotation needed)
  const annotatedActiveRfqs = activeRfqs;

  const unreadCount = useMemo(
    () => messages.filter((message) => message.status === "sent").length,
    [messages]
  );

  useEffect(() => {
    if (!annotatedActiveRfqs.length) {
      setSelectedRfq(null);
      return;
    }
    setSelectedRfq((prev) => {
      if (prev) {
        const match = annotatedActiveRfqs.find((rfq) => rfq.id === prev.id);
        return match ?? annotatedActiveRfqs[0];
      }
      return annotatedActiveRfqs[0];
    });
  }, [annotatedActiveRfqs]);

  const openQuotationModal = (rfq: RFQ) => {
    // Prevent opening modal if already submitted
    if (rfq.has_responded) {
      setError("You have already submitted a quotation for this RFQ.");
      setTimeout(() => setError(null), 5000);
      return;
    }
    setSelectedRfq(rfq);
    setIsQuoteModalOpen(true);
    setQuoteAmount("");
    setQuoteNotes("");
    setQuoteFile(null);
    setFeedback(null);
    setError(null);
  };

  const submitQuotation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRfq) return;

    // Prevent submission if already responded
    if (selectedRfq.has_responded) {
      setError("You have already submitted a quotation for this RFQ.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      const baseAmount = parseFloat(quoteAmount);
      
      // Calculate tax amount based on tax type
      let taxAmount = 0;
      if (quoteTaxType === "VAT") {
        taxAmount = baseAmount * 0.16; // 16% VAT
      } else if (quoteTaxType === "TOT") {
        taxAmount = baseAmount * 0.05; // 5% TOT
      }
      
      formData.append("amount", quoteAmount);
      formData.append("currency", quoteCurrency);
      if (quoteTaxType !== "None") {
        formData.append("tax_type", quoteTaxType);
        formData.append("tax_amount", taxAmount.toFixed(2));
      }
      if (quoteNotes) formData.append("notes", quoteNotes);
      if (quoteFile) formData.append("attachment", quoteFile);

      await apiClient.post(`/api/rfqs/${selectedRfq.id}/quotations`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setFeedback("Quotation submitted successfully.");
      setIsQuoteModalOpen(false);
      await loadSupplierData();
    } catch (err) {
      console.error(err);
      let message = "Failed to submit quotation. Please verify the inputs and try again.";
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (typeof detail === "string" && detail.trim().length) {
          message = detail;
        }
      } else if (err instanceof Error && err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const markMessageAsRead = async (messageId: number) => {
    try {
      await apiClient.put(`/api/messages/${messageId}/read`);
      const updatedAt = new Date().toISOString();
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId 
            ? { ...msg, status: 'read' as const, read_at: updatedAt }
            : msg
        )
      );
      setSelectedMessage(prev =>
        prev && prev.id === messageId
          ? { ...prev, status: 'read', read_at: updatedAt }
          : prev
      );
    } catch (err) {
      console.error('Failed to mark message as read:', err);
    }
  };

  const handleSelectMessage = (message: Message) => {
    setSelectedMessage(message);
    if (message.status === "sent") {
      markMessageAsRead(message.id);
    }
  };

  const openMessagesModal = () => {
    if (messages.length) {
      const firstUnread = messages.find((msg) => msg.status === "sent");
      const initialMessage = firstUnread ?? messages[0];
      handleSelectMessage(initialMessage);
    } else {
      setSelectedMessage(null);
    }
    setIsMessageModalOpen(true);
  };

  const closeMessagesModal = () => {
    setIsMessageModalOpen(false);
    setSelectedMessage(null);
    setIsReplyMode(false);
    setReplyContent("");
  };

  const handleReplyToMessage = async () => {
    if (!selectedMessage || !replyContent.trim() || !profile) {
      setError("Please enter a reply message.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post("/api/messages/reply", {
        recipient_id: selectedMessage.sender_id,
        supplier_id: profile.id,
        subject: `Re: ${selectedMessage.subject}`,
        content: replyContent,
      });

      setFeedback("Reply sent successfully!");
      setIsReplyMode(false);
      setReplyContent("");
      
      // Reload messages
      const messagesRes = await apiClient.get<MessageListResponse>("/api/messages/received");
      setMessages(messagesRes.data.messages);
    } catch (err) {
      console.error(err);
      setError("Failed to send reply. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const openInvitationDetails = (invitation: SupplierInvitation) => {
    setSelectedInvitation(invitation);
    setOpenedInvitationIds((prev) =>
      prev.includes(invitation.rfq_id) ? prev : [...prev, invitation.rfq_id]
    );
    setIsInvitationDetailsOpen(true);
  };

  const closeInvitationDetails = () => {
    setIsInvitationDetailsOpen(false);
    setSelectedInvitation(null);
  };

  const getDownloadUrl = (filePath: string) => {
    return `${apiClient.defaults.baseURL}${filePath}`;
  };

  const handleDownloadDocument = async (rfqId: number, docId: number, filename: string) => {
    try {
      const response = await apiClient.get(`/api/rfqs/${rfqId}/documents/${docId}/download`, {
        responseType: 'blob',
      });
      
      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      setError('Failed to download document. Please try again.');
    }
  };

  const handleDownloadPurchaseOrder = async (rfqId: number, quotationId: number) => {
    try {
      const response = await apiClient.get(
        `/api/rfqs/${rfqId}/quotations/${quotationId}/purchase-order`,
        { responseType: 'blob' }
      );
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PurchaseOrder_${rfqId}_${quotationId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setFeedback('Purchase Order downloaded successfully!');
    } catch (err) {
      console.error('Failed to download Purchase Order:', err);
      setError('Failed to download Purchase Order. Please try again.');
    }
  };

  // Active section state for sidebar navigation
  const [activeSection, setActiveSection] = useState<'invitations' | 'active-rfqs' | 'orders' | 'messages'>('invitations');

  // Get the currently selected RFQ from active RFQs for detail view
  const activeRfqForSelectedInvitation = useMemo(() => {
    if (!selectedInvitation) return null;
    return activeRfqs.find((rfq) => rfq.id === selectedInvitation.rfq_id) || null;
  }, [selectedInvitation, activeRfqs]);

  const hasRespondedToSelectedInvitation = useMemo(() => {
    if (!selectedInvitation) return false;
    if (selectedInvitation.has_responded) {
      return true;
    }
    return activeRfqForSelectedInvitation?.has_responded ?? false;
  }, [selectedInvitation, activeRfqForSelectedInvitation]);

  return (
    <Layout
      title="Supplier Portal"
      subtitle={`Welcome back, ${profile?.company_name || user?.full_name || 'Supplier'}`}
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

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-slate-400">Open Invitations</p>
              <p className="mt-2 text-3xl font-bold text-primary">{invitations.filter(i => !i.has_responded).length}</p>
            </div>
            <div className="rounded-full bg-blue-100 p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-slate-400">Active RFQs</p>
              <p className="mt-2 text-3xl font-bold text-green-600">{activeRfqs.length}</p>
            </div>
            <div className="rounded-full bg-green-100 p-3">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-slate-400">Purchase Orders</p>
              <p className="mt-2 text-3xl font-bold text-emerald-600">{purchaseOrders.length}</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-3">
              <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-slate-400">Messages</p>
              <p className="mt-2 text-3xl font-bold text-orange-600">{unreadCount}</p>
            </div>
            <button onClick={openMessagesModal} className="rounded-full bg-orange-100 p-3 transition hover:bg-orange-200">
              <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Company Overview */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Company Overview</h2>
        {profile ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div>
              <p className="text-xs uppercase text-slate-400">Company</p>
              <p className="text-sm font-medium text-slate-700">{profile.company_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Email</p>
              <p className="text-sm font-medium text-slate-700">{profile.contact_email}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Phone</p>
              <p className="text-sm font-medium text-slate-700">
                {profile.contact_phone ?? "Not provided"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Invitations received</p>
              <p className="text-sm font-medium text-slate-700">{profile.invitations_sent}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Supplier Number</p>
              <p className="text-sm font-medium text-slate-700">{profile.supplier_number}</p>
            </div>
          </div>
        ) : isLoading ? (
          <p className="mt-4 text-sm text-slate-500">Loading profile...</p>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Profile data unavailable.</p>
        )}

        <div className="mt-6">
          <p className="text-xs uppercase text-slate-400">Focus categories</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {focusCategories.length ? (
              focusCategories.map((category) => (
                <span
                  key={category}
                  className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary"
                >
                  {category}
                </span>
              ))
            ) : (
              <span className="text-slate-500">No categories registered yet.</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            View Full Profile
          </button>
          <button
            onClick={openMessagesModal}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-6 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
          >
            Messages
            {unreadCount ? (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                {unreadCount}
              </span>
            ) : null}
          </button>
        </div>
      </section>

      {/* Main Content with Sidebar */}
      <section className="mt-10 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left Sidebar - Invitations */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-800">RFQ Invitations</h2>
            <p className="text-xs text-slate-500 mt-1">
              {invitations.length} total • {invitations.filter(i => !i.has_responded).length} pending
            </p>
          </div>
          <div className="max-h-[720px] overflow-y-auto p-4 space-y-3">
            {invitations.length > 0 ? (
              invitations.map((invitation) => {
                const isSelected = selectedInvitation?.rfq_id === invitation.rfq_id;
                const statusKey = invitation.status ?? "invited";
                const statusClass = invitationStatusStyles[statusKey] ?? "bg-slate-200 text-slate-600";
                const isNewInvitation =
                  !invitation.has_responded && !openedInvitationIds.includes(invitation.rfq_id);
                const isExpired = new Date(invitation.deadline) <= new Date();
                const canRespond = !invitation.has_responded && 
                                   invitation.rfq_status === "open" && 
                                   !isExpired;

                return (
                  <button
                    key={`${invitation.rfq_id}-${invitation.invited_at}`}
                    onClick={() => openInvitationDetails(invitation)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : isExpired
                        ? "border-slate-200 bg-slate-50"
                        : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-800 text-sm leading-tight">
                        {invitation.rfq_title}
                      </h3>
                      {isNewInvitation && !isExpired && (
                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white shrink-0">
                          New
                        </span>
                      )}
                      {isExpired && (
                        <span className="rounded-full bg-slate-400 px-2 py-0.5 text-xs font-bold text-white shrink-0">
                          Closed
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{invitation.category}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}>
                        {invitationStatusLabels[statusKey] ?? statusKey.replace(/_/g, " ")}
                      </span>
                      <p className={`text-xs ${isExpired ? 'text-rose-500 font-medium' : 'text-slate-400'}`}>
                        {formatDisplay(invitation.deadline, { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                  <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500">No invitations yet</p>
                <p className="mt-1 text-xs text-slate-400">You'll see RFQ invitations here when you receive them</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Active RFQs */}
        <div className="space-y-6">
          {/* Active RFQs Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Active RFQs</h2>
              <span className="text-sm text-slate-500">{activeRfqs.length} open</span>
            </div>
            <RFQTable
              data={activeRfqs}
              onSelect={(rfq) => {
                // Only open modal if supplier hasn't already responded
                if (rfq.has_responded) {
                  return;
                }
                setSelectedRfq(rfq);
                setIsQuoteModalOpen(true);
              }}
            />
          </div>

          {/* Purchase Orders Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Purchase Orders</h2>
              <span className="text-sm text-slate-500">{purchaseOrders.length} orders</span>
            </div>
            <div className="space-y-3">
              {purchaseOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-slate-100 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 text-sm">{order.rfq_title}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {order.rfq_category} • {formatCurrency(order.amount, order.currency)}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Approved: {order.approved_at ? new Date(order.approved_at).toLocaleDateString() : "N/A"}
                      </p>
                      {order.notes && (
                        <p className="mt-2 text-xs text-slate-600 line-clamp-2">{order.notes}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 whitespace-nowrap">
                        Approved
                      </span>
                      <button
                        onClick={() => handleDownloadPurchaseOrder(order.rfq_id, order.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary/90 whitespace-nowrap"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download PO
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!purchaseOrders.length && (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-500">No purchase orders yet.</p>
                  <p className="mt-1 text-xs text-slate-400">Submit quotations for RFQs to receive orders</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      <Modal
        open={isInvitationDetailsOpen && selectedInvitation !== null}
        onClose={closeInvitationDetails}
        title={selectedInvitation ? `RFQ Details: ${selectedInvitation.rfq_title}` : "RFQ Details"}
      >
        {selectedInvitation ? (
          <div className="space-y-4 text-sm text-slate-700">
            {selectedInvitation.rfq_number && (
              <div className="rounded-lg bg-[#107DAC] p-3">
                <p className="text-xs font-semibold uppercase text-white/80">RFQ Number</p>
                <p className="mt-1 font-mono text-sm font-semibold text-white">{selectedInvitation.rfq_number}</p>
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">RFQ Status</p>
                <p className="mt-1 font-medium text-slate-700 capitalize">
                  {selectedInvitation.rfq_status?.replace(/_/g, " ") ?? "Not available"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Invitation Status</p>
                <p className="mt-1 font-medium text-slate-700 capitalize">
                  {invitationStatusLabels[selectedInvitation.status] ??
                    selectedInvitation.status.replace(/_/g, " ")}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Deadline</p>
                <p className="mt-1 text-slate-600">
                  {formatDisplay(selectedInvitation.deadline, { dateStyle: 'full', timeStyle: 'short' })}
                </p>
                {new Date(selectedInvitation.deadline) <= new Date() && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">⚠️ Deadline has passed - This RFQ is closed</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Invited On</p>
                <p className="mt-1 text-slate-600">
                  {new Date(selectedInvitation.invited_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Category</p>
              <p className="mt-1 text-slate-700">{selectedInvitation.category}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Description</p>
              <p className="mt-1 whitespace-pre-line text-slate-700">
                {selectedInvitation.rfq_description && selectedInvitation.rfq_description.trim().length
                  ? selectedInvitation.rfq_description
                  : "No description provided for this RFQ."}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Attachments</p>
              {activeRfqForSelectedInvitation?.documents && activeRfqForSelectedInvitation.documents.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {activeRfqForSelectedInvitation.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-700">{doc.original_filename}</p>
                        <p className="text-xs text-slate-500">
                          Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDownloadDocument(activeRfqForSelectedInvitation.id, doc.id, doc.original_filename)}
                        className="rounded border border-blue-600 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  No attachments uploaded for this RFQ.
                </p>
              )}</div>
            <div className="rounded-lg bg-white p-3 text-xs text-slate-600">
              {hasRespondedToSelectedInvitation ? (
                <span>
                  You submitted a quotation for this RFQ.
                  {(selectedInvitation.quotation_status ??
                    activeRfqForSelectedInvitation?.quotation_status)
                    ? ` Current status: ${(selectedInvitation.quotation_status ??
                        activeRfqForSelectedInvitation?.quotation_status)!.replace(/_/g, " ")}.`
                    : ""}
                </span>
              ) : (
                <span>
                  You have not responded to this invitation yet.
                  {selectedInvitation.rfq_status && selectedInvitation.rfq_status !== "open"
                    ? " This RFQ is no longer accepting responses."
                    : new Date(selectedInvitation.deadline) <= new Date()
                    ? " The deadline for this RFQ has passed."
                    : ""}
                </span>
              )}
            </div>
            {activeRfqForSelectedInvitation && 
             !hasRespondedToSelectedInvitation && 
             selectedInvitation.rfq_status === "open" &&
             new Date(selectedInvitation.deadline) > new Date() ? (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    openQuotationModal(activeRfqForSelectedInvitation);
                    closeInvitationDetails();
                  }}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold uppercase text-white hover:bg-primary/90"
                >
                  Respond Now
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Invitation details are not available.</p>
        )}
      </Modal>

      <Modal
        open={isQuoteModalOpen && selectedRfq !== null}
        onClose={() => setIsQuoteModalOpen(false)}
        title={selectedRfq ? `Submit quotation for ${selectedRfq.title}` : "Submit quotation"}
      >
        {selectedRfq ? (
          <form onSubmit={submitQuotation} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-600">Base Amount ({quoteCurrency})</label>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={quoteAmount}
                onChange={(event) => setQuoteAmount(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">Currency</label>
              <select
                value={quoteCurrency}
                onChange={(event) => setQuoteCurrency(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
              >
                <option value="ZMW">ZMW</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="NGN">NGN</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">Tax Type</label>
              <select
                value={quoteTaxType}
                onChange={(event) => setQuoteTaxType(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
              >
                <option value="None">No Tax</option>
                <option value="VAT">VAT (16%)</option>
                <option value="TOT">TOT (5%)</option>
              </select>
            </div>
            {quoteTaxType !== "None" && quoteAmount && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Base Amount:</span>
                    <span className="font-medium text-slate-800">{formatCurrency(parseFloat(quoteAmount) || 0, quoteCurrency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tax ({quoteTaxType} {quoteTaxType === "VAT" ? "16%" : "5%"}):</span>
                    <span className="font-medium text-slate-800">
                      {formatCurrency((parseFloat(quoteAmount) || 0) * (quoteTaxType === "VAT" ? 0.16 : 0.05), quoteCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-300 pt-2">
                    <span className="font-semibold text-slate-800">Total Amount:</span>
                    <span className="font-bold text-primary">
                      {formatCurrency((parseFloat(quoteAmount) || 0) * (1 + (quoteTaxType === "VAT" ? 0.16 : 0.05)), quoteCurrency)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-slate-600">Notes (optional)</label>
              <textarea
                rows={3}
                value={quoteNotes}
                onChange={(event) => setQuoteNotes(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">Quotation document</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(event) => setQuoteFile(event.target.files?.[0] ?? null)}
                className="mt-2 w-full text-sm"
              />
              <p className="mt-2 text-xs text-slate-500">
                Upload your official quotation document (PDF or DOC).
              </p>
            </div>
            <button
              type="submit"
              disabled={submitting || selectedRfq.has_responded}
              className="w-full rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting Quote..." : selectedRfq.has_responded ? "Quote Already Submitted" : "Submit quotation"}
            </button>
            {selectedRfq.has_responded && (
              <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
                <p className="text-xs text-blue-700">
                  ✓ You have already submitted a quotation for this RFQ.
                  {selectedRfq.quotation_status && ` Status: ${selectedRfq.quotation_status.replace(/_/g, " ")}`}
                </p>
              </div>
            )}
          </form>
        ) : null}
      </Modal>

      {/* Profile Modal */}
      <Modal
        open={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="Complete Profile Information"
      >
        {profile ? (
          <div className="space-y-6">
            {/* Company Information */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Company Details</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium uppercase text-slate-400">Supplier Number</label>
                  <p className="mt-1 text-sm font-medium text-slate-700">{profile.supplier_number}</p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase text-slate-400">Company Name</label>
                  <p className="mt-1 text-sm font-medium text-slate-700">{profile.company_name}</p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase text-slate-400">Contact Email</label>
                  <p className="mt-1 text-sm font-medium text-slate-700">{profile.contact_email}</p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase text-slate-400">Phone Number</label>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {profile.contact_phone || "Not provided"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase text-slate-400">Preferred Currency</label>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {profile.preferred_currency || "Not specified"}
                  </p>
                </div>
              </div>
              {profile.address && (
                <div className="mt-4">
                  <label className="text-xs font-medium uppercase text-slate-400">Address</label>
                  <p className="mt-1 text-sm font-medium text-slate-700">{profile.address}</p>
                </div>
              )}
            </div>

            {/* Business Statistics */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Business Statistics</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 bg-white rounded-lg">
                  <div className="text-2xl font-bold text-primary">{profile.invitations_sent}</div>
                  <div className="text-xs text-slate-600">RFQ Invitations</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{purchaseOrders.length}</div>
                  <div className="text-xs text-slate-600">Purchase Orders</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{activeRfqs.length}</div>
                  <div className="text-xs text-slate-600">Active RFQs</div>
                </div>
              </div>
            </div>

            {/* Categories */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Focus Categories</h3>
              <div className="flex flex-wrap gap-2">
                {focusCategories.length ? (
                  focusCategories.map((category) => (
                    <span
                      key={category}
                      className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                    >
                      {category}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No categories registered yet.</span>
                )}
              </div>
            </div>

            {/* Account Information */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Account Information</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium uppercase text-slate-400">User Account</label>
                  <p className="mt-1 text-sm font-medium text-slate-700">{user?.email}</p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase text-slate-400">Last Invited</label>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {profile.last_invited_at 
                      ? new Date(profile.last_invited_at).toLocaleDateString()
                      : "Never"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">Profile information not available.</div>
        )}
      </Modal>

      {/* Messages Modal */}
      <Modal open={isMessageModalOpen} onClose={closeMessagesModal} title="Messages">
        {messages.length ? (
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-2">
              {messages.map((message) => {
                const isActive = selectedMessage?.id === message.id;
                const isUnread = message.status === "sent";
                return (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() => handleSelectMessage(message)}
                    className={`w-full rounded-lg border px-3 py-3 text-left text-sm transition ${
                      isActive
                        ? "border-blue-500 bg-blue-50 text-blue-900"
                        : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">{message.subject}</span>
                      {isUnread ? (
                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                          New
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(message.created_at).toLocaleString()}
                    </p>
                    <p className="mt-2 text-xs text-slate-600">
                      {message.content.length > 80
                        ? `${message.content.slice(0, 80)}...`
                        : message.content}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              {selectedMessage ? (
                <div className="space-y-4">
                  <div className="space-y-1 border-b border-slate-200 pb-4">
                    <h4 className="text-lg font-semibold text-slate-800">{selectedMessage.subject}</h4>
                    <p className="text-xs text-slate-500">
                      From {selectedMessage.sender_name} ·{" "}
                      {new Date(selectedMessage.created_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">
                      Regarding {selectedMessage.supplier_name}
                    </p>
                    {selectedMessage.read_at ? (
                      <p className="text-xs text-slate-500">
                        Read {new Date(selectedMessage.read_at).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-lg bg-white p-4 text-sm text-slate-700 whitespace-pre-wrap">
                    {selectedMessage.content}
                  </div>
                  
                  {/* Reply Section */}
                  {isReplyMode ? (
                    <div className="space-y-3 border-t border-slate-200 pt-4">
                      <label className="block text-sm font-medium text-slate-700">
                        Your Reply
                      </label>
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Type your reply here..."
                        rows={4}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => {
                            setIsReplyMode(false);
                            setReplyContent("");
                          }}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-sand/30"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleReplyToMessage}
                          disabled={submitting || !replyContent.trim()}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submitting ? "Sending..." : "Send Reply"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-slate-200 pt-4">
                      <button
                        onClick={() => setIsReplyMode(true)}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                      >
                        Reply to this Message
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Select a message to view its details.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">
            You have not received any messages yet.
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default SupplierDashboard;




