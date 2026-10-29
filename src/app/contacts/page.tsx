"use client";

import { useState, useEffect, useRef } from "react";
import {
  Upload,
  Users,
  Search,
  Filter,
  Download,
  AlertCircle,
  CheckCircle2,
  Trash2,
  EyeOff,
  Eye,
  Columns,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ContactMappingModal } from "@/components/ContactMappingModal";
import Link from "next/link";

interface Contact {
  id: string;
  rowNumber: number;
  name: string;
  email: string;
  normalizedEmail: string;
  company: string;
  role?: string | null;
  isValid: boolean;
  validationErrors?: string | null;
  isDuplicate: boolean;
  isExcluded: boolean;
  drafts?: any[];
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Mapping modal state
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [modalHeaders, setModalHeaders] = useState<string[]>([]);
  const [modalMapping, setModalMapping] = useState<any>(null);
  const [currentListId, setCurrentListId] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        filter: statusFilter,
        q: search,
        page: String(page),
        limit: "50",
      });
      const res = await fetch(`/api/contacts?${params.toString()}`);
      const data = await res.json();
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      toast.error("Failed to load contacts: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [search, statusFilter, page]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);
      toast.info("Importing spreadsheet and validating contact rows...");
      const res = await fetch("/api/contacts/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process contact spreadsheet.");

      toast.success(
        `Imported ${data.stats.totalRows} contacts (${data.stats.validCount} valid, ${data.stats.invalidCount} invalid, ${data.stats.duplicateCount} duplicates)`
      );

      if (data.isAmbiguous) {
        toast.info("Column names were ambiguous. Please confirm column mapping.");
        setModalHeaders(data.headers);
        setModalMapping(data.suggestedMapping);
        setCurrentListId(data.contactListId);
        setIsMappingOpen(true);
      }

      loadContacts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleToggleExclude = async (id: string) => {
    try {
      const res = await fetch(`/api/contacts/${id}/exclude`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContacts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isExcluded: data.contact.isExcluded } : c))
      );
      toast.success(data.contact.isExcluded ? "Contact excluded." : "Contact re-included.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete contact.");
      setContacts((prev) => prev.filter((c) => c.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      toast.success("Contact removed.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Delete ALL imported contacts? This will also remove associated drafts.")) return;
    try {
      const res = await fetch("/api/contacts", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear contacts.");
      setContacts([]);
      setTotal(0);
      toast.success("All contacts deleted.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="container py-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            HR Contact Database
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Import Excel or CSV files, map recruiter columns, inspect validation errors, and exclude contacts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/contacts/export"
            download
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition"
          >
            <Download className="h-4 w-4" />
            Export Validation CSV
          </a>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Importing..." : "Upload Excel / CSV"}
          </button>
        </div>
      </div>

      {/* Action / Filter Bar */}
      <div className="bg-white p-4 rounded-xl border shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by recruiter name, email, company, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Contacts ({total})</option>
              <option value="valid">Valid & Active</option>
              <option value="invalid">Invalid Rows</option>
              <option value="duplicate">Duplicates</option>
              <option value="excluded">Excluded</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {total > 0 && (
            <>
              <Link
                href="/drafts"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition"
              >
                <Sparkles className="h-3.5 w-3.5" /> Generate AI Drafts
              </Link>
              <button
                onClick={handleDeleteAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 transition"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white rounded-xl border shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
            Loading contacts...
          </div>
        ) : contacts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b">
                <tr>
                  <th className="px-5 py-3 w-14 text-center">Row</th>
                  <th className="px-5 py-3">HR / Recruiter Name</th>
                  <th className="px-5 py-3">HR Email Address</th>
                  <th className="px-5 py-3">Company Name</th>
                  <th className="px-5 py-3">Target Role</th>
                  <th className="px-5 py-3">Validation Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className={`hover:bg-slate-50/70 transition ${
                      contact.isExcluded ? "opacity-50 bg-slate-50/40" : ""
                    }`}
                  >
                    <td className="px-5 py-3.5 text-center text-xs font-mono text-slate-400">
                      {contact.rowNumber}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      {contact.name}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600">
                      {contact.email}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      {contact.company}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {contact.role || <span className="text-slate-400 italic">General SWE</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {contact.isExcluded ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          Excluded
                        </span>
                      ) : !contact.isValid ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 cursor-help"
                          title={contact.validationErrors || "Invalid row"}
                        >
                          <AlertCircle className="h-3 w-3" /> Invalid
                        </span>
                      ) : contact.isDuplicate ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Duplicate Email
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> Valid
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1">
                      <button
                        onClick={() => handleToggleExclude(contact.id)}
                        className={`p-1.5 rounded-md hover:bg-slate-100 transition ${
                          contact.isExcluded ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                        }`}
                        title={contact.isExcluded ? "Re-include contact" : "Exclude from outreach"}
                      >
                        {contact.isExcluded ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteContact(contact.id)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition"
                        title="Delete contact"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400 text-sm">
            <Users className="h-8 w-8 mx-auto text-slate-300 mb-2" />
            No contacts match the current filter. Upload an Excel (.xlsx) or CSV file above.
          </div>
        )}
      </div>

      {/* Column Mapping Modal */}
      {modalMapping && (
        <ContactMappingModal
          isOpen={isMappingOpen}
          onClose={() => setIsMappingOpen(false)}
          headers={modalHeaders}
          initialMapping={modalMapping}
          contactListId={currentListId}
          onMappingApplied={() => loadContacts()}
        />
      )}
    </div>
  );
}

