"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Send,
  Save,
  RotateCcw,
  CheckSquare,
  Square,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Building,
  Mail,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface ApplicationDraft {
  id: string;
  contactId: string;
  resumeId: string;
  targetRole?: string | null;
  subject: string;
  greeting: string;
  emailBody: string;
  coverLetter: string;
  validationNotes?: string | null;
  status: string;
  isApproved: boolean;
  version: number;
  contact: {
    id: string;
    name: string;
    email: string;
    company: string;
    role?: string | null;
    isExcluded: boolean;
  };
  resume: {
    id: string;
    originalName: string;
    fileSize: number;
  };
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<ApplicationDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [quickSending, setQuickSending] = useState(false);
  const [targetRole, setTargetRole] = useState("Full Stack Software Engineer");
  const [jobDescription, setJobDescription] = useState("");
  const [tone, setTone] = useState("Professional, confident, and direct");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [expandedCoverLetters, setExpandedCoverLetters] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterApproved, setFilterApproved] = useState<string>("all");

  const loadDrafts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("q", search);
      if (filterApproved === "approved") params.append("approved", "true");
      if (filterApproved === "pending") params.append("approved", "false");

      const res = await fetch(`/api/drafts?${params.toString()}`);
      const data = await res.json();
      setDrafts(data.drafts || []);
    } catch (err: any) {
      toast.error("Failed to load drafts: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrafts();
  }, [search, filterApproved]);

  const handleGenerateAll = async () => {
    try {
      setGenerating(true);
      toast.info("Generating personalized emails with Gemini AI...");
      const res = await fetch("/api/drafts/batch-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole,
          tone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate drafts.");

      toast.success(`Successfully generated ${data.generatedCount} tailored job applications!`);
      loadDrafts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleQuickSendAll = async () => {
    if (
      !confirm(
        "⚡ Start 1-Click Outreach?\n\nGemini will generate personalized emails and cover letters for all valid contacts, automatically approve them, attach your verified resume, and start sending through your Gmail SMTP account.\n\nProceed?"
      )
    )
      return;

    try {
      setQuickSending(true);
      toast.info("1-Click Outreach initiated: generating tailored emails & cover letters...");
      const res = await fetch("/api/campaigns/quick-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole, tone }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start quick outreach.");

      toast.success(data.message);
      window.location.href = "/campaigns";
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setQuickSending(false);
    }
  };

  const handleRegenerateSingle = async (contactId: string) => {
    try {
      toast.info("Regenerating tailored draft...");
      const res = await fetch("/api/drafts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, targetRole, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to regenerate draft.");
      toast.success("Draft updated!");
      loadDrafts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleApprove = async (id: string, currentApproved: boolean) => {
    try {
      const res = await fetch(`/api/drafts/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: !currentApproved }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setDrafts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, isApproved: !currentApproved, status: !currentApproved ? "APPROVED" : "DRAFT" } : d))
      );
      toast.success(!currentApproved ? "Application approved!" : "Approval revoked.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleBatchApprove = async (approve: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.info("Please select at least one application first.");
      return;
    }

    try {
      const res = await fetch("/api/drafts/batch-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftIds: ids, approve }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(approve ? `Approved ${data.updatedCount} applications!` : `Revoked approval for ${data.updatedCount} applications.`);
      loadDrafts();
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaveDraftEdits = async (draft: ApplicationDraft) => {
    try {
      const res = await fetch(`/api/drafts/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: draft.subject,
          emailBody: draft.emailBody,
          coverLetter: draft.coverLetter,
          isApproved: draft.isApproved,
        }),
      });
      if (!res.ok) throw new Error("Failed to save draft edits.");
      toast.success("Draft changes saved!");
      setEditingDraftId(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === drafts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(drafts.map((d) => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleCoverLetter = (id: string) => {
    const next = new Set(expandedCoverLetters);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedCoverLetters(next);
  };

  const approvedCount = drafts.filter((d) => d.isApproved).length;

  return (
    <div className="container py-8 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Personalized AI Applications
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Gemini creates recruiter-tailored emails grounded in your verified resume. Inspect, edit, and approve each message before delivery.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleQuickSendAll}
            disabled={quickSending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-50"
            title="Generates personalized applications for all valid contacts, approves them, and starts sending immediately"
          >
            <Send className="h-4 w-4" />
            {quickSending ? "Tailoring & Sending..." : "⚡ 1-Click: Tailor & Send All"}
          </button>

          {approvedCount > 0 && (
            <Link
              href="/campaigns"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
            >
              <Send className="h-4 w-4" />
              Send {approvedCount} Approved {approvedCount === 1 ? "Email" : "Emails"}
            </Link>
          )}
        </div>
      </div>

      {/* AI Role Configuration Panel */}
      <div className="bg-white rounded-xl border p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            Generation Parameters
          </h2>
          <span className="text-xs text-slate-400">Model: {process.env.GEMINI_MODEL || "gemini-2.5-flash"}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Job Role / Position Title
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Senior Full Stack Engineer, Frontend Architect..."
              className="w-full px-3 py-2 text-sm rounded-lg border bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Communication Tone
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Professional, confident, and direct">Professional, confident, and direct (Recommended)</option>
              <option value="Enthusiastic, innovative, and startup-ready">Enthusiastic, innovative, and startup-ready</option>
              <option value="Technical, project-focused, and concise">Technical, project-focused, and concise</option>
              <option value="Executive and leadership-oriented">Executive and leadership-oriented</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t">
          <span className="text-xs text-slate-500">
            Clicking Generate will synthesize tailored applications. Use 1-Click to generate and dispatch simultaneously.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateAll}
              disabled={generating || quickSending}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {generating ? "Generating..." : "Generate Drafts Only"}
            </button>
            <button
              onClick={handleQuickSendAll}
              disabled={generating || quickSending}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {quickSending ? "Tailoring & Sending..." : "⚡ 1-Click: Tailor & Send All"}
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Selection Toolbar */}
      <div className="bg-white p-3 rounded-xl border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={toggleSelectAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border hover:bg-slate-50 transition"
          >
            {selectedIds.size > 0 && selectedIds.size === drafts.length ? (
              <CheckSquare className="h-4 w-4 text-blue-600" />
            ) : (
              <Square className="h-4 w-4 text-slate-400" />
            )}
            Select All ({selectedIds.size})
          </button>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBatchApprove(true)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
              >
                Approve Selected
              </button>
              <button
                onClick={() => handleBatchApprove(false)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
              >
                Revoke Selected
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="relative flex-1 sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search drafts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <select
            value={filterApproved}
            onChange={(e) => setFilterApproved(e.target.value)}
            className="px-2.5 py-1 text-xs rounded-lg border bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All ({drafts.length})</option>
            <option value="approved">Approved Only ({approvedCount})</option>
            <option value="pending">Pending Approval</option>
          </select>
        </div>
      </div>

      {/* Applications Cards List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
          Loading personalized drafts...
        </div>
      ) : drafts.length > 0 ? (
        <div className="space-y-4">
          {drafts.map((draft) => {
            const isSelected = selectedIds.has(draft.id);
            const isEditing = editingDraftId === draft.id;
            const isExpanded = expandedCoverLetters.has(draft.id);

            return (
              <div
                key={draft.id}
                className={`bg-white rounded-xl border transition shadow-xs overflow-hidden ${
                  draft.isApproved ? "border-emerald-300 ring-1 ring-emerald-200" : "hover:border-slate-300"
                }`}
              >
                {/* Draft Card Header */}
                <div className="p-4 bg-slate-50/70 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelect(draft.id)}
                      className="text-slate-400 hover:text-slate-600 transition"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          {draft.contact.name}
                        </span>
                        <span className="text-slate-400 text-xs">•</span>
                        <span className="font-medium text-slate-700 text-xs flex items-center gap-1">
                          <Building className="h-3.5 w-3.5 text-slate-400" />
                          {draft.contact.company}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5 flex items-center gap-1">
                        <Mail className="h-3 w-3 text-slate-400" />
                        {draft.contact.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Resume Attachment Badge */}
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200"
                      title="This verified file will be sent as email attachment"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {draft.resume.originalName}
                    </span>

                    {/* Status Badge */}
                    {draft.status === "SENT" ? (
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                        Sent
                      </span>
                    ) : draft.isApproved ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
                        Pending Review
                      </span>
                    )}

                    {/* Approval Action */}
                    <button
                      onClick={() => handleToggleApprove(draft.id, draft.isApproved)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        draft.isApproved
                          ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      }`}
                    >
                      {draft.isApproved ? "Revoke Approval" : "Approve"}
                    </button>
                  </div>
                </div>

                {/* Draft Content */}
                <div className="p-5 space-y-4">
                  {/* Subject Line */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Subject Line
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={draft.subject}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDrafts((prev) =>
                            prev.map((d) => (d.id === draft.id ? { ...d, subject: val } : d))
                          );
                        }}
                        className="w-full px-3 py-1.5 text-sm font-semibold rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="text-sm font-semibold text-slate-900 bg-slate-50/50 p-2.5 rounded-lg border">
                        {draft.subject}
                      </div>
                    )}
                  </div>

                  {/* Email Body */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Email Body (Delivered to Recruiter)
                    </label>
                    {isEditing ? (
                      <textarea
                        rows={7}
                        value={draft.emailBody}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDrafts((prev) =>
                            prev.map((d) => (d.id === draft.id ? { ...d, emailBody: val } : d))
                          );
                        }}
                        className="w-full px-3 py-2 text-sm rounded-lg border font-sans focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="text-sm text-slate-800 bg-slate-50/30 p-3 rounded-lg border whitespace-pre-wrap leading-relaxed font-sans">
                        {draft.emailBody}
                      </div>
                    )}
                  </div>

                  {/* Cover Letter Collapsible */}
                  {draft.coverLetter && (
                    <div className="border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleCoverLetter(draft.id)}
                        className="w-full px-3.5 py-2 bg-slate-50 hover:bg-slate-100/70 text-left text-xs font-semibold text-slate-700 flex items-center justify-between transition"
                      >
                        <span className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-blue-600" />
                          View Detailed Tailored Cover Letter
                        </span>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      {isExpanded && (
                        <div className="p-4 bg-white text-xs text-slate-700 whitespace-pre-wrap border-t leading-relaxed">
                          {isEditing ? (
                            <textarea
                              rows={8}
                              value={draft.coverLetter}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDrafts((prev) =>
                                  prev.map((d) => (d.id === draft.id ? { ...d, coverLetter: val } : d))
                                );
                              }}
                              className="w-full p-2 border rounded"
                            />
                          ) : (
                            draft.coverLetter
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <span className="text-[11px] text-slate-400">
                      {draft.validationNotes || "Grounded strictly on uploaded resume."}
                    </span>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <button
                          onClick={() => handleSaveDraftEdits(draft)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                        >
                          <Save className="h-3.5 w-3.5" /> Save Changes
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingDraftId(draft.id)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition"
                        >
                          Edit Text
                        </button>
                      )}

                      <button
                        onClick={() => handleRegenerateSingle(draft.contact.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Regenerate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-12 text-center text-slate-400 space-y-3">
          <Sparkles className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-700 text-base">No Drafts Generated Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Click &ldquo;Generate Applications for All Valid Contacts&rdquo; above to have Google Gemini compose personalized job emails.
          </p>
        </div>
      )}
    </div>
  );
}

