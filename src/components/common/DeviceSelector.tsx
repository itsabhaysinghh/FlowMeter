import React, { useState, useRef, useEffect } from 'react';
import { Cpu, ChevronDown, Check, Building2, Radio } from 'lucide-react';
import type { DeviceOption } from '../../types/meter.types';
import { StatusBadge } from './StatusBadge';

interface DeviceSelectorProps {
  selectedDeviceId?: string;
  onDeviceChange?: (device: DeviceOption) => void;
  devices?: DeviceOption[];
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  selectedDeviceId,
  onDeviceChange,
  devices = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) || devices[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (device: DeviceOption) => {
    onDeviceChange?.(device);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={devices.length === 0}
        className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-flostat-border dark:border-dark-border bg-white dark:bg-dark-card hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-100 shadow-sm transition-all active:scale-98 min-w-[260px] sm:min-w-[320px] disabled:opacity-80"
      >
        <div className="flex items-center gap-2.5 text-left truncate">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-flostat-primary dark:text-blue-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold truncate tracking-tight text-slate-900 dark:text-white">
                {selectedDevice ? selectedDevice.name : 'No registered devices found.'}
              </span>
              {selectedDevice && <StatusBadge status={selectedDevice.status} size="sm" />}
            </div>
            {selectedDevice && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                {selectedDevice.location}
              </span>
            )}
          </div>
        </div>
        {devices.length > 0 && (
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && devices.length > 0 && (
        <div className="absolute right-0 sm:left-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-dark-card border border-flostat-border dark:border-dark-border shadow-xl z-50 p-1.5 space-y-1">
          <div className="px-3 py-2 text-[11px] font-bold tracking-wider uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span>SELECT METER DEVICE</span>
            <Radio className="w-3.5 h-3.5 text-flostat-secondary animate-pulse" />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {devices.map((dev) => {
              const isSelected = selectedDevice && dev.id === selectedDevice.id;
              return (
                <button
                  key={dev.id}
                  onClick={() => handleSelect(dev)}
                  className={`w-full flex items-start justify-between p-2.5 rounded-xl text-left text-xs transition-all ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-flostat-primary dark:text-blue-300'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {dev.name}
                      </span>
                      <StatusBadge status={dev.status} size="sm" />
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      {dev.location}
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-flostat-secondary mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
