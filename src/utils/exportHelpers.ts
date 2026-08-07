import { meterService } from '../services/meter.service';

export interface ExportStatus {
  isExporting: boolean;
  type: 'csv' | 'pdf' | null;
  message: string | null;
}

export const triggerCSVExport = async (
  onStatusChange?: (status: ExportStatus) => void
): Promise<void> => {
  onStatusChange?.({ isExporting: true, type: 'csv', message: 'Initiating CSV export...' });
  try {
    const result = await meterService.exportCSV();
    if (result === null) {
      onStatusChange?.({
        isExporting: false,
        type: 'csv',
        message: 'CSV Export API pending backend implementation.',
      });
    } else {
      onStatusChange?.({
        isExporting: false,
        type: 'csv',
        message: 'CSV Export downloaded successfully.',
      });
    }
  } catch (err) {
    onStatusChange?.({
      isExporting: false,
      type: 'csv',
      message: 'Failed to initiate CSV export.',
    });
  }
};

export const triggerPDFExport = async (
  onStatusChange?: (status: ExportStatus) => void
): Promise<void> => {
  onStatusChange?.({ isExporting: true, type: 'pdf', message: 'Generating PDF report...' });
  try {
    const result = await meterService.exportPDF();
    if (result === null) {
      onStatusChange?.({
        isExporting: false,
        type: 'pdf',
        message: 'PDF Report API pending backend implementation.',
      });
    } else {
      onStatusChange?.({
        isExporting: false,
        type: 'pdf',
        message: 'PDF Report generated successfully.',
      });
    }
  } catch (err) {
    onStatusChange?.({
      isExporting: false,
      type: 'pdf',
      message: 'Failed to generate PDF report.',
    });
  }
};
