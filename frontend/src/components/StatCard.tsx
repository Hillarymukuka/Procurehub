interface StatCardProps {
  label: string;
  value: number | string;
  helperText?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, helperText }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-800">{value}</p>
      {helperText ? <p className="mt-2 text-sm text-slate-600">{helperText}</p> : null}
    </div>
  );
};

export default StatCard;
