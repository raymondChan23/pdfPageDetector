
export enum TaskStatus {
  IDLE = 'IDLE',
  DOWNLOADING = 'DOWNLOADING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface PdfTask {
  id: string;
  url: string;
  fileName: string;
  pageCount?: number;
  status: TaskStatus;
  error?: string;
}

export interface ExcelExportData {
  "File Name": string;
  "URL": string;
  "Page Count": number | string;
}
