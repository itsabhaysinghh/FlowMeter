import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import type { FlowHistoryRecord } from '../../types/meter.types';
import { StatusBadge } from '../common/StatusBadge';
import { formatVolume, formatFlowRate } from '../../utils/formatters';
import { InputGroup, InputGroupInput, InputGroupAddon } from '../ui/input-group';

interface FlowHistoryTableProps {
  data?: FlowHistoryRecord[] | null;
}

type SortField = 'time' | 'duration' | 'flowRate' | 'totalLitres' | 'status';
type SortOrder = 'asc' | 'desc';

export const FlowHistoryTable: React.FC<FlowHistoryTableProps> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.filter((item) => {
      const matchSearch =
        (item.time?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.duration?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.status?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(item.flowRate).includes(searchTerm) ||
        String(item.totalLitres).includes(searchTerm);
      return matchSearch;
    });
  }, [data, searchTerm]);

  const parseDate = (timeStr: string | null | undefined): number => {
    if (!timeStr) return 0;

    // Prioritize DD/MM/YYYY hh:mm:ss format (with optional AM/PM)
    const match = timeStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})[,\s]+(\d{1,2}):(\d{2}):(\d{2})(?:\s*(AM|PM))?/i);
    if (match) {
      const [_, day, month, year, hourStr, minute, second, ampm] = match;
      let hour = Number(hourStr);
      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
        if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      }
      return new Date(Number(year), Number(month) - 1, Number(day), hour, Number(minute), Number(second)).getTime();
    }

    const parsed = Date.parse(timeStr);
    if (!isNaN(parsed)) return parsed;
    return 0;
  };

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      if (sortField === 'time') {
        const timeA = parseDate(a.time);
        const timeB = parseDate(b.time);
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
      
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string);
      }
      return sortOrder === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [filteredData, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex flex-col p-6 bg-white border border-slate-200 rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]">
      {/* Table Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-flostat-border dark:border-dark-border">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Flow Telemetry Log History
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Timestamped flow rate logs, interval totals, and operational flags
          </p>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-2">
          <InputGroup className="w-full sm:w-64">
            <InputGroupAddon>
              <Search className="w-4 h-4 text-slate-400" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {filteredData.length > 0 && (
              <InputGroupAddon align="inline-end" className="text-[10px] font-bold text-slate-500">
                {filteredData.length} logs
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold bg-slate-50/60 dark:bg-slate-800/40 rounded-lg">
              <th
                onClick={() => handleSort('time')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  TIME
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('duration')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  DURATION
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('flowRate')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  FLOW RATE
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('totalLitres')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  TOTAL LITRES
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('status')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  STATUS
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {(!data || paginatedData.length === 0) ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                    <span className="font-semibold text-slate-600 dark:text-slate-400 text-sm">
                      No data received from device.
                    </span>
                    <span className="text-xs text-slate-400">
                      Telemetry log stream will populate once meter is active.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                    {row.time}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                    {row.duration}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                    {formatFlowRate(row.flowRate)}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                    {formatVolume(row.totalLitres)}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={row.status} type="flow" size="sm" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {data && data.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{paginatedData.length}</span> of{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredData.length}</span> logs
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
