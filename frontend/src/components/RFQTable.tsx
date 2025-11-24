import { format } from "date-fns";
import clsx from "clsx";
import { RFQ } from "../utils/types";

interface RFQTableProps {
  data: RFQ[];
  onSelect?: (rfq: RFQ) => void;
  onDoubleClick?: (rfq: RFQ) => void;
}

const statusStyles: Record<string, string> = {
  open: "bg-secondary/20 text-secondary-dark",
  closed: "bg-sand-dark text-primary/70",
  awarded: "bg-primary/10 text-primary",
  draft: "bg-secondary/10 text-secondary"
};

const RFQTable: React.FC<RFQTableProps> = ({ data, onSelect, onDoubleClick }) => {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-dashed border-primary/15 bg-sand p-10 text-center text-sm text-primary/70">
        No RFQs available yet.
      </div>
    );
  }

  // Check if budget should be displayed (only if at least one RFQ has budget data)
  const showBudget = data.some(rfq => rfq.budget !== undefined);

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/15 bg-sand shadow-sm shadow-primary/10">
      <table className="min-w-full divide-y divide-primary/10 text-left text-sm text-primary">
        <thead className="bg-sand-dark">
          <tr className="text-xs uppercase tracking-wide text-primary/60">
            <th className="px-6 py-3 font-medium">RFQ #</th>
            <th className="px-6 py-3 font-medium">Title</th>
            <th className="px-6 py-3 font-medium">Category</th>
            {showBudget && <th className="px-6 py-3 font-medium">Budget</th>}
            <th className="px-6 py-3 font-medium">Deadline</th>
            <th className="px-6 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-primary/10 bg-sand">
          {data.map((rfq) => {
            const isSubmitted = Boolean(rfq.has_responded);
            return (
              <tr
                key={rfq.id}
                className={clsx(
                  "transition",
                  isSubmitted ? "bg-sand-dark" : "hover:bg-secondary/10",
                  {
                    "opacity-60": isSubmitted,
                    "cursor-pointer": Boolean(onSelect || onDoubleClick) && !isSubmitted,
                  }
                )}
                onClick={() => {
                  if (isSubmitted) return;
                  if (onSelect) onSelect(rfq);
                }}
                onDoubleClick={() => {
                  if (isSubmitted) return;
                  if (onDoubleClick) onDoubleClick(rfq);
                }}
              >
              <td className="px-6 py-4 font-mono text-xs text-primary/60">{rfq.rfq_number}</td>
              <td className="px-6 py-4">
                <p className="font-medium text-primary">{rfq.title}</p>
                <p className="text-xs text-primary/60">{rfq.description.slice(0, 80)}...</p>
                {isSubmitted ? (
                  <p className="mt-1 text-xs font-semibold text-secondary">
                    Submitted already
                    {rfq.quotation_status && rfq.quotation_status !== "submitted"
                      ? ` • ${rfq.quotation_status.replace(/_/g, " ")}`
                      : ""}
                  </p>
                ) : null}
              </td>
              <td className="px-6 py-4 text-primary/80">{rfq.category}</td>
              {showBudget && (
                <td className="px-6 py-4 font-medium text-primary">
                  {rfq.budget !== undefined ? new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: rfq.currency ?? "USD"
                  }).format(Number(rfq.budget)) : 'N/A'}
                </td>
              )}
              <td className="px-6 py-4 text-primary/70">{format(new Date(rfq.deadline), "PPpp")}</td>
              <td className="px-6 py-4">
                <span
                  className={clsx(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    statusStyles[rfq.status] ?? "bg-primary/10 text-primary"
                  )}
                >
                  {rfq.status}
                </span>
              </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RFQTable;
