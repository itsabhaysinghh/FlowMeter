import React, { useState, useMemo } from 'react';
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

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Generate Year options (current year - 10 to current year + 5)
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const list = [];
    for (let y = currentYear - 10; y <= currentYear + 5; y++) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
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

  // Calendar matrix calculation
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

  const handleDateClick = (dayObj: { date: Date; isCurrentMonth: boolean }) => {
    if (isDateDisabled(dayObj.date)) return;
    if (!dayObj.isCurrentMonth) {
      setCurrentMonth(new Date(dayObj.date.getFullYear(), dayObj.date.getMonth(), 1));
    }
    if (onSelect) {
      onSelect(dayObj.date);
    }
  };

  return (
    <div className={`p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg select-none max-w-[300px] ${className}`}>
      {/* Calendar Caption Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {captionLayout === 'dropdown' || captionLayout === 'dropdown-buttons' ? (
          <div className="flex items-center gap-1.5 flex-1">
            <select
              aria-label="Select month"
              value={month}
              onChange={handleMonthChange}
              className="text-xs font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 focus:outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                  {m}
                </option>
              ))}
            </select>

            <select
              aria-label="Select year"
              value={year}
              onChange={handleYearChange}
              className="text-xs font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 focus:outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition"
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

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WEEKDAYS.map((wd) => (
          <span key={wd} className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-1">
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

          let cellClass = "w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all cursor-pointer ";

          if (disabled) {
            cellClass += "text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-50 ";
          } else if (isSelected) {
            cellClass += "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20 scale-105 ";
          } else if (isCurrentToday) {
            cellClass += "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-extrabold border border-blue-400 dark:border-blue-700 ";
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
              onClick={() => handleDateClick(dayObj)}
              className={cellClass}
            >
              {dayObj.date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Footer Quick Action */}
      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
        <button
          type="button"
          onClick={() => {
            const today = new Date();
            setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
            if (onSelect) onSelect(today);
          }}
          className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
        >
          Today
        </button>
        {selectedDate && (
          <span className="text-slate-400 font-medium">
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
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const selectedDate = useMemo(() => {
    if (!value) return undefined;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    return new Date(value);
  }, [value]);

  const handleSelect = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
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
    <div className={`relative inline-block w-full ${className}`} ref={popoverRef}>
      {label && (
        <label htmlFor={id} className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-800 dark:text-white shadow-sm hover:border-blue-400 focus:outline-none transition"
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-blue-500" />
          <span>{formattedDisplay}</span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 z-50 animate-in fade-in zoom-in-95 duration-150">
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
