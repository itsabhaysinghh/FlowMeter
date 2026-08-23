import React, { createContext, useContext, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface PieData {
  label: string;
  value: number;
  color?: string;
  fill?: string;
  [key: string]: any;
}

interface PieArc {
  data: PieData;
  index: number;
  value: number;
  actualValue: number;
  startAngle: number;
  endAngle: number;
  padAngle: number;
  path: string;
  midAngle: number;
  centroid: [number, number];
}

interface PieChartContextValue {
  data: PieData[];
  arcs: PieArc[];
  size: number;
  innerRadius: number;
  outerRadius: number;
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
  totalValue: number;
}

const PieChartContext = createContext<PieChartContextValue | null>(null);

export function usePieChartContext() {
  const ctx = useContext(PieChartContext);
  if (!ctx) {
    throw new Error('PieChart components must be wrapped inside <PieChart>');
  }
  return ctx;
}

// Helper to convert polar coordinates to SVG Cartesian path
function describeArc(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngle: number,
  endAngle: number
): { path: string; midAngle: number; centroid: [number, number] } {
  const angleDiff = Math.max(endAngle - startAngle, 0.0001);
  const midAngle = startAngle + angleDiff / 2;

  const x1o = cx + rOuter * Math.cos(startAngle);
  const y1o = cy + rOuter * Math.sin(startAngle);
  const x2o = cx + rOuter * Math.cos(endAngle);
  const y2o = cy + rOuter * Math.sin(endAngle);

  const largeArcFlag = angleDiff > Math.PI ? 1 : 0;

  const midR = rInner > 0 ? (rInner + rOuter) / 2 : rOuter / 2;
  const centroid: [number, number] = [
    cx + midR * Math.cos(midAngle),
    cy + midR * Math.sin(midAngle),
  ];

  if (rInner <= 0) {
    const path = [
      `M ${cx} ${cy}`,
      `L ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
      `A ${rOuter.toFixed(2)} ${rOuter.toFixed(2)} 0 ${largeArcFlag} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)}`,
      'Z',
    ].join(' ');
    return { path, midAngle, centroid };
  }

  const x2i = cx + rInner * Math.cos(endAngle);
  const y2i = cy + rInner * Math.sin(endAngle);
  const x1i = cx + rInner * Math.cos(startAngle);
  const y1i = cy + rInner * Math.sin(startAngle);

  const path = [
    `M ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
    `A ${rOuter.toFixed(2)} ${rOuter.toFixed(2)} 0 ${largeArcFlag} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)}`,
    `L ${x2i.toFixed(2)} ${y2i.toFixed(2)}`,
    `A ${rInner.toFixed(2)} ${rInner.toFixed(2)} 0 ${largeArcFlag} 0 ${x1i.toFixed(2)} ${y1i.toFixed(2)}`,
    'Z',
  ].join(' ');

  return { path, midAngle, centroid };
}

const DEFAULT_PALETTE = [
  '#0ea5e9',
  '#a855f7',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#ec4899',
  '#6366f1',
];

export interface PieChartProps {
  data: PieData[];
  size?: number;
  innerRadius?: number;
  padAngle?: number;
  cornerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  hoveredIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
  className?: string;
  children?: React.ReactNode;
}

export const PieChart: React.FC<PieChartProps> = ({
  data = [],
  size = 280,
  innerRadius = 0,
  padAngle = 0.03,
  startAngle = -Math.PI / 2,
  endAngle = (3 * Math.PI) / 2,
  hoveredIndex: controlledHoveredIndex,
  onHoverChange,
  className = '',
  children,
}) => {
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<number | null>(null);

  const isControlled = controlledHoveredIndex !== undefined;
  const hoveredIndex = isControlled ? controlledHoveredIndex : internalHoveredIndex;

  const setHoveredIndex = (idx: number | null) => {
    if (!isControlled) {
      setInternalHoveredIndex(idx);
    }
    onHoverChange?.(idx);
  };

  const totalValue = useMemo(() => {
    return data.reduce((sum, item) => sum + Math.max(item.value || 0, 0), 0);
  }, [data]);

  const outerRadius = size / 2 - 16;
  const cx = size / 2;
  const cy = size / 2;

  const arcs: PieArc[] = useMemo(() => {
    if (data.length === 0) return [];

    const calcTotal = totalValue === 0 ? data.length : totalValue;
    let currentAngle = startAngle;
    const totalAngleRange = endAngle - startAngle;

    return data.map((item, index) => {
      const actualVal = Math.max(item.value || 0, 0);
      const valForSlice = totalValue === 0 ? 1 : actualVal;
      const sliceAngle = (valForSlice / calcTotal) * totalAngleRange;

      let sAngle = currentAngle;
      let eAngle = currentAngle + sliceAngle;
      currentAngle = eAngle;

      if (padAngle > 0 && sliceAngle > padAngle * 2) {
        sAngle += padAngle / 2;
        eAngle -= padAngle / 2;
      }

      const { path, midAngle, centroid } = describeArc(
        cx,
        cy,
        innerRadius,
        outerRadius,
        sAngle,
        eAngle
      );

      return {
        data: item,
        index,
        value: valForSlice,
        actualValue: actualVal,
        startAngle: sAngle,
        endAngle: eAngle,
        padAngle,
        path,
        midAngle,
        centroid,
      };
    });
  }, [data, totalValue, startAngle, endAngle, padAngle, cx, cy, innerRadius, outerRadius]);

  const contextValue: PieChartContextValue = {
    data,
    arcs,
    size,
    innerRadius,
    outerRadius,
    hoveredIndex,
    setHoveredIndex,
    totalValue,
  };

  const svgChildren: React.ReactNode[] = [];
  const htmlChildren: React.ReactNode[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if ((child.type as any) === PieCenter) {
      htmlChildren.push(child);
    } else {
      svgChildren.push(child);
    }
  });

  return (
    <PieChartContext.Provider value={contextValue}>
      <div
        className={`relative inline-flex items-center justify-center select-none ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
        >
          <g>{svgChildren}</g>
        </svg>

        {htmlChildren}
      </div>
    </PieChartContext.Provider>
  );
};

export interface PieSliceProps {
  index: number;
  color?: string;
  fill?: string;
  animate?: boolean;
  showGlow?: boolean;
  hoverEffect?: 'translate' | 'grow' | 'none';
  hoverOffset?: number;
  className?: string;
}

export const PieSlice: React.FC<PieSliceProps> = ({
  index,
  color,
  fill,
  animate = true,
  showGlow = true,
  hoverEffect = 'translate',
  hoverOffset = 8,
  className = '',
}) => {
  const { arcs, hoveredIndex, setHoveredIndex, size } = usePieChartContext();
  const arc = arcs[index];

  if (!arc) return null;

  const isHovered = hoveredIndex === index;
  const isAnyHovered = hoveredIndex !== null;
  const sliceColor = color || arc.data.color || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];

  const tx = isHovered && hoverEffect === 'translate' ? Math.cos(arc.midAngle) * hoverOffset : 0;
  const ty = isHovered && hoverEffect === 'translate' ? Math.sin(arc.midAngle) * hoverOffset : 0;

  const opacity = isAnyHovered ? (isHovered ? 1 : 0.45) : 1;

  return (
    <g>
      <defs>
        {showGlow && (
          <filter id={`glow-${index}-${size}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        )}
      </defs>
      <motion.path
        d={arc.path}
        fill={fill || sliceColor}
        filter={isHovered && showGlow ? `url(#glow-${index}-${size})` : undefined}
        className={`cursor-pointer transition-colors duration-200 ${className}`}
        initial={animate ? { opacity: 0 } : false}
        animate={{
          x: tx,
          y: ty,
          opacity,
        }}
        transition={{
          type: 'spring',
          stiffness: 350,
          damping: 24,
        }}
        onMouseEnter={() => setHoveredIndex(index)}
        onMouseLeave={() => setHoveredIndex(null)}
      />
    </g>
  );
};

