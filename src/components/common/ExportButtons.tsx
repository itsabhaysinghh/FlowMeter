import React, { useState } from 'react';
import { FileText, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { triggerCSVExport, triggerPDFExport, type ExportStatus } from '../../utils/exportHelpers';

interface ExportButtonsProps {
  variant?: 'compact' | 'full';
  selectedMeterId?: string;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({ variant = 'compact' }) => {
  const [status, setStatus] = useState<ExportStatus>({
    isExporting: false,
    type: null,
    message: null,
  });

  const handleCSV = () => {
    triggerCSVExport(setStatus);
  };

  const handlePDF = () => {
    triggerPDFExport(setStatus);
  };

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleCSV}
          disabled={status.isExporting}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-flostat-border dark:border-dark-border bg-white dark:bg-dark-card hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
          title="Export telemetry log as CSV"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          CSV
        </button>

        <button
          onClick={handlePDF}
          disabled={status.isExporting}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-flostat-primary hover:bg-flostat-primary-hover text-white text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
          title="Export report as PDF"
        >
          <FileText className="w-3.5 h-3.5" />
          PDF
        </button>

        {status.message && (
          <div className="text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
            {status.message.includes('pending') ? (
              <AlertCircle className="w-3 h-3 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            )}
            <span className="truncate max-w-[140px]">{status.message}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-white dark:bg-dark-card border border-flostat-border dark:border-dark-border rounded-2xl shadow-flostat">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-flostat-primary dark:text-blue-400">
          <Download className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Export Meter Reports
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Download raw flow logs or formatted telemetry executive summary
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleCSV}
          disabled={status.isExporting}
          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-flostat-border dark:border-dark-border bg-white dark:bg-dark-card hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          Export CSV
        </button>

        <button
          onClick={handlePDF}
          disabled={status.isExporting}
          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-flostat-primary hover:bg-flostat-primary-hover text-white text-xs font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50"
        >
          <FileText className="w-3.5 h-3.5" />
          Export PDF
        </button>
      </div>

      {status.message && (
        <div className="w-full sm:w-auto text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5">
          {status.message.includes('pending') ? (
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          )}
          {status.message}
        </div>
      )}
    </div>
  );
};
