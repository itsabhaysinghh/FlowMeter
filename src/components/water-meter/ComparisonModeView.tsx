import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GitCompare,
  Layers,
  Server,
  ArrowRightLeft,
  RotateCcw,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  Search,
  AlertCircle,
  X,
  Settings,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import type {
  DeviceOption,
  TimeRangeTab,
  ComparisonModeType,
  ComparisonBlock,
  ComparisonEngineResult,
} from '../../types/meter.types';
import { meterService } from '../../services/meter.service';
import { getIstDateInputValue } from '../../utils/ist';
import { formatNumber } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';
import { DatePicker } from '../ui/calendar';

interface ComparisonModeViewProps {
  devices: DeviceOption[];
  initialDeviceId?: string;
}

const STORAGE_BLOCKS_KEY = 'flostat_custom_comparison_blocks';

const DEFAULT_BLOCKS: ComparisonBlock[] = [
  {
    id: 'block_main_utility',
    name: 'Block A: Main Utility & Inflow',
    description: 'Primary utility inlets and main supply pipelines',
    deviceIds: ['FLOSTAT_001', 'FLOSTAT_002', 'FLOSTAT_003'],
    color: '#00B4D8',
    isDefault: true,
  },
  {
    id: 'block_facilities',
    name: 'Block B: Facilities & Distribution',
    description: 'Central facility distribution, cooling towers, and HVAC',
    deviceIds: ['FLOSTAT_004', 'FLOSTAT_005', 'FLOSTAT_006'],
    color: '#0A1F44',
    isDefault: true,
  },
  {
    id: 'block_industrial',
    name: 'Block C: Industrial & RO Plant',
    description: 'Industrial manufacturing line, RO filtration, and treatment',
    deviceIds: ['FLOSTAT_007', 'FLOSTAT_008', 'FLOSTAT_009', 'FLOSTAT_010'],
    color: '#0284C7',
    isDefault: true,
  },
  {
    id: 'block_storage',
    name: 'Block D: Secondary Storage & Tanks',
    description: 'Auxiliary storage tanks, emergency reserves, and overhead tanks',
    deviceIds: ['FLOSTAT_011', 'FLOSTAT_012', 'FLOSTAT_013', 'FLOSTAT_014'],
    color: '#4B5563',
    isDefault: true,
  },
];

const TIMEFRAME_TABS: { id: TimeRangeTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'specific', label: 'Specific Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'custom', label: 'Custom' },
];

