import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, LoaderCircle, Trash2, X } from 'lucide-react';
import { DatePicker } from '../ui/calendar';
import type {
  DeleteDataMode,
  DeleteFlowMeterDataResult,
  DeviceOption,
} from '../../types/meter.types';
import { meterService } from '../../services/meter.service';
import {
  createIstDeletionRequest,
  formatIstDateInput,
  formatIstTimeInput,
  getIstDateInputValue,
} from '../../utils/ist';

interface DeleteDataDialogProps {
  isOpen: boolean;
  devices: DeviceOption[];
  initialDeviceId?: string;
  onClose: () => void;
  onDeleted: (result: DeleteFlowMeterDataResult, deviceId: string) => void;
}

type DialogStep = 'form' | 'confirm';

const modeLabels: Record<DeleteDataMode, string> = {
  day: 'Specific day',
  'date-range': 'Custom date range',
  'time-range': 'Specific time range',
  all: 'Delete full records',
};

export function DeleteDataDialog({
  isOpen,
  devices,
  initialDeviceId,
  onClose,
  onDeleted,
}: DeleteDataDialogProps) {
  const today = getIstDateInputValue();
  const [deviceId, setDeviceId] = useState('');
  const [mode, setMode] = useState<DeleteDataMode>('day');
  const [date, setDate] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [fromTime, setFromTime] = useState('00:00');
  const [toTime, setToTime] = useState('23:59');
  const [step, setStep] = useState<DialogStep>('form');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const currentDate = getIstDateInputValue();
    const defaultDevice = devices.find((device) => device.id !== 'FLOSTAT_001')?.id || devices[0]?.id || '';
    const initial = initialDeviceId && initialDeviceId !== 'FLOSTAT_001' && devices.some((device) => device.id === initialDeviceId)
      ? initialDeviceId
      : defaultDevice;

    setDeviceId(initial);
    setMode('day');
    setDate(currentDate);
    setStartDate(currentDate);
    setEndDate(currentDate);
    setFromTime('00:00');
    setToTime('23:59');
    setStep('form');
    setError(null);
    setIsDeleting(false);
  }, [devices, initialDeviceId, isOpen]);

  const request = useMemo(
    () => createIstDeletionRequest(deviceId, { mode, date, startDate, endDate, fromTime, toTime }),
    [date, deviceId, endDate, fromTime, mode, startDate, toTime],
  );

  const deletionSummary = useMemo(() => {
    if (mode === 'all') {
      return 'All historical records (full data)';
    }
    if (mode === 'date-range') {
      return `${formatIstDateInput(startDate)} – ${formatIstDateInput(endDate)}`;
    }
    if (mode === 'time-range') {
      return `${formatIstDateInput(date)}, ${formatIstTimeInput(fromTime)} – ${formatIstTimeInput(toTime)} IST`;
    }
    return `${formatIstDateInput(date)} (all day, IST)`;
  }, [date, endDate, fromTime, mode, startDate, toTime]);

  if (!isOpen) return null;

  const close = () => {
    if (!isDeleting) onClose();
  };

  const handleContinue = () => {
    if (!deviceId) {
      setError('Select a meter device before continuing.');
      return;
    }
    if (deviceId === 'FLOSTAT_001') {
      setError('FLOSTAT_001 is a protected system device. Data for this meter cannot be deleted.');
      return;
    }
    if (!request) {
      setError('Enter a valid range where the start is before or equal to the end.');
      return;
    }
    setError(null);
    setStep('confirm');
  };

  const handleDelete = async () => {
    if (!request || isDeleting) return;

    if (request.device_id === 'FLOSTAT_001') {
      setError('FLOSTAT_001 is a protected system device. Data for this meter cannot be deleted.');
      return;
    }

    setError(null);
    setIsDeleting(true);
    try {
      const result = await meterService.deleteFlowMeterData(request);
      onDeleted(result, request.device_id);
      onClose();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete data. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-data-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-dark-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="delete-data-title" className="text-sm font-bold text-slate-900 dark:text-white">
                {step === 'confirm' ? 'Delete Flow Meter Data?' : 'Delete Data'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {step === 'confirm'
                  ? 'This action permanently removes the selected server-side readings.'
                  : 'Choose the specific device and records to permanently remove.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={isDeleting}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close delete data dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 'form' ? (
          <div className="space-y-5 px-5 py-5">
            <div className="space-y-1.5">
              <label htmlFor="delete-device" className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Meter device
              </label>
              <div className="relative">
                <select
                  id="delete-device"
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-9 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {devices.length === 0 && <option value="">No meter devices available</option>}
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name} — {device.location}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              {deviceId === 'FLOSTAT_001' && (
                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  ⚠️ FLOSTAT_001 is a protected system device. Select another device (e.g. FLOSTAT_002) to delete readings.
                </p>
              )}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Data to delete</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(Object.keys(modeLabels) as DeleteDataMode[]).map((option) => (
                  <label
                    key={option}
                    className={`cursor-pointer rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
                      mode === option
                        ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="delete-mode"
                      value={option}
                      checked={mode === option}
                      onChange={() => setMode(option)}
                      className="sr-only"
                    />
                    {modeLabels[option]}
                  </label>
                ))}
              </div>
            </fieldset>

            {mode === 'day' && (
              <DateField id="delete-date" label="Date (IST)" value={date} onChange={setDate} />
            )}

            {mode === 'date-range' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DateField id="delete-start-date" label="Start date (IST)" value={startDate} onChange={setStartDate} />
                <DateField id="delete-end-date" label="End date (IST)" value={endDate} onChange={setEndDate} />
              </div>
            )}

            {mode === 'time-range' && (
              <div className="space-y-3">
                <DateField id="delete-time-date" label="Date (IST)" value={date} onChange={setDate} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TimeField id="delete-from-time" label="From (IST)" value={fromTime} onChange={setFromTime} />
                  <TimeField id="delete-to-time" label="To (IST)" value={toTime} onChange={setToTime} />
                </div>
              </div>
            )}

            {error && <ErrorMessage message={error} />}
          </div>
        ) : (
          <div className="space-y-4 px-5 py-5">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/25">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <div className="space-y-2 text-xs text-rose-950 dark:text-rose-100">
                  <p className="font-bold">This deletion is permanent.</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                    <dt className="font-semibold text-rose-700 dark:text-rose-300">Device</dt>
                    <dd className="font-bold">{deviceId}</dd>
                    <dt className="font-semibold text-rose-700 dark:text-rose-300">Range</dt>
                    <dd className="font-bold">{deletionSummary}</dd>
                  </dl>
                  <p>All flow-meter records for this device in this range will be removed from backend storage.</p>
                </div>
              </div>
            </div>
            {error && <ErrorMessage message={error} />}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/30">
          {step === 'confirm' && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep('form');
              }}
              disabled={isDeleting}
              className="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={step === 'confirm' ? handleDelete : handleContinue}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {isDeleting ? 'Deleting data...' : step === 'confirm' ? 'Delete Permanently' : 'Continue to confirmation'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <DatePicker id={id} label={label} value={value} onChange={onChange} />
  );
}

function TimeField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</label>
      <input
        id={id}
        type="time"
        step="60"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      />
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/25 dark:text-rose-300">
      {message}
    </div>
  );
}
