export interface RFQDocument {
  id: number;
  file_path: string;
  original_filename: string;
  uploaded_at: string;
}

export interface RFQ {
  id: number;
  rfq_number: string;
  title: string;
  description: string;
  category: string;
  budget?: number; // Optional - not shown to suppliers
  currency: string;
  deadline: string;
  status: string;
  response_locked?: boolean; // True when quotations are hidden until deadline
  created_at?: string;
  updated_at?: string;
  created_by_id?: number;
  created_by_name?: string;
  created_by_role?: string;
  has_responded?: boolean;
  quotation_status?: string | null;
  documents?: RFQDocument[];
  quotations?: Quotation[]; // May be empty if response_locked is true
}

export interface Quotation {
  id: number;
  rfq_id: number;
  supplier_id: number;
  supplier_name?: string | null;
  supplier_number?: string | null;
  amount: number;
  currency: string;
  tax_type?: string | null;
  tax_amount?: number | null;
  status: string;
  notes?: string | null;
  submitted_at: string;
  approved_at?: string | null;
  document_path?: string | null;
  original_filename?: string | null;
  budget_override_justification?: string | null;
  
  // Delivery tracking fields
  delivery_status?: string | null;
  delivered_at?: string | null;
  delivery_note_path?: string | null;
  delivery_note_filename?: string | null;
}

export interface PurchaseOrder extends Quotation {
  rfq_title: string;
  rfq_category: string;
  original_filename?: string | null;
}

export interface RFQWithQuotations extends RFQ {
  quotations: Quotation[];
}

export interface SupplierCategory {
  id: number;
  name: string;
  category_type: "primary" | "secondary";
}

export interface SupplierProfile {
  id: number;
  supplier_number: string;
  company_name: string;
  contact_email: string;
  contact_phone?: string | null;
  address?: string | null;
  preferred_currency?: string | null;
  invitations_sent: number;
  last_invited_at?: string | null;
  categories?: SupplierCategory[];
}

export interface SupplierInvitation {
  rfq_id: number;
  rfq_number?: string;
  rfq_title: string;
  rfq_description?: string | null;
  rfq_status?: string | null;
  category: string;
  deadline: string;
  status: string;
  invited_at: string;
  has_responded: boolean;
  quotation_status?: string | null;
  // documents?: RFQDocument[]; // Temporarily disabled - RFQ documents feature needs to be re-implemented
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  timezone?: string;
  created_at?: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryDetails extends Category {
  total_rfqs: number;
  open_rfqs: number;
  awarded_rfqs: number;
  total_budget: number;
  rfqs: Array<{
    id: number;
    rfq_number: string;
    title: string;
    budget: number;
    currency: string;
    deadline: string;
    status: string;
    created_at: string;
  }>;
}

export interface SupplierWithUser {
  id: number;
  supplier_number: string;
  company_name: string;
  contact_email: string;
  contact_phone?: string | null;
  address?: string | null;
  preferred_currency?: string | null;
  invitations_sent: number;
  total_awarded_value: number;
  created_at: string;
  user_email: string;
  user_active: boolean;
  categories?: SupplierCategory[];
  documents?: SupplierDocument[];
}

export interface SupplierDocument {
  id: number;
  document_type: string;
  original_filename: string;
  file_path: string;
  uploaded_at: string;
}

export interface Message {
  id: number;
  sender_id: number;
  sender_name: string;
  recipient_id: number;
  recipient_name: string;
  supplier_id: number;
  supplier_name: string;
  subject: string;
  content: string;
  status: 'sent' | 'read';
  created_at: string;
  read_at?: string | null;
}

export interface MessageListResponse {
  messages: Message[];
  total_count: number;
  unread_count: number;
}

export interface MessageCreate {
  recipient_id: number;
  supplier_id: number;
  subject: string;
  content: string;
}

export type RequestStatus =
  | "pending_hod"  // Awaiting Head of Department review
  | "rejected_by_hod"
  | "pending_procurement"
  | "rejected_by_procurement"
  | "pending_finance_approval"  // Deprecated
  | "rejected_by_finance"  // Deprecated
  | "finance_approved"  // Deprecated
  | "rfq_issued"
  | "completed"
  // Legacy values retained temporarily until UIs are fully migrated.
  | "pending"
  | "approved"
  | "denied";

export interface Department {
  id: number;
  name: string;
  description?: string | null;
  head_of_department_id?: number | null;
  head_of_department_name?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface RequestDocument {
  id: number;
  original_filename: string;
  file_path: string;
  uploaded_at: string;
}

export interface PurchaseRequest {
  id: number;
  title: string;
  description: string;
  justification: string;
  category: string;
  department_id?: number | null;
  department_name?: string | null;
  needed_by: string;
  status: RequestStatus;
  hod_notes?: string | null;
  hod_rejection_reason?: string | null;
  hod_reviewer_id?: number | null;
  hod_reviewer_name?: string | null;
  hod_reviewed_at?: string | null;
  procurement_notes?: string | null;
  finance_notes?: string | null;  // Deprecated
  requester_id?: number | null;
  requester_name?: string | null;
  procurement_reviewer_id?: number | null;
  procurement_reviewer_name?: string | null;
  procurement_reviewed_at?: string | null;
  finance_reviewer_id?: number | null;  // Deprecated
  finance_reviewer_name?: string | null;  // Deprecated
  finance_reviewed_at?: string | null;  // Deprecated
  proposed_budget_amount?: number | null;
  proposed_budget_currency?: string | null;
  finance_budget_amount?: number | null;  // Deprecated
  finance_budget_currency?: string | null;  // Deprecated
  procurement_rejection_reason?: string | null;
  finance_rejection_reason?: string | null;  // Deprecated
  created_at: string;
  updated_at?: string | null;
  rfq_id?: number | null;
  rfq_title?: string | null;
  rfq_number?: string | null;
  rfq_invited_at?: string | null;
  documents: RequestDocument[];
}

export interface RequestCreatePayload {
  title: string;
  description: string;
  justification: string;
  category: string;
  department_id: number;
  needed_by: string;
}

export interface RequestUpdatePayload {
  title?: string;
  description?: string;
  justification?: string;
  category?: string;
  department_id?: number;
  needed_by?: string;
  procurement_notes?: string | null;
}

export interface RequestProcurementReviewPayload extends RequestUpdatePayload {
  budget_amount: number;
  budget_currency: string;
}

export interface RequestFinanceApprovalPayload {
  budget_amount?: number;
  budget_currency?: string;
  finance_notes?: string | null;
}

export interface RequestDenialPayload {
  reason?: string | null;
}

export interface RequestFinanceRejectionPayload {
  reason?: string | null;
  finance_notes?: string | null;
}
