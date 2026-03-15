'use client';

const variants = {
  default: {
    bg: 'bg-gradient-to-b from-white/90 to-white/70',
    border: 'border-gray-200/80',
    hoverShadow: 'hover:shadow-[0_12px_40px_rgba(16,185,129,0.12),0_4px_12px_rgba(0,0,0,0.04)]',
    hoverBorder: 'hover:border-emerald-200/60',
    labelColor: 'text-gray-500',
    shimmer: true,
    valueClass: 'gradient-text',
  },
  positive: {
    bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/60',
    border: 'border-emerald-200/60',
    hoverShadow: 'hover:shadow-[0_12px_40px_rgba(16,185,129,0.15),0_4px_12px_rgba(0,0,0,0.04)]',
    hoverBorder: 'hover:border-emerald-300/60',
    labelColor: 'text-emerald-700/60',
    shimmer: false,
    valueClass: 'text-emerald-700',
  },
  negative: {
    bg: 'bg-gradient-to-br from-red-50 to-red-100/60',
    border: 'border-red-200/60',
    hoverShadow: 'hover:shadow-[0_12px_40px_rgba(239,68,68,0.12),0_4px_12px_rgba(0,0,0,0.04)]',
    hoverBorder: 'hover:border-red-300/60',
    labelColor: 'text-red-700/60',
    shimmer: false,
    valueClass: 'text-red-600',
  },
};

export default function StatCard({ label, value, sub, variant = 'default' }) {
  const v = variants[variant] || variants.default;

  return (
    <div className={`relative ${v.bg} backdrop-blur-xl rounded-2xl border ${v.border} p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] hover:-translate-y-1 ${v.hoverShadow} ${v.hoverBorder} transition-all duration-300 overflow-hidden`}>
      {v.shimmer && <div className="absolute top-0 left-0 right-0 h-[3px] stat-border-shimmer" />}
      <div className="text-2xl font-extrabold leading-tight">
        {value === null || value === undefined ? (
          <div className="h-7 w-20 rounded-lg skeleton" />
        ) : (
          <span className={v.valueClass}>{value}</span>
        )}
      </div>
      <div className={`text-sm font-medium mt-2 ${v.labelColor}`}>{label}</div>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
