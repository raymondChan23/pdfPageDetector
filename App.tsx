
import React, { useState, useRef } from 'react';
import { Download, FileText, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet, Plus, Trash2, ExternalLink, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { TaskStatus, PdfTask, ExcelExportData } from './types';
import { getPageCount, getFileNameFromUrl } from './services/pdfService';

const App: React.FC = () => {
  const [urlInput, setUrlInput] = useState('');
  const [tasks, setTasks] = useState<PdfTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processUrls = (urls: string[]) => {
    const validUrls = urls
      .map(u => u?.toString().trim())
      .filter(u => u && (u.startsWith('http://') || u.startsWith('https://')));

    if (validUrls.length === 0) return;

    const newTasks: PdfTask[] = validUrls.map(url => ({
      id: uuidv4(),
      url,
      fileName: getFileNameFromUrl(url),
      status: TaskStatus.IDLE,
    }));

    setTasks(prev => [...prev, ...newTasks]);
  };

  const addFromTextarea = () => {
    const urls = urlInput.split('\n');
    processUrls(urls);
    setUrlInput('');
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        // Extract URLs from the first column of every row
        const urls = data.map(row => row[0]).filter(cell => typeof cell === 'string');
        processUrls(urls);
      } catch (err) {
        console.error("Error parsing Excel:", err);
        alert("Failed to parse Excel file. Please ensure it has a column with URLs.");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const clearAll = () => {
    if (window.confirm("Are you sure you want to clear the entire queue?")) {
      setTasks([]);
    }
  };

  const runTasks = async () => {
    setIsProcessing(true);
    
    // We process tasks one by one to avoid overwhelming the browser with thousands of fetches at once
    const tasksToProcess = [...tasks];
    
    for (let i = 0; i < tasksToProcess.length; i++) {
      const task = tasksToProcess[i];
      if (task.status === TaskStatus.COMPLETED) continue;

      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: TaskStatus.DOWNLOADING, error: undefined } : t));
      
      try {
        const response = await fetch(task.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to download`);
        const blob = await response.blob();
        
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: TaskStatus.ANALYZING } : t));
        const pageCount = await getPageCount(blob);
        
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: TaskStatus.COMPLETED, pageCount } : t));
      } catch (err: any) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: TaskStatus.FAILED, error: err.message } : t));
      }
    }
    
    setIsProcessing(false);
  };

  const exportToExcel = () => {
    const exportData: ExcelExportData[] = tasks.map(t => ({
      "File Name": t.fileName,
      "URL": t.url,
      "Page Count": t.pageCount !== undefined ? t.pageCount : (t.status === TaskStatus.FAILED ? 'Error' : 'Pending')
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PDF Page Counts");
    
    worksheet['!cols'] = [
      { wch: 40 }, // File Name
      { wch: 60 }, // URL
      { wch: 15 }  // Page Count
    ];

    XLSX.writeFile(workbook, "PDF_Page_Count_Report.xlsx");
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.IDLE: return <FileText className="w-5 h-5 text-slate-300" />;
      case TaskStatus.DOWNLOADING: 
      case TaskStatus.ANALYZING: return <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />;
      case TaskStatus.COMPLETED: return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case TaskStatus.FAILED: return <AlertCircle className="w-5 h-5 text-rose-500" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
                <FileSpreadsheet className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">PDF Page Counter</h1>
            </div>
            <p className="text-slate-500 text-lg">Batch process thousands of PDFs from Excel or text links.</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {tasks.length > 0 && (
              <button
                onClick={clearAll}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold py-3 px-6 rounded-2xl transition-all"
              >
                <X className="w-5 h-5" />
                Clear All
              </button>
            )}
            {tasks.some(t => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.FAILED) && (
              <button
                onClick={exportToExcel}
                className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-2xl transition-all shadow-lg shadow-emerald-100"
              >
                <Download className="w-5 h-5" />
                Export Results
              </button>
            )}
            {tasks.some(t => t.status === TaskStatus.IDLE || t.status === TaskStatus.FAILED) && (
              <button
                onClick={runTasks}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 px-8 rounded-2xl transition-all shadow-lg shadow-indigo-200"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                {isProcessing ? 'Processing...' : 'Run Analysis'}
              </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Input Section */}
          <section className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-4 h-4" /> Bulk Upload (Excel)
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Select an Excel file. The first column should contain the PDF URLs.
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleExcelUpload}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-4 rounded-2xl transition-all border-2 border-dashed border-indigo-200"
              >
                <FileSpreadsheet className="w-5 h-5" />
                Choose Excel File
              </button>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4" /> Manual Links
              </h2>
              <textarea
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste links here (one per line)..."
                className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all resize-none font-mono text-sm mb-4"
              />
              <button
                onClick={addFromTextarea}
                disabled={!urlInput.trim() || isProcessing}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white font-bold py-4 rounded-2xl transition-all"
              >
                Add Links to Queue
              </button>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <h4 className="flex items-center gap-2 text-blue-800 font-bold text-sm mb-1 uppercase tracking-tight">
                <AlertCircle className="w-4 h-4" />
                Bulk Tips
              </h4>
              <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
                <li>Processing 8000+ files may take time depending on internet speed.</li>
                <li>CORS restrictions apply; some servers block browser-based downloads.</li>
                <li>Keep this tab open while processing.</li>
              </ul>
            </div>
          </section>

          {/* Queue Section */}
          <section className="lg:col-span-8 flex flex-col h-[700px]">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <span className="text-sm font-bold text-slate-500 uppercase">Queue Progress</span>
                <div className="flex gap-4">
                  <span className="text-xs font-bold text-emerald-600">
                    Done: {tasks.filter(t => t.status === TaskStatus.COMPLETED).length}
                  </span>
                  <span className="text-xs font-bold text-rose-600">
                    Failed: {tasks.filter(t => t.status === TaskStatus.FAILED).length}
                  </span>
                  <span className="text-xs font-bold text-indigo-600">
                    Total: {tasks.length}
                  </span>
                </div>
              </div>

              {tasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-12">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <FileSpreadsheet className="w-10 h-10 opacity-30" />
                  </div>
                  <p className="text-slate-400 font-medium">Ready for your links</p>
                  <p className="text-sm">Upload an Excel or paste links to begin</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                  {tasks.map((task) => (
                    <div key={task.id} className="p-4 hover:bg-slate-50/50 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                          {getStatusIcon(task.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-800 truncate pr-2" title={task.fileName}>
                              {task.fileName}
                            </h3>
                            <div className="flex items-center gap-4 flex-shrink-0">
                               {task.pageCount !== undefined && (
                                <span className="text-xs font-bold px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg">
                                  {task.pageCount} Pages
                                </span>
                              )}
                              <button
                                onClick={() => removeTask(task.id)}
                                disabled={isProcessing}
                                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <ExternalLink className="w-2 h-2" />
                            <span className="truncate max-w-[400px]">{task.url}</span>
                          </div>
                          {task.error && (
                            <p className="text-[10px] text-rose-500 mt-1 font-medium">{task.error}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default App;