export interface PieCenterProps {
  defaultLabel?: string;
  formatOptions?: Intl.NumberFormatOptions;
  prefix?: string;
  suffix?: string;
  children?: ((props: { hoveredData: PieData | null; totalValue: number }) => React.ReactNode) | React.ReactNode;
  className?: string;
}

export const PieCenter: React.FC<PieCenterProps> = ({
  defaultLabel = 'Total',
  prefix = '',
  suffix = '',
  children,
  className = '',
}) => {
  const { innerRadius, hoveredIndex, arcs, totalValue } = usePieChartContext();

  if (innerRadius <= 0) return null;

  const hoveredArc = hoveredIndex !== null ? arcs[hoveredIndex] : null;
  const hoveredData = hoveredArc ? hoveredArc.data : null;

  const label = hoveredData ? hoveredData.label : defaultLabel;
  const rawValue = hoveredData ? (hoveredData.actualValue !== undefined ? hoveredData.actualValue : hoveredData.value) : totalValue;
  const formattedValue = `${prefix}${new Intl.NumberFormat().format(Math.round(rawValue))}${suffix}`;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 ${className}`}
    >
      {typeof children === 'function' ? (
        children({ hoveredData, totalValue })
      ) : children ? (
        children
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={hoveredIndex ?? 'total'}
            initial={{ opacity: 0, y: 3, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -3, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col items-center justify-center text-center"
          >
            <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {label}
            </span>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              {formattedValue}
            </span>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

export interface LegendProps {
  data?: PieData[];
  hoveredIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
  className?: string;
}

export const Legend: React.FC<LegendProps> = ({
  data: propData,
  hoveredIndex: propHoveredIndex,
  onHoverChange: propOnHoverChange,
  className = '',
}) => {
  let contextData: PieData[] = [];
  let ctxHoveredIndex: number | null = null;
  let ctxSetHoveredIndex: ((idx: number | null) => void) | null = null;

  try {
    const ctx = usePieChartContext();
    contextData = ctx.data;
    ctxHoveredIndex = ctx.hoveredIndex;
    ctxSetHoveredIndex = ctx.setHoveredIndex;
  } catch {
    // Used outside context
  }

  const items = propData || contextData;
  const hoveredIndex = propHoveredIndex !== undefined ? propHoveredIndex : ctxHoveredIndex;
  const setHovered = propOnHoverChange || ctxSetHoveredIndex;

  const total = items.reduce((sum, item) => sum + (item.value || 0), 0);

  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-2 justify-center text-[10px] font-semibold text-slate-500 dark:text-slate-400 ${className}`}>
      {items.map((item, index) => {
        const val = item.value || 0;
        const pct = total > 0 ? ((val / total) * 100).toFixed(0) : '0';
        const color = item.color || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
        const isHovered = hoveredIndex === index;
        const isAnyHovered = hoveredIndex !== null;

        return (
          <div
            key={item.label || index}
            onMouseEnter={() => setHovered?.(index)}
            onMouseLeave={() => setHovered?.(null)}
            className={`flex items-center gap-1.5 cursor-pointer transition-opacity duration-200 ${
              isAnyHovered && !isHovered ? 'opacity-40' : 'opacity-100'
            }`}
          >
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-slate-700 dark:text-slate-200 font-medium">
              {item.label} ({pct}%)
            </span>
          </div>
        );
      })}
    </div>
  );
};
