import React, { useState } from 'react';
import { Terminal, CheckCircle2, XCircle, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { FetchRunLog } from '../types.js';

interface IngestionLogsPanelProps {
  logs: FetchRunLog[];
  onRefresh: () => void;
}

export const IngestionLogsPanel: React.FC<IngestionLogsPanelProps> = ({ logs, onRefresh }) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredLogs = logs.filter((log) => {
    if (filterStatus === 'all') return true;
    return log.status === filterStatus;
  });

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-stone-700" />
          <div>
            <h2 className="text-sm font-semibold text-stone-900">
              Ingestion Run Audit Logs
            </h2>
            <p className="text-[11px] text-stone-500">
              Audit trail of every background and on-demand connector execution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-700 focus:outline-none"
          >
            <option value="all">All Runs ({logs.length})</option>
            <option value="success">Success Only</option>
            <option value="failed">Failed / Errors Only</option>
          </select>

          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-stone-200 bg-stone-50 text-[11px] font-semibold text-stone-500">
              <tr>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5">Started At</th>
                <th className="px-4 py-2.5">Duration</th>
                <th className="px-4 py-2.5">Received</th>
                <th className="px-4 py-2.5">Inserted</th>
                <th className="px-4 py-2.5">Duplicates</th>
                <th className="px-4 py-2.5">Run ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-stone-400 font-sans">
                    No ingestion run logs recorded yet.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isSuccess = log.status === 'success';
                  return (
                    <tr key={log.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="px-4 py-2.5">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 font-sans">
                            <CheckCircle2 className="h-3 w-3" /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 font-sans">
                            <XCircle className="h-3 w-3" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-sans font-medium text-stone-800">
                        {log.sourceName}
                      </td>
                      <td className="px-4 py-2.5 text-stone-500 text-[11px]">
                        {new Date(log.startedAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2.5 text-stone-600">
                        {log.durationMs}ms
                      </td>
                      <td className="px-4 py-2.5 text-stone-600">
                        {log.itemsReceived}
                      </td>
                      <td className="px-4 py-2.5 text-emerald-600 font-semibold">
                        +{log.itemsInserted}
                      </td>
                      <td className="px-4 py-2.5 text-purple-600">
                        {log.itemsDuplicate}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-stone-400 truncate max-w-[120px]">
                        {log.id}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
