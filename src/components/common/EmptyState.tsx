import React from 'react';
import { Radio, RefreshCw, AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Waiting for meter data...',
  description = 'No telemetry payload has been received from this device. Once the AWS IoT Core endpoint streams data to DynamoDB, real-time metrics will render here automatically.',
  onRetry,
  isRetrying = false,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-dark-card border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl shadow-flostat my-6 min-h-[380px]">
      {/* Enterprise SVG Vector Illustration */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800 flex items-center justify-center text-flostat-primary dark:text-blue-400">
          <Radio className="w-10 h-10 animate-pulse" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-700 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm">
          <AlertCircle className="w-4 h-4" />
        </div>
      </div>

      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="max-w-md text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
        {description}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-flostat-primary hover:bg-flostat-primary-hover text-white font-semibold text-sm transition-all shadow-md active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
          {isRetrying ? 'Checking Connection...' : 'Poll Stream Status'}
        </button>
      )}

      <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 font-mono">
        API Status: <span className="text-amber-600 dark:text-amber-400 font-semibold">Endpoint Idle (Pending DynamoDB Payload)</span>
      </div>
    </div>
  );
};
