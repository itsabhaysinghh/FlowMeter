import React from 'react';
import { motion } from 'framer-motion';
import { Info, Maximize2 } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';

interface FlowGaugeCardProps {
  value: number;
  unit?: string;
  minVal?: number;
  maxVal?: number;
  normalMin?: number;
  normalMax?: number;
  isLive?: boolean;
  connectionStatus?: string;
}

export const FlowGaugeCard: React.FC<FlowGaugeCardProps> = ({
  value = 35.4,
  unit = 'L/min',
  minVal = 0,
  maxVal = 100,
  normalMin = 10,
  normalMax = 60,
  isLive = true,
  connectionStatus = 'Connected',
}) => {
  // Clamp value between minVal and maxVal
  const clampedValue = Math.min(Math.max(value, minVal), maxVal);
  const ratio = clampedValue / (maxVal - minVal);

  // SVG Geometry Settings
  const cx = 130;
  const cy = 125;
  const radius = 85;
  const strokeWidth = 9;

  // Calculate coordinates on semi-circle given angle in degrees (180° = left/0, 0° = right/max)
  const getCoordinates = (angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx - r * Math.cos(rad),
      y: cy - r * Math.sin(rad),
    };
  };

  // Active arc end angle (0% = 0°, 100% = 180°)
  const activeAngle = ratio * 180;
  const activeEndCoords = getCoordinates(activeAngle, radius);
  const activeStartCoords = getCoordinates(0, radius);

  // SVG Arc path string
  const activeArcD = [
    `M ${activeStartCoords.x} ${activeStartCoords.y}`,
    `A ${radius} ${radius} 0 0 1 ${activeEndCoords.x} ${activeEndCoords.y}`,
  ].join(' ');

  const bgStartCoords = getCoordinates(0, radius);
  const bgEndCoords = getCoordinates(180, radius);
  const bgArcD = [
    `M ${bgStartCoords.x} ${bgStartCoords.y}`,
    `A ${radius} ${radius} 0 0 1 ${bgEndCoords.x} ${bgEndCoords.y}`,
  ].join(' ');

  // Major ticks: 0, 20, 40, 60, 80, 100
  const majorTicks = [0, 20, 40, 60, 80, 100];

  // Minor ticks: 25 subdivisions
  const minorTicks = Array.from({ length: 26 }, (_, i) => i * 4);

  // Needle angle (180° = left/0, 0° = right/100)
  const needleAngle = activeAngle;
  const needleStart = getCoordinates(needleAngle, radius - 18);
  const needleEnd = getCoordinates(needleAngle, radius + 8);

  const isNormal = value >= normalMin && value <= normalMax;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="relative flex flex-col justify-between p-5 bg-white dark:bg-dark-card border border-flostat-border dark:border-dark-border rounded-2xl shadow-flostat hover:shadow-flostat-hover transition-all duration-300 overflow-hidden"
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            Live Flow Rate
          </span>
          <div className="group relative cursor-pointer">
            <Info className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" />
            <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block w-48 p-2 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl z-20">
              Real-time volumetric flow rate measured by ultrasonic sensor telemetry.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLive && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {connectionStatus}
            </div>
          )}
          <Maximize2 className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-colors" />
        </div>
      </div>

      {/* SVG Semi-Circular Needle Gauge */}
      <div className="relative flex flex-col items-center justify-center -my-2">
        <svg viewBox="0 0 260 155" className="w-full max-w-[260px] h-auto overflow-visible">
          {/* Background Gray Track Arc */}
          <path
            d={bgArcD}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="text-slate-100 dark:text-slate-800"
          />

          {/* Active Colored Arc Fill */}
          {clampedValue > 0 && (
            <path
              d={activeArcD}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="text-flostat-secondary dark:text-blue-500 transition-all duration-500"
            />
          )}

          {/* Minor Tick Marks */}
          {minorTicks.map((val) => {
            const tickAngle = (val / maxVal) * 180;
            const inner = getCoordinates(tickAngle, radius - 1);
            const outer = getCoordinates(tickAngle, radius + 3);
            return (
              <line
                key={`minor-${val}`}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="currentColor"
                strokeWidth={1}
                className="text-slate-300 dark:text-slate-700"
              />
            );
          })}

          {/* Major Tick Marks & Numbers */}
          {majorTicks.map((val) => {
            const tickAngle = (val / maxVal) * 180;
            const inner = getCoordinates(tickAngle, radius - 4);
            const outer = getCoordinates(tickAngle, radius + 5);
            const labelPos = getCoordinates(tickAngle, radius + 17);

            return (
              <g key={`major-${val}`}>
                <line
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="text-slate-400 dark:text-slate-600"
                />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-semibold font-sans select-none"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Blue Needle Line Pointer */}
          <line
            x1={needleStart.x}
            y1={needleStart.y}
            x2={needleEnd.x}
            y2={needleEnd.y}
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            className="text-flostat-primary dark:text-blue-400 transition-all duration-500"
          />

          {/* Needle Base Dot */}
          <circle
            cx={needleStart.x}
            cy={needleStart.y}
            r={2.5}
            className="fill-flostat-primary dark:fill-blue-400"
          />

          {/* Center Large Value Readout */}
          <text
            x={cx}
            y={cy - 20}
            textAnchor="middle"
            className="fill-slate-900 dark:fill-white text-3xl font-extrabold tracking-tight font-sans select-none"
          >
            {formatNumber(value, 1)}
          </text>

          {/* Unit Label */}
          <text
            x={cx}
            y={cy + 2}
            textAnchor="middle"
            className="fill-slate-500 dark:fill-slate-400 text-xs font-semibold font-sans select-none"
          >
            {unit}
          </text>
        </svg>

        {/* Normal Range Subtitle Badge */}
        <div className="flex flex-col items-center text-center mt-[-10px] text-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Normal Range
          </span>
          <span
            className={`font-bold text-xs ${
              isNormal
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {normalMin} - {normalMax} {unit}
          </span>
        </div>
      </div>
    </motion.div>
  );
};
