import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiClient } from "../utils/client";
import { SupplierWithUser } from "../utils/types";
import Layout from "../components/Layout";

const SupplierDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<SupplierWithUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const { data } = await apiClient.get<SupplierWithUser>(`/api/admin/suppliers/${id}`);
        setSupplier(data);
        setError(null);
      } catch (err: any) {
        console.error("Failed to load supplier:", err);
        const errorMsg = err.response?.data?.detail || "Failed to load supplier information.";
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };
    fetchSupplier();
  }, [id]);

  if (loading) {
    return (
      <Layout title="Supplier Details">
        <div className="flex items-center justify-center py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Supplier Details">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Go Back
          </button>
        </div>
      </Layout>
    );
  }

  if (!supplier) {
    return (
      <Layout title="Supplier Details">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-slate-600">No supplier found.</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Go Back
          </button>
        </div>
      </Layout>
    );
  }

const actions = (
  <button
    onClick={() => navigate(-1)}
    className="rounded-lg border border-white/50 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
  >
    ← Back
  </button>
);

  return (
    <Layout title={`Supplier: ${supplier.company_name}`} subtitle={`Supplier Number: ${supplier.supplier_number}`} actions={actions}>
      <div className="space-y-6">
        {/* Company Information */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Company Information</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-slate-400">Supplier Number</p>
              <p className="font-medium text-slate-700">{supplier.supplier_number}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Company Name</p>
              <p className="font-medium text-slate-700">{supplier.company_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Contact Email</p>
              <p className="font-medium text-slate-700">{supplier.contact_email}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Phone</p>
              <p className="font-medium text-slate-700">{supplier.contact_phone || "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Preferred Currency</p>
              <p className="font-medium text-slate-700">{supplier.preferred_currency || "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Status</p>
              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                supplier.user_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}>
                {supplier.user_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Total Awarded Value</p>
              <p className="font-medium text-slate-700">${supplier.total_awarded_value.toFixed(2)}</p>
            </div>
          </div>
          {supplier.address && (
            <div className="mt-4">
              <p className="text-xs uppercase text-slate-400">Address</p>
              <p className="font-medium text-slate-700">{supplier.address}</p>
            </div>
          )}
          {supplier.categories && supplier.categories.length ? (
            <div className="mt-4">
              <p className="text-xs uppercase text-slate-400">Categories</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {supplier.categories.map((category) => (
                  <span
                    key={`${category.id}-${category.category_type}`}
                    className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                  >
                    {category.category_type === "primary" ? "Primary" : "Secondary"} · {category.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Account Information */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Account Information</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-slate-400">User Email</p>
              <p className="font-medium text-slate-700">{supplier.user_email}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Invitations Sent</p>
              <p className="font-medium text-slate-700">{supplier.invitations_sent}</p>
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Documents</h2>
          {supplier.documents && supplier.documents.length > 0 ? (
            <div className="space-y-3">
              {supplier.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-slate-700">{doc.original_filename}</p>
                      <p className="text-xs text-slate-500">
                        {doc.document_type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} • 
                        Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`/api/admin/suppliers/${supplier.id}/documents/${doc.id}`}
                    download
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No documents uploaded yet.</p>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SupplierDetailPage;
