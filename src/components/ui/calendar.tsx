import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

export interface CalendarProps {
  mode?: 'single' | 'range';
  selected?: Date | string | { from?: Date | string; to?: Date | string };
  onSelect?: (date: any) => void;
  className?: string;
  captionLayout?: 'dropdown' | 'buttons' | 'dropdown-buttons';
  minDate?: Date;
  maxDate?: Date;
  initialFocusMonth?: Date;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function Calendar({
  mode = 'single',
  selected,
  onSelect,
  className = '',
  captionLayout = 'dropdown',
  minDate,
  maxDate,
  initialFocusMonth,
}: CalendarProps) {
  // Helper to parse date
  const parseToDate = (val?: Date | string): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === 'string') {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
      if (match) {
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      }
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const selectedDate = useMemo(() => {
    if (mode === 'single' && (selected instanceof Date || typeof selected === 'string')) {
      return parseToDate(selected);
    }
    return null;
  }, [selected, mode]);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (selectedDate) return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    if (initialFocusMonth) return new Date(initialFocusMonth.getFullYear(), initialFocusMonth.getMonth(), 1);
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Sync calendar view month when selectedDate changes externally
  useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [selectedDate]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Generate Year options (current year - 10 to current year + 5)
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const list: number[] = [];
    const startYear = Math.min(currentYear - 10, year);
    const endYear = Math.max(currentYear + 5, year);
    for (let y = startYear; y <= endYear; y++) {
      list.push(y);
    }
    return list;
  }, [currentYear, year]);

  const handlePrevMonth = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value, 10);
    setCurrentMonth(new Date(year, newMonth, 1));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value, 10);
    setCurrentMonth(new Date(newYear, month, 1));
  };

  // Calendar matrix calculation (42 cells: 6 rows of 7 days)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDayOfMonth.getDay();
    const totalDays = lastDayOfMonth.getDate();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let day = 1; day <= totalDays; day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true,
      });
    }

    // Next month padding days to fill 6 rows (42 cells)
    const remainingCells = 42 - days.length;
    for (let day = 1; day <= remainingCells; day++) {
      days.push({
        date: new Date(year, month + 1, day),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  const isSameDay = (d1: Date | null, d2: Date | null) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const isToday = (d: Date) => isSameDay(d, new Date());

  const isDateDisabled = (d: Date) => {
    if (minDate && d < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate && d > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
    return false;
  };

  const handleDateClick = (dayObj: { date: Date; isCurrentMonth: boolean }, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (isDateDisabled(dayObj.date)) return;
    if (!dayObj.isCurrentMonth) {
      setCurrentMonth(new Date(dayObj.date.getFullYear(), dayObj.date.getMonth(), 1));
    }
    if (onSelect) {
      onSelect(dayObj.date);
    }
  };

  return (
    <div
      className={`p-3.5 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700/90 rounded-2xl shadow-2xl select-none w-[284px] ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Calendar Caption Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
        {captionLayout === 'dropdown' || captionLayout === 'dropdown-buttons' ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {/* Month dropdown */}
            <select
              aria-label="Select month"
              value={month}
              onChange={handleMonthChange}
              className="text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00B4D8] focus:border-[#00B4D8] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/80 transition truncate"
            >
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                  {m}
                </option>
              ))}
            </select>

            {/* Year dropdown */}
            <select
              aria-label="Select year"
              value={year}
              onChange={handleYearChange}
              className="text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00B4D8] focus:border-[#00B4D8] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/80 transition shrink-0"
            >
              {years.map((y) => (
                <option key={y} value={y} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                  {y}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex-1 pl-1">
            {MONTHS[month]} {year}
          </div>
        )}

        {/* Month Navigation Buttons aligned on right */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 transition"
            title="Previous month"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 transition"
            title="Next month"
            aria-label="Next month"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WEEKDAYS.map((wd) => (
          <span key={wd} className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-0.5">
            {wd}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {calendarDays.map((dayObj, index) => {
          const isSelected = isSameDay(dayObj.date, selectedDate);
          const isCurrentToday = isToday(dayObj.date);
          const disabled = isDateDisabled(dayObj.date);

          let cellClass = "w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all cursor-pointer ";

          if (disabled) {
            cellClass += "text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40 ";
          } else if (isSelected) {
            cellClass += "bg-[#00B4D8] text-white font-bold shadow-sm shadow-[#00B4D8]/30 ";
          } else if (isCurrentToday) {
            cellClass += "bg-[#00B4D8]/10 text-[#00B4D8] font-bold border border-[#00B4D8]/40 ";
          } else if (dayObj.isCurrentMonth) {
            cellClass += "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 ";
          } else {
            cellClass += "text-slate-400 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 ";
          }

          return (
            <button
              key={index}
              type="button"
              disabled={disabled}
              onClick={(e) => handleDateClick(dayObj, e)}
              className={cellClass}
            >
              {dayObj.date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Footer Quick Action */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const today = new Date();
            setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
            if (onSelect) onSelect(today);
          }}
          className="text-[#00B4D8] font-bold hover:underline py-0.5 px-1 rounded hover:bg-[#00B4D8]/10 transition"
        >
          Today
        </button>
        {selectedDate && (
          <span className="text-slate-400 dark:text-slate-500 font-medium text-[10px]">
            {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  );
}

export interface DatePickerProps {
  id?: string;
  value?: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  label?: string;
  className?: string;
  placeholder?: string;
}

export function DatePicker({ id, value, onChange, label, className = '', placeholder = 'Select date' }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const [align, setAlign] = useState<'left' | 'right'>('left');
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedDate = useMemo(() => {
    if (!value) return undefined;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }, [value]);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const calendarHeight = 330;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Check if opening downward would be cut off by viewport bottom, and if more space is above
    if (spaceBelow < calendarHeight && spaceAbove > spaceBelow) {
      setPlacement('top');
    } else {
      setPlacement('bottom');
    }

    // Check horizontal viewport and parent container boundaries
    const calendarWidth = 284;
    const containerRight = containerRef.current?.parentElement?.getBoundingClientRect()?.right ?? window.innerWidth;
    const spaceRight = Math.min(window.innerWidth - rect.left, containerRight - rect.left);

    if (spaceRight < calendarWidth - 10 && rect.right >= calendarWidth) {
      setAlign('right');
    } else {
      setAlign('left');
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
    }
  }, [isOpen, updatePosition]);

  const handleSelect = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const formattedDisplay = useMemo(() => {
    if (!selectedDate || isNaN(selectedDate.getTime())) return placeholder;
    return selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [selectedDate, placeholder]);

  return (
    <div className={`relative inline-block w-full ${className}`} ref={containerRef}>
      {label && (
        <label htmlFor={id} className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          {label}
        </label>
      )}
      <button
        ref={buttonRef}
        id={id}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-800 dark:text-white shadow-sm hover:border-[#00B4D8] focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 transition cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-[#00B4D8] shrink-0" />
          <span>{formattedDisplay}</span>
        </div>
      </button>

      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} ${
            placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } z-50 animate-in fade-in zoom-in-95 duration-150`}
        >
          <Calendar
            captionLayout="dropdown"
            selected={selectedDate}
            onSelect={handleSelect}
          />
        </div>
      )}
    </div>
  );
}

