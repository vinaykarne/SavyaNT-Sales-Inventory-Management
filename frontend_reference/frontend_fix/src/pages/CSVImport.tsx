import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  Upload,
  AlertCircle,
  CheckCircle2,
  Download,
  AlertTriangle,
  FileText,
  RotateCcw,
  Check,
  X,
  Lock,
} from 'lucide-react';
import { csvService, CSVParseResult, ParsedProductRow } from '../services/csvService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/formatters';
import { StatusBadge } from '../components/StatusBadge';

export const CSVImport: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importCompleted, setImportCompleted] = useState<boolean>(false);

  // Download sample valid CSV
  const handleDownloadValidSample = () => {
    const content = csvService.getSampleValidCSV();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample_valid_products.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast.info('Downloaded sample_valid_products.csv');
  };

  // Download sample invalid CSV (to test error reporting)
  const handleDownloadInvalidSample = () => {
    const content = csvService.getSampleInvalidCSV();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample_invalid_products.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast.warning('Downloaded sample_invalid_products.csv (Contains deliberate validation errors).');
  };

  // File drag & drop / input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportCompleted(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      processCSV(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportCompleted(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      processCSV(text);
    };
    reader.readAsText(file);
  };

  // Parse and validate
  const processCSV = (content: string) => {
    if (!content.trim()) {
      setParseResult(null);
      return;
    }
    const result = csvService.parseAndValidateProductCSV(content);
    setParseResult(result);
  };

  // Commit valid import
  const handleCommitImport = () => {
    if (!parseResult || !parseResult.isValid) return;

    setIsImporting(true);

    setTimeout(() => {
      const res = csvService.commitImport(
        parseResult.parsedRows,
        currentUser?.name || 'Administrator'
      );
      setIsImporting(false);

      if (res.success) {
        toast.success(
          `Successfully imported ${res.importedCount} products into catalog with Opening Stock audit logs!`
        );
        setImportCompleted(true);
      } else {
        toast.error(res.error || 'Failed to import products');
      }
    }, 400);
  };

  // Reset
  const handleReset = () => {
    setCsvContent('');
    setFileName('');
    setParseResult(null);
    setImportCompleted(false);
  };

  if (!isAdmin) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs max-w-lg mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Administrator Access Required</h3>
        <p className="text-xs text-slate-500">
          CSV Bulk Product Import is an administrative master-data modification module. Please sign in
          with an Admin account (admin@savya.com) to access this feature.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Product CSV Bulk Import
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
              Admin Exclusive
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Strict all-or-nothing validation: If even a single row contains an error, nothing is imported.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadValidSample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Download Valid Sample
          </button>
          <button
            onClick={handleDownloadInvalidSample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Download Invalid Sample
          </button>
        </div>
      </div>

      {/* Upload Box */}
      {!importCompleted ? (
        <div className="space-y-6">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="bg-white rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 p-8 text-center transition cursor-pointer relative"
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {fileName ? fileName : 'Choose CSV file or drag and drop here'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Expected headers:{' '}
                  <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[11px]">
                    product_code,product_name,category,price,stock_quantity,status
                  </code>
                </p>
              </div>
            </div>
          </div>

          {/* Or Paste Raw CSV Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Or Paste CSV Data Directly:
              </label>
              {csvContent && (
                <button
                  onClick={handleReset}
                  className="text-xs text-rose-600 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear Data
                </button>
              )}
            </div>

            <textarea
              rows={4}
              value={csvContent}
              onChange={(e) => {
                setCsvContent(e.target.value);
                processCSV(e.target.value);
              }}
              placeholder={`product_code,product_name,category,price,stock_quantity,status\nPRD-201,Wireless Keyboard,Accessories,1500,20,Active\nPRD-202,Optical Mouse,Accessories,500,50,Active`}
              className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500 transition"
            />
          </div>

          {/* Parse Result Summary & Errors */}
          {parseResult && (
            <div className="space-y-6">
              {/* Status Banner */}
              {parseResult.isValid ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900">
                        CSV Validation Succeeded! ({parseResult.parsedRows.length} Valid Products)
                      </h4>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        All headers and product rows passed validation. You can preview the records
                        below and confirm the atomic import.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleCommitImport}
                    disabled={isImporting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/25 transition cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {isImporting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Import All {parseResult.parsedRows.length} Products
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-rose-900">
                        CSV Validation Failed: Import Rejected (Atomic Guard Active)
                      </h4>
                      <p className="text-xs text-rose-700 mt-0.5">
                        In accordance with the business rule,{' '}
                        <strong>if any row is invalid, nothing is imported</strong>. Please fix the
                        following row-specific errors:
                      </p>
                    </div>
                  </div>

                  {/* Header Errors */}
                  {parseResult.headerErrors.length > 0 && (
                    <div className="pl-8 space-y-1">
                      {parseResult.headerErrors.map((err, i) => (
                        <p key={i} className="text-xs text-rose-800 font-semibold">
                          • {err}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Row Errors Table */}
                  {parseResult.rowErrors.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-rose-200 bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-rose-100/70 text-rose-900 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2 px-3 w-16">Row #</th>
                            <th className="py-2 px-3 w-32">Violated Field</th>
                            <th className="py-2 px-3">Exact Error Message</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-100">
                          {parseResult.rowErrors.map((err, i) => (
                            <tr key={i} className="hover:bg-rose-50/50">
                              <td className="py-2 px-3 font-mono font-bold text-rose-700">
                                Line {err.rowNumber}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-700 font-semibold">
                                {err.field || 'General'}
                              </td>
                              <td className="py-2 px-3 text-rose-800 font-medium">{err.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Preview Table of Valid Rows */}
              {parseResult.parsedRows.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      File Preview ({parseResult.parsedRows.length} Rows Parsed)
                    </h3>
                  </div>

                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Product Code</th>
                          <th className="py-2.5 px-3">Product Name</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3 text-right">Price (₹)</th>
                          <th className="py-2.5 px-3 text-center">Initial Stock</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parseResult.parsedRows.map((row) => (
                          <tr key={row.rowNumber} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 text-slate-400 font-mono">{row.rowNumber}</td>
                            <td className="py-2 px-3 font-mono font-bold text-blue-600">
                              {row.productCode}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-900">
                              {row.productName}
                            </td>
                            <td className="py-2 px-3 text-slate-500">{row.category}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(row.price)}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                              {row.stockQuantity}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <StatusBadge status={row.status} size="sm" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Import Success Confirmation Card */
        <div className="bg-white p-8 rounded-2xl border border-emerald-200 shadow-md text-center max-w-lg mx-auto space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900">CSV Import Completed!</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            All {parseResult?.parsedRows.length} products have been added to the master product
            catalog, and corresponding "Opening Stock" movements have been recorded in the audit trail.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/products')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition"
            >
              View Products Catalog
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
