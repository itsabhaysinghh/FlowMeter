import React from 'react';

export const CardSkeleton: React.FC = () => {
  return (
    <div className="p-5 bg-white dark:bg-dark-card border border-flostat-border dark:border-dark-border rounded-2xl shadow-flostat flex flex-col justify-between h-36">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl skeleton-shimmer" />
          <div className="w-24 h-4 rounded skeleton-shimmer" />
        </div>
        <div className="w-12 h-4 rounded-full skeleton-shimmer" />
      </div>
      <div className="flex items-baseline gap-2 mt-4">
        <div className="w-32 h-8 rounded skeleton-shimmer" />
        <div className="w-10 h-4 rounded skeleton-shimmer" />
      </div>
      <div className="w-40 h-3 rounded skeleton-shimmer mt-3 pt-3 border-t border-slate-100 dark:border-slate-800" />
    </div>
  );
};

export const ChartSkeleton: React.FC<{ height?: string }> = ({ height = 'h-[320px]' }) => {
  return (
    <div className={`p-6 bg-white dark:bg-dark-card border border-flostat-border dark:border-dark-border rounded-2xl shadow-flostat flex flex-col ${height}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="w-40 h-5 rounded skeleton-shimmer mb-2" />
          <div className="w-56 h-3 rounded skeleton-shimmer" />
        </div>
        <div className="w-48 h-8 rounded-xl skeleton-shimmer" />
      </div>
      <div className="flex-1 w-full rounded-xl skeleton-shimmer opacity-80" />
    </div>
  );
};

export const TableSkeleton: React.FC = () => {
  return (
    <div className="p-6 bg-white dark:bg-dark-card border border-flostat-border dark:border-dark-border rounded-2xl shadow-flostat flex flex-col gap-4">
      <div className="flex items-center justify-between pb-4 border-b border-flostat-border dark:border-dark-border">
        <div className="w-36 h-5 rounded skeleton-shimmer" />
        <div className="flex gap-2">
          <div className="w-48 h-9 rounded-xl skeleton-shimmer" />
          <div className="w-24 h-9 rounded-xl skeleton-shimmer" />
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <div className="w-24 h-4 rounded skeleton-shimmer" />
            <div className="w-20 h-4 rounded skeleton-shimmer" />
            <div className="w-28 h-4 rounded skeleton-shimmer" />
            <div className="w-24 h-4 rounded skeleton-shimmer" />
            <div className="w-16 h-5 rounded-full skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const FullDashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="w-full h-24 rounded-2xl skeleton-shimmer" />
      
      {/* Top Row KPI Skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Second Row Chart Skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Third Row Table Skeleton */}
      <TableSkeleton />
    </div>
  );
};
