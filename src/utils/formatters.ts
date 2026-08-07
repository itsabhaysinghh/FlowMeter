/**
 * Utility functions for formatting enterprise numbers, volumes, dates, and flow metrics.
 */

export const formatNumber = (val: number | null | undefined, decimals = 1): string => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(val);
};

export const formatVolume = (litres: number | null | undefined): string => {
  if (litres === null || litres === undefined || isNaN(litres)) return '-';
  if (litres >= 1000000) {
    return `${(litres / 1000000).toFixed(2)} ML`;
  }
  if (litres >= 1000) {
    return `${(litres / 1000).toFixed(1)} kL`;
  }
  return `${formatNumber(litres, 0)} L`;
};

export const formatFlowRate = (rate: number | null | undefined): string => {
  if (rate === null || rate === undefined || isNaN(rate)) return '-';
  return `${formatNumber(rate, 1)} L/min`;
};

export const getCurrentTimestamp = (): string => {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

export const getCurrentFormattedDate = (): string => {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatLastSeen = (lastSeen: number): string => {
  const now = Math.floor(Date.now() / 1000);
  const diffSecs = now - lastSeen;
  if (diffSecs < 0) {
    return new Date(lastSeen * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 1) return 'Just now (1 sec ago)';
  if (diffMins < 60) return `${diffMins} mins ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  return new Date(lastSeen * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

