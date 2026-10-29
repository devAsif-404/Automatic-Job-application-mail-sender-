"use client";

import { useState } from "react";
import { ColumnMapping } from "@/lib/parsers/csv-excel";
import { AlertCircle, Check, Columns } from "lucide-react";

interface ContactMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  initialMapping: ColumnMapping;
  contactListId: string;
  onMappingApplied: (newStats: any) => void;
}

export function ContactMappingModal({
  isOpen,
  onClose,
  headers,
  initialMapping,
  contactListId,
  onMappingApplied,
}: ContactMappingModalProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapping.nameColumn || !mapping.emailColumn || !mapping.companyColumn) {
      setError("Please select headers for HR Name, HR Email, and Company Name.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/contacts/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactListId, mapping }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply column mapping.");
      onMappingApplied(data.stats);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in-50 zoom-in-95">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <Columns className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Map Spreadsheet Columns</h3>
            <p className="text-xs text-slate-500">
              Select which columns match the required contact fields.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              HR / Recruiter Name Column <span className="text-rose-500">*</span>
            </label>
            <select
              value={mapping.nameColumn}
              onChange={(e) => setMapping({ ...mapping, nameColumn: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Select Column --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              HR Email Address Column <span className="text-rose-500">*</span>
            </label>
            <select
              value={mapping.emailColumn}
              onChange={(e) => setMapping({ ...mapping, emailColumn: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Select Column --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Company Name Column <span className="text-rose-500">*</span>
            </label>
            <select
              value={mapping.companyColumn}
              onChange={(e) => setMapping({ ...mapping, companyColumn: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Select Column --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Job Title / Role Column (Optional)
            </label>
            <select
              value={mapping.roleColumn || ""}
              onChange={(e) => setMapping({ ...mapping, roleColumn: e.target.value || undefined })}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- None / General Application --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Job Description / Notes Column (Optional)
            </label>
            <select
              value={mapping.jobDescColumn || ""}
              onChange={(e) => setMapping({ ...mapping, jobDescColumn: e.target.value || undefined })}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- None --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {loading ? "Processing..." : "Apply Mapping"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
