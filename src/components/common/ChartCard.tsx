import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check, X } from 'lucide-react';
import { DatePicker } from '../ui/calendar';
import type { TimeRangeTab, DateRange } from '../../types/meter.types';

interface ChartCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  activeTab?: TimeRangeTab;
  onTabChange?: (tab: TimeRangeTab) => void;
  showTabs?: boolean;
  customDateRange?: DateRange;
  onCustomDateRangeChange?: (range: DateRange) => void;
  specificDate?: string;
  onSpecificDateChange?: (date: string) => void;
  children: React.ReactNode;
  extraHeaderAction?: React.ReactNode;
}

const TABS: { id: TimeRangeTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'specific', label: 'Specific Date' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'custom', label: 'Custom' },
];

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  description,
  icon,
  activeTab = 'today',
  onTabChange,
  showTabs = false,
  customDateRange = { startDate: '2026-07-01', endDate: '2026-07-20' },
  onCustomDateRangeChange,
  specificDate = new Date().toISOString().split('T')[0],
  onSpecificDateChange,
  children,
  extraHeaderAction,
}) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [startDate, setStartDate] = useState(customDateRange.startDate);
  const [endDate, setEndDate] = useState(customDateRange.endDate);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTabClick = (tabId: TimeRangeTab) => {
    onTabChange?.(tabId);
    if (tabId === 'custom') {
      setIsDatePickerOpen(true);
    } else {
      setIsDatePickerOpen(false);
    }
  };

  const handleApplyCustomRange = () => {
    onCustomDateRangeChange?.({ startDate, endDate });
    setIsDatePickerOpen(false);
  };

  const handlePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    setStartDate(startStr);
    setEndDate(endStr);
    onCustomDateRangeChange?.({ startDate: startStr, endDate: endStr });
    setIsDatePickerOpen(false);
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="group flex flex-col p-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.07)] hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 relative overflow-hidden">
      {/* Card Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 text-blue-600 dark:text-blue-400 border border-slate-200/50 dark:border-slate-700/60 shadow-sm transition-transform duration-200 group-hover:scale-105">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h3>
            {description && (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Tab Controls & Date Range Selector */}
        <div className="flex items-center gap-2 relative">
          {showTabs && onTabChange && (
            <div className="flex items-center p-1 bg-slate-100/90 dark:bg-slate-800/70 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-inner">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all capitalize cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/60 dark:border-slate-700'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Active Specific Date Selector Trigger */}
          {activeTab === 'specific' && (
            <DatePicker
              value={specificDate}
              onChange={(d) => onSpecificDateChange?.(d)}
              className="w-44"
            />
          )}

          {/* Active Custom Date Range Badge Trigger */}
          {activeTab === 'custom' && (
            <button
              onClick={() => setIsDatePickerOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-100/80 dark:hover:bg-blue-900/50 transition-all shadow-xs"
              title="Click to change custom date range"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {formatDateLabel(startDate)} - {formatDateLabel(endDate)}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDatePickerOpen ? 'rotate-180' : ''}`} />
            </button>
          )}

          {extraHeaderAction}

          {/* Custom Date Range Picker Popover Calendar Card */}
          {isDatePickerOpen && activeTab === 'custom' && (
            <div
              ref={popoverRef}
              className="absolute right-0 top-full mt-2 w-80 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Select Date Range
                  </span>
                </div>
                <button
                  onClick={() => setIsDatePickerOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePreset(7)}
                  className="flex-1 py-1 px-2 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => handlePreset(14)}
                  className="flex-1 py-1 px-2 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Last 14 Days
                </button>
                <button
                  onClick={() => handlePreset(30)}
                  className="flex-1 py-1 px-2 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Last 30 Days
                </button>
              </div>

              {/* Date Inputs */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    START DATE
                  </label>
                  <DatePicker
                    value={startDate}
                    onChange={setStartDate}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    END DATE
                  </label>
                  <DatePicker
                    value={endDate}
                    onChange={setEndDate}
                  />
                </div>
              </div>

              {/* Apply Button */}
              <button
                onClick={handleApplyCustomRange}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Apply Date Range
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chart Content Area */}
      <div className="flex-1 w-full min-h-[300px] flex flex-col">
        {children}
      </div>
    </div>
  );
};
