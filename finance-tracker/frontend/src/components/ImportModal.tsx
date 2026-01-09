import { useState, useCallback } from 'react';
import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { importApi } from '../services/api';
import { ParsedTransaction, ColumnMapping, ImportSummary } from '../types';
import ImportPreviewTable from './ImportPreviewTable';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Stage = 'upload' | 'preview' | 'success';

export default function ImportModal({ isOpen, onClose, onComplete }: ImportModalProps) {
  const [stage, setStage] = useState<Stage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    // Validate file type
    const validTypes = ['.csv', '.xlsx', '.xls', '.pdf'];
    const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();

    if (!validTypes.includes(fileExt)) {
      setError('Invalid file type. Please upload a CSV, XLSX, or PDF file.');
      return;
    }

    // Validate file size (10MB max)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10MB.');
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Auto-parse file
    await parseFile(selectedFile);
  };

  const parseFile = async (fileToUpload: File) => {
    setLoading(true);
    setError(null);

    try {
      const response = await importApi.parseFile(fileToUpload);
      setParsedData(response.data.transactions);
      setColumnMapping(response.data.mapping);
      setDuplicates(response.data.duplicates);
      setStage('preview');
    } catch (err: any) {
      console.error('Parse error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to parse file';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await importApi.confirmImport({
        transactions: parsedData,
      });

      setSummary(response.data);
      setStage('success');
    } catch (err: any) {
      console.error('Import error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to import transactions';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStage('upload');
    setFile(null);
    setParsedData([]);
    setColumnMapping(null);
    setDuplicates([]);
    setError(null);
    setSummary(null);
    onClose();
  };

  const handleComplete = () => {
    handleClose();
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold">Import Transactions</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 rounded-lg flex items-start">
              <AlertCircle className="text-red-600 dark:text-red-400 mr-3 flex-shrink-0" size={20} />
              <div>
                <p className="text-red-800 dark:text-red-200 font-medium">Error</p>
                <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Stage: Upload */}
          {stage === 'upload' && (
            <div>
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center ${
                  dragActive
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  Drop your file here or click to browse
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Supported formats: CSV, XLSX, PDF (max 10MB)
                </p>
                <input
                  type="file"
                  id="file-upload"
                  accept=".csv,.xlsx,.xls,.pdf"
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="btn btn-primary inline-block cursor-pointer"
                >
                  Choose File
                </label>
                {file && (
                  <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                    Selected: {file.name}
                  </p>
                )}
              </div>

              {loading && (
                <div className="mt-6 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600 dark:text-gray-400">Parsing file...</p>
                </div>
              )}
            </div>
          )}

          {/* Stage: Preview */}
          {stage === 'preview' && parsedData && columnMapping && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Preview Transactions</h3>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span>
                    <strong>{parsedData.length}</strong> transactions found
                  </span>
                  {duplicates.length > 0 && (
                    <span className="text-yellow-600 dark:text-yellow-400">
                      <strong>{duplicates.length}</strong> duplicates will be skipped
                    </span>
                  )}
                  <span className="text-green-600 dark:text-green-400">
                    <strong>{parsedData.length - duplicates.length}</strong> will be imported
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Auto-detected columns with {Math.round(columnMapping.confidence * 100)}% confidence
                </p>
              </div>

              <ImportPreviewTable transactions={parsedData} />
            </div>
          )}

          {/* Stage: Success */}
          {stage === 'success' && summary && (
            <div className="text-center py-12">
              <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
              <h3 className="text-2xl font-bold mb-2">Import Successful!</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Imported <strong>{summary.imported}</strong> transactions
                {summary.skipped > 0 && (
                  <>, skipped <strong>{summary.skipped}</strong> duplicates</>
                )}
              </p>
              {summary.errors.length > 0 && (
                <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg text-left">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                    Some errors occurred:
                  </p>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside">
                    {summary.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          {stage === 'upload' && (
            <button onClick={handleClose} className="btn btn-secondary">
              Cancel
            </button>
          )}

          {stage === 'preview' && (
            <>
              <button
                onClick={() => {
                  setStage('upload');
                  setFile(null);
                  setParsedData([]);
                  setError(null);
                }}
                className="btn btn-secondary"
              >
                Back
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={loading || parsedData.filter(t => !t.isDuplicate).length === 0}
                className="btn btn-primary"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Importing...
                  </>
                ) : (
                  `Import ${parsedData.filter(t => !t.isDuplicate).length} Transactions`
                )}
              </button>
            </>
          )}

          {stage === 'success' && (
            <button onClick={handleComplete} className="btn btn-primary">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