export const ComparisonModeView: React.FC<ComparisonModeViewProps> = ({
  devices,
  initialDeviceId,
}) => {
  // Mode selection
  const [comparisonMode, setComparisonMode] = useState<ComparisonModeType>('device-to-device');

  // Timeframe selection
  const [activeTimeframe, setActiveTimeframe] = useState<TimeRangeTab>('today');
  const [specificDate, setSpecificDate] = useState<string>(() => getIstDateInputValue());
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getIstDateInputValue().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState<string>(() => getIstDateInputValue().slice(0, 4));
  const [customRange, setCustomRange] = useState<{ startDate: string; endDate: string }>(() => {
    const today = getIstDateInputValue();
    return { startDate: today, endDate: today };
  });

  // Mode 1: Device vs Device Selection
  const [deviceA, setDeviceA] = useState<string>(() => {
    if (initialDeviceId && devices.some((d) => d.id === initialDeviceId)) {
      return initialDeviceId;
    }
    return devices[0]?.id || 'FLOSTAT_001';
  });
  const [deviceB, setDeviceB] = useState<string>(() => {
    const candidate = devices.find((d) => d.id !== (initialDeviceId || 'FLOSTAT_001'));
    return candidate?.id || 'FLOSTAT_002';
  });

  // Mode 2: Multi-Device Selection
  const [multiDevicesA, setMultiDevicesA] = useState<string[]>(() => ['FLOSTAT_001', 'FLOSTAT_002']);
  const [multiDevicesB, setMultiDevicesB] = useState<string[]>(() => ['FLOSTAT_003', 'FLOSTAT_004']);
  const [searchA, setSearchA] = useState<string>('');
  const [searchB, setSearchB] = useState<string>('');

  // Mode 3: Custom Blocks Management & Selection
  const [blocks, setBlocks] = useState<ComparisonBlock[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_BLOCKS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse saved blocks:', e);
    }
    return DEFAULT_BLOCKS;
  });

  const [selectedBlockA, setSelectedBlockA] = useState<string>(() => blocks[0]?.id || DEFAULT_BLOCKS[0].id);
  const [selectedBlockB, setSelectedBlockB] = useState<string>(() => blocks[1]?.id || DEFAULT_BLOCKS[1].id);

  // Block Management Modal State
  const [isBlockModalOpen, setIsBlockModalOpen] = useState<boolean>(false);
  const [editingBlock, setEditingBlock] = useState<ComparisonBlock | null>(null);
  const [blockFormName, setBlockFormName] = useState<string>('');
  const [blockFormDesc, setBlockFormDesc] = useState<string>('');
  const [blockFormDevices, setBlockFormDevices] = useState<string[]>([]);
  const [blockModalSearch, setBlockModalSearch] = useState<string>('');

  // Query Result & UI State
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonEngineResult | null>(null);
  const [chartType, setChartType] = useState<'volume' | 'flow'>('volume');
  const [breakdownSide, setBreakdownSide] = useState<'A' | 'B'>('A');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Persist blocks to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BLOCKS_KEY, JSON.stringify(blocks));
    } catch (e) {
      console.warn('Failed to persist blocks to localStorage:', e);
    }
  }, [blocks]);

  // Keep deviceA in sync if initialDeviceId changes
  useEffect(() => {
    if (initialDeviceId && devices.some((d) => d.id === initialDeviceId)) {
      setDeviceA(initialDeviceId);
    }
  }, [initialDeviceId, devices]);

  // Determine active Side A and Side B parameters based on comparison mode
  const sideConfig = useMemo(() => {
    if (comparisonMode === 'device-to-device') {
      const devObjA = devices.find((d) => d.id === deviceA);
      const devObjB = devices.find((d) => d.id === deviceB);
      return {
        labelA: devObjA ? `${devObjA.name} (${devObjA.id})` : deviceA,
        deviceIdsA: [deviceA],
        labelB: devObjB ? `${devObjB.name} (${devObjB.id})` : deviceB,
        deviceIdsB: [deviceB],
      };
    } else if (comparisonMode === 'multi-device') {
      return {
        labelA: `Group A (${multiDevicesA.length} Meter${multiDevicesA.length === 1 ? '' : 's'})`,
        deviceIdsA: multiDevicesA,
        labelB: `Group B (${multiDevicesB.length} Meter${multiDevicesB.length === 1 ? '' : 's'})`,
        deviceIdsB: multiDevicesB,
      };
    } else {
      // Block vs Block
      const bA = blocks.find((b) => b.id === selectedBlockA) || blocks[0] || DEFAULT_BLOCKS[0];
      const bB = blocks.find((b) => b.id === selectedBlockB) || blocks[1] || DEFAULT_BLOCKS[1];
      return {
        labelA: bA.name,
        deviceIdsA: bA.deviceIds,
        labelB: bB.name,
        deviceIdsB: bB.deviceIds,
      };
    }
  }, [comparisonMode, deviceA, deviceB, multiDevicesA, multiDevicesB, blocks, selectedBlockA, selectedBlockB, devices]);

  // Execute Comparison Query
  const fetchComparison = useCallback(async () => {
    if (sideConfig.deviceIdsA.length === 0 && sideConfig.deviceIdsB.length === 0) {
      setError('Please select at least one meter on either Side A or Side B.');
      return;
    }

    setLoading(true);
    setError(null);
    setExportNotice(null);

    try {
      const res = await meterService.getComparisonData({
        mode: comparisonMode,
        sideALabel: sideConfig.labelA,
        deviceIdsA: sideConfig.deviceIdsA,
        sideBLabel: sideConfig.labelB,
        deviceIdsB: sideConfig.deviceIdsB,
        period: activeTimeframe,
        customDateRange: activeTimeframe === 'custom' ? customRange : undefined,
        specificDate: activeTimeframe === 'specific' ? specificDate : undefined,
        selectedMonth: activeTimeframe === 'month' ? selectedMonth : undefined,
        selectedYear: activeTimeframe === 'year' ? selectedYear : undefined,
        allDevices: devices,
      });

      setResult(res);
    } catch (err: any) {
      console.error('[ComparisonModeView] Query error:', err);
      setError(err?.message || 'Failed to calculate comparison metrics.');
    } finally {
      setLoading(false);
    }
  }, [comparisonMode, sideConfig, activeTimeframe, customRange, specificDate, selectedMonth, selectedYear, devices]);

  // Auto-fetch on selection change
  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  // Swap Side A and Side B
  const handleSwapSides = () => {
    if (comparisonMode === 'device-to-device') {
      setDeviceA(deviceB);
      setDeviceB(deviceA);
    } else if (comparisonMode === 'multi-device') {
      const tempA = [...multiDevicesA];
      setMultiDevicesA(multiDevicesB);
      setMultiDevicesB(tempA);
    } else {
      const tempBlock = selectedBlockA;
      setSelectedBlockA(selectedBlockB);
      setSelectedBlockB(tempBlock);
    }
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!result) return;
    const success = meterService.exportComparisonCSV(result);
    if (success) {
      setExportNotice('Comparison analysis report exported successfully to CSV.');
      setTimeout(() => setExportNotice(null), 4000);
    }
  };

  // Block Modal Helpers
  const handleOpenCreateBlock = () => {
    setEditingBlock(null);
    setBlockFormName(`Custom Block ${blocks.length + 1}`);
    setBlockFormDesc('Custom meter grouping');
    setBlockFormDevices([]);
    setBlockModalSearch('');
    setIsBlockModalOpen(true);
  };

  const handleOpenEditBlock = (block: ComparisonBlock) => {
    setEditingBlock(block);
    setBlockFormName(block.name);
    setBlockFormDesc(block.description || '');
    setBlockFormDevices([...block.deviceIds]);
    setBlockModalSearch('');
    setIsBlockModalOpen(true);
  };

  const handleSaveBlock = () => {
    if (!blockFormName.trim()) return;

    if (editingBlock) {
      // Update existing block
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === editingBlock.id
            ? { ...b, name: blockFormName.trim(), description: blockFormDesc.trim(), deviceIds: blockFormDevices }
            : b
        )
      );
    } else {
      // Create new block
      const newBlock: ComparisonBlock = {
        id: `block_custom_${Date.now()}`,
        name: blockFormName.trim(),
        description: blockFormDesc.trim(),
        deviceIds: blockFormDevices,
        color: '#6366F1',
        isDefault: false,
      };
      setBlocks((prev) => [...prev, newBlock]);
    }
    setIsBlockModalOpen(false);
  };

  const handleDeleteBlock = (blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    if (selectedBlockA === blockId) setSelectedBlockA(blocks.find((b) => b.id !== blockId)?.id || DEFAULT_BLOCKS[0].id);
    if (selectedBlockB === blockId) setSelectedBlockB(blocks.find((b) => b.id !== blockId)?.id || DEFAULT_BLOCKS[1].id);
  };

  const handleResetBlocksToDefault = () => {
    setBlocks(DEFAULT_BLOCKS);
    setSelectedBlockA(DEFAULT_BLOCKS[0].id);
    setSelectedBlockB(DEFAULT_BLOCKS[1].id);
  };

  const filteredDevicesModal = useMemo(() => {
    if (!blockModalSearch) return devices;
    const q = blockModalSearch.toLowerCase();
    return devices.filter((d) => d.id.toLowerCase().includes(q) || d.name.toLowerCase().includes(q) || d.location.toLowerCase().includes(q));
  }, [devices, blockModalSearch]);

  const filteredDevicesA = useMemo(() => {
    if (!searchA) return devices;
    const q = searchA.toLowerCase();
    return devices.filter((d) => d.id.toLowerCase().includes(q) || d.name.toLowerCase().includes(q));
  }, [devices, searchA]);

  const filteredDevicesB = useMemo(() => {
    if (!searchB) return devices;
    const q = searchB.toLowerCase();
    return devices.filter((d) => d.id.toLowerCase().includes(q) || d.name.toLowerCase().includes(q));
  }, [devices, searchB]);

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar: Modes & Timeframe Selection */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#00B4D8]/10 border border-[#00B4D8]/30 rounded-xl text-[#00B4D8]">
                <GitCompare className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Compare Meters</h2>
                <p className="text-xs text-slate-500 font-medium">
                  Compare flow rates and consumption across devices and custom blocks.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={handleSwapSides}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer shadow-sm"
              title="Swap Side A and Side B"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-600" />
              <span>Swap Sides</span>
            </button>

            {comparisonMode === 'block-to-block' && (
              <button
                onClick={handleOpenCreateBlock}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#00B4D8] bg-[#00B4D8]/10 hover:bg-[#00B4D8]/20 border border-[#00B4D8]/30 rounded-xl transition cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-[#00B4D8]" />
                <span>New Block</span>
              </button>
            )}

            <button
              onClick={fetchComparison}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 hover:text-[#00B4D8] bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#00B4D8]' : 'text-slate-600'}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={!result || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#00B4D8] hover:bg-[#0096B4] rounded-xl shadow-sm hover:shadow transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Primary Controls Row: Comparison Mode Selector & Universal Timeframe Toolbar */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Comparison Mode Selector */}
          <div className="lg:col-span-5 flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200">
            <button
              onClick={() => setComparisonMode('device-to-device')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                comparisonMode === 'device-to-device'
                  ? 'bg-white text-[#00B4D8] shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Device vs Device</span>
            </button>
            <button
              onClick={() => setComparisonMode('multi-device')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                comparisonMode === 'multi-device'
                  ? 'bg-white text-[#00B4D8] shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Multi-Device</span>
            </button>
            <button
              onClick={() => setComparisonMode('block-to-block')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                comparisonMode === 'block-to-block'
                  ? 'bg-white text-[#00B4D8] shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Blocks</span>
            </button>
          </div>

          {/* Timeframe Switcher Tabs */}
          <div className="lg:col-span-7 flex items-center justify-end flex-wrap gap-2">
            <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200 shrink-0">
              {TIMEFRAME_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTimeframe(tab.id)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    activeTimeframe === tab.id
                      ? 'bg-white text-[#00B4D8] shadow-sm border border-slate-200/60'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Timeframe Date/Month/Year Specific Pickers */}
            {activeTimeframe === 'specific' && (
              <div className="w-40 shrink-0">
                <DatePicker value={specificDate} onChange={setSpecificDate} />
              </div>
            )}

            {activeTimeframe === 'month' && (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 focus:border-[#00B4D8] cursor-pointer shrink-0"
              />
            )}

            {activeTimeframe === 'year' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 focus:border-[#00B4D8] cursor-pointer shrink-0"
              >
                {[2026, 2025, 2024, 2023, 2022].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            )}

            {activeTimeframe === 'custom' && (
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-36">
                  <DatePicker
                    value={customRange.startDate}
                    onChange={(d) => setCustomRange((prev) => ({ ...prev, startDate: d }))}
                  />
                </div>
                <span className="text-xs text-slate-400 font-bold">to</span>
                <div className="w-36">
                  <DatePicker
                    value={customRange.endDate}
                    onChange={(d) => setCustomRange((prev) => ({ ...prev, endDate: d }))}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Export Notice */}
      {exportNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{exportNotice}</span>
          </div>
          <button onClick={() => setExportNotice(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Side-by-Side Target Selection Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SIDE A SELECTION */}
        <div className="bg-white p-5 rounded-2xl border-2 border-[#00B4D8]/30 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#00B4D8] text-white text-xs font-black">
                A
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">Side A</h3>
                <p className="text-[11px] text-slate-500 font-semibold">{sideConfig.labelA}</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/30">
              {sideConfig.deviceIdsA.length} Meter{sideConfig.deviceIdsA.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Mode 1: Device vs Device Dropdown */}
          {comparisonMode === 'device-to-device' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Meter A
              </label>
              <select
                value={deviceA}
                onChange={(e) => setDeviceA(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 cursor-pointer shadow-sm transition"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.id}) — {d.location}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mode 2: Multi-Device Checkbox Selection */}
          {comparisonMode === 'multi-device' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Side A meters..."
                    value={searchA}
                    onChange={(e) => setSearchA(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setMultiDevicesA(devices.map((d) => d.id))}
                    className="px-2 py-1 text-[10px] font-bold text-[#00B4D8] hover:bg-[#00B4D8]/10 rounded cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => setMultiDevicesA([])}
                    className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50/70 border border-slate-200 rounded-xl">
                {filteredDevicesA.map((d) => {
                  const isChecked = multiDevicesA.includes(d.id);
                  return (
                    <label
                      key={d.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs ${
                        isChecked ? 'bg-[#00B4D8]/10 border border-[#00B4D8]/30 text-[#0A1F44] font-bold' : 'hover:bg-white text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMultiDevicesA((prev) => [...prev, d.id]);
                            } else {
                              setMultiDevicesA((prev) => prev.filter((id) => id !== d.id));
                            }
                          }}
                          className="w-3.5 h-3.5 text-[#00B4D8] rounded border-slate-300 focus:ring-[#00B4D8] cursor-pointer"
                        />
                        <span>{d.name} <span className="text-[10px] text-slate-400 font-normal">({d.id})</span></span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">{d.facility}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode 3: Block Selection */}
          {comparisonMode === 'block-to-block' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Block A
                </label>
                <select
                  value={selectedBlockA}
                  onChange={(e) => setSelectedBlockA(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 cursor-pointer shadow-sm transition"
                >
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.deviceIds.length} meters)
                    </option>
                  ))}
                </select>
              </div>

              {/* Block A Chips Preview */}
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                {sideConfig.deviceIdsA.map((devId) => {
                  const dObj = devices.find((d) => d.id === devId);
                  return (
                    <span
                      key={devId}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg shadow-2xs"
                    >
                      <Server className="w-3 h-3 text-[#00B4D8]" />
                      <span>{dObj?.name || devId}</span>
                    </span>
                  );
                })}
                {sideConfig.deviceIdsA.length === 0 && (
                  <span className="text-xs text-slate-400 italic">No meters assigned to this block.</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SIDE B SELECTION */}
        <div className="bg-white p-5 rounded-2xl border-2 border-[#0A1F44]/20 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#0A1F44] text-white text-xs font-black">
                B
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">Side B</h3>
                <p className="text-[11px] text-slate-500 font-semibold">{sideConfig.labelB}</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#0A1F44]/10 text-[#0A1F44] border border-[#0A1F44]/20">
              {sideConfig.deviceIdsB.length} Meter{sideConfig.deviceIdsB.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Mode 1: Device vs Device Dropdown */}
          {comparisonMode === 'device-to-device' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Meter B
              </label>
              <select
                value={deviceB}
                onChange={(e) => setDeviceB(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#0A1F44]/20 cursor-pointer shadow-sm transition"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.id}) — {d.location}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mode 2: Multi-Device Checkbox Selection */}
          {comparisonMode === 'multi-device' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Side B meters..."
                    value={searchB}
                    onChange={(e) => setSearchB(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A1F44]/20"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setMultiDevicesB(devices.map((d) => d.id))}
                    className="px-2 py-1 text-[10px] font-bold text-[#0A1F44] hover:bg-[#0A1F44]/10 rounded cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => setMultiDevicesB([])}
                    className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50/70 border border-slate-200 rounded-xl">
                {filteredDevicesB.map((d) => {
                  const isChecked = multiDevicesB.includes(d.id);
                  return (
                    <label
                      key={d.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs ${
                        isChecked ? 'bg-[#0A1F44]/5 border border-[#0A1F44]/20 text-[#0A1F44] font-bold' : 'hover:bg-white text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMultiDevicesB((prev) => [...prev, d.id]);
                            } else {
                              setMultiDevicesB((prev) => prev.filter((id) => id !== d.id));
                            }
                          }}
                          className="w-3.5 h-3.5 text-[#0A1F44] rounded border-slate-300 focus:ring-[#0A1F44] cursor-pointer"
                        />
                        <span>{d.name} <span className="text-[10px] text-slate-400 font-normal">({d.id})</span></span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">{d.facility}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode 3: Block Selection */}
          {comparisonMode === 'block-to-block' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Block B
                  </label>
                  <select
                    value={selectedBlockB}
                    onChange={(e) => setSelectedBlockB(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#0A1F44]/20 cursor-pointer shadow-sm transition"
                  >
                    {blocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.deviceIds.length} meters)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="pt-6">
                  <button
                    onClick={() => {
                      const curB = blocks.find((b) => b.id === selectedBlockB);
                      if (curB) handleOpenEditBlock(curB);
                    }}
                    className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl cursor-pointer"
                    title="Edit Block Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Block B Chips Preview */}
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                {sideConfig.deviceIdsB.map((devId) => {
                  const dObj = devices.find((d) => d.id === devId);
                  return (
                    <span
                      key={devId}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg shadow-2xs"
                    >
                      <Server className="w-3 h-3 text-[#0A1F44]" />
                      <span>{dObj?.name || devId}</span>
                    </span>
                  );
                })}
                {sideConfig.deviceIdsB.length === 0 && (
                  <span className="text-xs text-slate-400 italic">No meters assigned to this block.</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading Overlay or Error Display */}
      {loading && (
        <div className="p-4 bg-[#00B4D8]/10 border border-[#00B4D8]/30 rounded-2xl flex items-center justify-center gap-2.5 text-xs font-bold text-[#0A1F44] animate-pulse">
          <RotateCcw className="w-4 h-4 animate-spin text-[#00B4D8]" />
          <span>Loading comparison data...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs font-bold text-rose-800">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Three-Up Metric Summary & Variance KPI Cards */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Side A KPI Card */}
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#00B4D8]" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black tracking-wider text-[#00B4D8] uppercase">
                Side A: {result.sideA.label}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {result.sideA.deviceIds.length} Meter{result.sideA.deviceIds.length === 1 ? '' : 's'}
              </span>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {formatNumber(result.sideA.totalVolumeLitres, 0)} <span className="text-sm font-semibold text-slate-500">L</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Total Consumption</p>
            </div>
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Avg Flow</span>
                <span className="font-bold text-slate-700">{result.sideA.averageFlowRateLpm.toFixed(1)} L/min</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Peak Flow</span>
                <span className="font-bold text-slate-700">{result.sideA.maximumFlowRateLpm.toFixed(1)} L/min</span>
              </div>
            </div>
          </div>

          {/* Side B KPI Card */}
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#0A1F44]" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black tracking-wider text-[#0A1F44] uppercase">
                Side B: {result.sideB.label}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {result.sideB.deviceIds.length} Meter{result.sideB.deviceIds.length === 1 ? '' : 's'}
              </span>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {formatNumber(result.sideB.totalVolumeLitres, 0)} <span className="text-sm font-semibold text-slate-500">L</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Total Consumption</p>
            </div>
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Avg Flow</span>
                <span className="font-bold text-slate-700">{result.sideB.averageFlowRateLpm.toFixed(1)} L/min</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Peak Flow</span>
                <span className="font-bold text-slate-700">{result.sideB.maximumFlowRateLpm.toFixed(1)} L/min</span>
              </div>
            </div>
          </div>

          {/* Variance / Delta KPI Card */}
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3 relative overflow-hidden">
            <div
              className={`absolute top-0 left-0 right-0 h-1 ${
                result.deltaVolumeLitres > 0
                  ? 'bg-rose-500'
                  : result.deltaVolumeLitres < 0
                  ? 'bg-emerald-500'
                  : 'bg-slate-400'
              }`}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black tracking-wider text-slate-500 uppercase">
                Difference
              </span>
              <span className="text-[10px] font-bold text-slate-400">{result.timeframeLabel}</span>
            </div>
            <div>
              <div
                className={`text-3xl font-black tracking-tight ${
                  result.deltaVolumeLitres > 0
                    ? 'text-rose-600'
                    : result.deltaVolumeLitres < 0
                    ? 'text-emerald-600'
                    : 'text-slate-800'
                }`}
              >
                {result.deltaVolumeLitres >= 0 ? '+' : ''}
                {formatNumber(result.deltaVolumeLitres, 0)}{' '}
                <span className="text-sm font-semibold text-slate-500">L</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`text-xs font-bold ${
                    result.deltaVolumeLitres > 0
                      ? 'text-rose-600'
                      : result.deltaVolumeLitres < 0
                      ? 'text-emerald-600'
                      : 'text-slate-600'
                  }`}
                >
                  {result.deltaVolumePercent >= 0 ? '▲ +' : '▼ '}
                  {result.deltaVolumePercent.toFixed(1)}%
                </span>
                <span className="text-xs text-slate-400">vs Side B</span>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Flow Delta</span>
                <span className="font-bold text-slate-700">
                  {result.deltaAvgFlowLpm >= 0 ? '+' : ''}
                  {result.deltaAvgFlowLpm.toFixed(1)} L/min
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Net Trend</span>
                <span
                  className={`font-bold ${
                    result.deltaVolumeLitres > 0
                      ? 'text-rose-600'
                      : result.deltaVolumeLitres < 0
                      ? 'text-emerald-600'
                      : 'text-slate-600'
                  }`}
                >
                  {result.deltaVolumeLitres > 0
                    ? '+ Volume'
                    : result.deltaVolumeLitres < 0
                    ? '- Volume'
                    : 'Balanced'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Side-by-Side Visualizations */}
      {result && result.combinedChartData.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Comparison Trend</h3>
              <p className="text-xs text-slate-500 font-medium">
                Interval consumption comparison.
              </p>
            </div>

            {/* Chart Type Toggle */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
              <button
                onClick={() => setChartType('volume')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  chartType === 'volume'
                    ? 'bg-white text-[#00B4D8] shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Volume (L)
              </button>
              <button
                onClick={() => setChartType('flow')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  chartType === 'flow'
                    ? 'bg-white text-[#00B4D8] shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Flow Rate
              </button>
            </div>
          </div>

          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'volume' ? (
                <BarChart data={result.combinedChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickFormatter={(v) => `${v} L`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const aVal = Number(payload[0]?.value) || 0;
                        const bVal = Number(payload[1]?.value) || 0;
                        const delta = Math.round((aVal - bVal) * 100) / 100;
                        return (
                          <div className="bg-slate-900/95 backdrop-blur text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1.5 min-w-[190px]">
                            <p className="font-bold text-slate-300 border-b border-slate-800 pb-1">{label}</p>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-[#00B4D8] font-semibold">
                                <span className="w-2 h-2 rounded-full bg-[#00B4D8]" />
                                {result.sideA.label}:
                              </span>
                              <span className="font-bold">{formatNumber(aVal, 1)} L</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                                <span className="w-2 h-2 rounded-full bg-[#0A1F44] border border-slate-600" />
                                {result.sideB.label}:
                              </span>
                              <span className="font-bold">{formatNumber(bVal, 1)} L</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800 text-[11px]">
                              <span className="text-slate-400 font-semibold">Difference:</span>
                              <span className={`font-black ${delta >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {delta >= 0 ? '+' : ''}{formatNumber(delta, 1)} L
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: 12 }}
                    formatter={(val) => (
                      <span className="text-xs font-bold text-slate-700">
                        {val === 'sideALitres' ? result.sideA.label : result.sideB.label}
                      </span>
                    )}
                  />
                  <Bar dataKey="sideALitres" name="sideALitres" fill="#00B4D8" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="sideBLitres" name="sideBLitres" fill="#0A1F44" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              ) : (
                <AreaChart data={result.combinedChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorSideA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00B4D8" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#00B4D8" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorSideB" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0A1F44" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0A1F44" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickFormatter={(v) => `${v} L`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const aVal = Number(payload[0]?.value) || 0;
                        const bVal = Number(payload[1]?.value) || 0;
                        return (
                          <div className="bg-slate-900/95 backdrop-blur text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1.5 min-w-[190px]">
                            <p className="font-bold text-slate-300 border-b border-slate-800 pb-1">{label}</p>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-[#00B4D8] font-semibold">
                                <span className="w-2 h-2 rounded-full bg-[#00B4D8]" />
                                {result.sideA.label}:
                              </span>
                              <span className="font-bold">{formatNumber(aVal, 1)} L</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                                <span className="w-2 h-2 rounded-full bg-[#0A1F44] border border-slate-600" />
                                {result.sideB.label}:
                              </span>
                              <span className="font-bold">{formatNumber(bVal, 1)} L</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: 12 }}
                    formatter={(val) => (
                      <span className="text-xs font-bold text-slate-700">
                        {val === 'sideALitres' ? result.sideA.label : result.sideB.label}
                      </span>
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="sideALitres"
                    name="sideALitres"
                    stroke="#00B4D8"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorSideA)"
                  />
                  <Area
                    type="monotone"
                    dataKey="sideBLitres"
                    name="sideBLitres"
                    stroke="#0A1F44"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorSideB)"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 5. Individual Meters Contribution Breakdown Table */}
      {result && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">
                Meter Breakdown
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Individual meter consumption and percentage contribution.
              </p>
            </div>

            {/* Toggle Side A / Side B View */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
              <button
                onClick={() => setBreakdownSide('A')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  breakdownSide === 'A'
                    ? 'bg-[#00B4D8] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Side A ({result.sideA.meterMetrics.length})
              </button>
              <button
                onClick={() => setBreakdownSide('B')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  breakdownSide === 'B'
                    ? 'bg-[#0A1F44] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Side B ({result.sideB.meterMetrics.length})
              </button>
            </div>
          </div>

          {/* Breakdown Table */}
          {(() => {
            const activeSideData = breakdownSide === 'A' ? result.sideA : result.sideB;
            const totalSideVolume = activeSideData.totalVolumeLitres || 1;

            if (activeSideData.meterMetrics.length === 0) {
              return (
                <div className="py-8 text-center text-xs text-slate-400 italic">
                  No meters selected for this side.
                </div>
              );
            }

            return (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50/90 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5">Meter ID</th>
                      <th className="px-3.5 py-2.5">Device Name</th>
                      <th className="px-3.5 py-2.5">Facility / Location</th>
                      <th className="px-3.5 py-2.5">Status</th>
                      <th className="px-3.5 py-2.5 text-right">Volume (L)</th>
                      <th className="px-3.5 py-2.5 text-right">Avg Flow (L/min)</th>
                      <th className="px-3.5 py-2.5 text-right">Peak Flow (L/min)</th>
                      <th className="px-3.5 py-2.5 text-right">Contribution %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeSideData.meterMetrics.map((m) => {
                      const contribPct = Math.round((m.totalVolumeLitres / totalSideVolume) * 1000) / 10;
                      return (
                        <tr key={m.deviceId} className="hover:bg-slate-50/80 transition">
                          <td className="px-3.5 py-3 font-mono font-bold text-slate-900">{m.deviceId}</td>
                          <td className="px-3.5 py-3 font-semibold text-slate-800">{m.deviceName}</td>
                          <td className="px-3.5 py-3 text-slate-500">{m.location}</td>
                          <td className="px-3.5 py-3">
                            <StatusBadge status={m.status} />
                          </td>
                          <td className="px-3.5 py-3 text-right font-bold text-slate-900">
                            {formatNumber(m.totalVolumeLitres, 1)}
                          </td>
                          <td className="px-3.5 py-3 text-right font-medium text-slate-700">
                            {m.averageFlowRateLpm.toFixed(1)}
                          </td>
                          <td className="px-3.5 py-3 text-right font-medium text-slate-700">
                            {m.maximumFlowRateLpm.toFixed(1)}
                          </td>
                          <td className="px-3.5 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    breakdownSide === 'A' ? 'bg-[#00B4D8]' : 'bg-[#0A1F44]'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, contribPct))}%` }}
                                />
                              </div>
                              <span className="font-bold text-slate-800 w-10 text-right">{contribPct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50/90 font-bold text-slate-900 border-t border-slate-200">
                    <tr>
                      <td colSpan={4} className="px-3.5 py-2.5 text-[11px] uppercase tracking-wider">
                        Total
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-black text-[#0A1F44]">
                        {formatNumber(activeSideData.totalVolumeLitres, 1)} L
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold">
                        {activeSideData.averageFlowRateLpm.toFixed(1)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold">
                        {activeSideData.maximumFlowRateLpm.toFixed(1)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-black">100.0%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* 6. Block Management Modal Dialog */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#00B4D8]" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingBlock ? 'Edit Block' : 'Create Block'}
                </h3>
              </div>
              <button
                onClick={() => setIsBlockModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Block Name</label>
                <input
                  type="text"
                  value={blockFormName}
                  onChange={(e) => setBlockFormName(e.target.value)}
                  placeholder="e.g., Block E: High Capacity Inflow"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 focus:border-[#00B4D8] font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Description (Optional)</label>
                <input
                  type="text"
                  value={blockFormDesc}
                  onChange={(e) => setBlockFormDesc(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 focus:border-[#00B4D8]"
                />
              </div>

              {/* Meter Selection for this Block */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Assign Meters ({blockFormDevices.length} of {devices.length} selected)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBlockFormDevices(devices.map((d) => d.id))}
                      className="text-[11px] font-bold text-[#00B4D8] hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => setBlockFormDevices([])}
                      className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search meters..."
                    value={blockModalSearch}
                    onChange={(e) => setBlockModalSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 focus:border-[#00B4D8]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {filteredDevicesModal.map((d) => {
                    const isSelected = blockFormDevices.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition ${
                          isSelected
                            ? 'bg-[#00B4D8]/10 border-[#00B4D8]/40 text-[#0A1F44] font-bold'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBlockFormDevices((prev) => [...prev, d.id]);
                              } else {
                                setBlockFormDevices((prev) => prev.filter((id) => id !== d.id));
                              }
                            }}
                            className="w-3.5 h-3.5 accent-[#00B4D8] rounded border-slate-300 focus:ring-[#00B4D8] cursor-pointer"
                          />
                          <span className="truncate">{d.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">{d.id}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div>
                {editingBlock && !editingBlock.isDefault && (
                  <button
                    onClick={() => {
                      handleDeleteBlock(editingBlock.id);
                      setIsBlockModalOpen(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Block</span>
                  </button>
                )}
                {editingBlock?.isDefault && (
                  <button
                    onClick={handleResetBlocksToDefault}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl border border-slate-200 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Defaults</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsBlockModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBlock}
                  disabled={!blockFormName.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#00B4D8] hover:bg-[#0096B4] shadow-sm shadow-[#00B4D8]/20 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Save Block
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
