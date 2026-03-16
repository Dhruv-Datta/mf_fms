'use client';

import { DollarSign } from 'lucide-react';

export default function FinancialsPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-12 pb-16">
      <div className="py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-5">
          <DollarSign size={28} className="text-amber-500" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Financials</h1>
        <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
          Fund-level financials, fee tracking, NAV calculations, and performance reporting will live here.
        </p>
        <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl text-sm text-gray-500 font-medium">
          Coming soon
        </div>
      </div>
    </div>
  );
}
