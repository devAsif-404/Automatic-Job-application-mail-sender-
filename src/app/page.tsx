"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Users,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

interface DashboardStats {
  contacts: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  };
  drafts: {
    generated: number;
    approved: number;
  };
  sending: {
    sent: number;
    failed: number;
    skipped: number;
  };
  campaignsCount: number;
  currentResume: {
    id: string;
    originalName: string;
    fileSize: number;
    createdAt: string;
    candidateName: string;
  } | null;
  recentActivity: Array<{
    id: string;
    status: string;
    acceptedAt?: string;
    createdAt: string;
    lastError?: string;
    contact: {
      name: string;
      email: string;
      company: string;
    };
    draft: {
      subject: string;
    };
    campaign: {
      name: string;
    };
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 6000);
    return () => clearInterval(interval);
  }, []);

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 KB";
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="container py-8 max-w-7xl space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Job Application Command Center
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            End-to-end recruiter outreach automated with your verified resume, Gemini AI, and SMTP delivery.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchStats}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
          >
            <Send className="h-4 w-4" />
            Send Approved Batch
          </Link>
        </div>
      </div>

      {/* Guided Workflow Progression Bar */}
      <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-blue-900 mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600" />
          5-Step Application Workflow
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Step 1 */}
          <Link
            href="/resume"
            className="group flex flex-col p-3 rounded-lg border bg-white hover:border-blue-400 transition shadow-xs"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-blue-600">STEP 1</span>
              {stats?.currentResume ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-amber-500" />
              )}
            </div>
            <span className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition">
              Upload Resume
            </span>
            <span className="text-xs text-slate-500 mt-1 line-clamp-1">
              {stats?.currentResume ? stats.currentResume.originalName : "PDF or DOCX file"}
            </span>
          </Link>

          {/* Step 2 */}
          <Link
            href="/contacts"
            className="group flex flex-col p-3 rounded-lg border bg-white hover:border-blue-400 transition shadow-xs"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-blue-600">STEP 2</span>
              {(stats?.contacts?.valid ?? 0) > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-amber-500" />
              )}
            </div>
            <span className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition">
              Import Contacts
            </span>
            <span className="text-xs text-slate-500 mt-1">
              {(stats?.contacts?.valid ?? 0)} valid contacts
            </span>
          </Link>

          {/* Step 3 */}
          <Link
            href="/drafts"
            className="group flex flex-col p-3 rounded-lg border bg-white hover:border-blue-400 transition shadow-xs"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-blue-600">STEP 3</span>
              {(stats?.drafts?.generated ?? 0) > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-300" />
              )}
            </div>
            <span className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition">
              Generate AI Drafts
            </span>
            <span className="text-xs text-slate-500 mt-1">
              {(stats?.drafts?.generated ?? 0)} generated
            </span>
          </Link>

          {/* Step 4 */}
          <Link
            href="/drafts?approved=true"
            className="group flex flex-col p-3 rounded-lg border bg-white hover:border-blue-400 transition shadow-xs"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-blue-600">STEP 4</span>
              {(stats?.drafts?.approved ?? 0) > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-300" />
              )}
            </div>
            <span className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition">
              Review & Approve
            </span>
            <span className="text-xs text-slate-500 mt-1">
              {(stats?.drafts?.approved ?? 0)} approved for sending
            </span>
          </Link>

          {/* Step 5 */}
          <Link
            href="/campaigns"
            className="group flex flex-col p-3 rounded-lg border bg-white hover:border-blue-400 transition shadow-xs"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-blue-600">STEP 5</span>
              {(stats?.sending?.sent ?? 0) > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-300" />
              )}
            </div>
            <span className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition">
              Send Batch
            </span>
            <span className="text-xs text-slate-500 mt-1">
              {(stats?.sending?.sent ?? 0)} accepted by SMTP
            </span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Contacts Card */}
        <div className="bg-white p-5 rounded-xl border shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Contacts
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900">
              {stats?.contacts?.total ?? 0}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 flex-wrap">
              <span className="inline-flex items-center text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                ✓ {stats?.contacts?.valid ?? 0} valid
              </span>
              {(stats?.contacts?.invalid ?? 0) > 0 && (
                <span className="inline-flex items-center text-rose-700 font-medium bg-rose-50 px-1.5 py-0.5 rounded">
                  ✕ {stats?.contacts?.invalid ?? 0} invalid
                </span>
              )}
              {(stats?.contacts?.duplicates ?? 0) > 0 && (
                <span className="inline-flex items-center text-amber-700 font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                  ⚠ {stats?.contacts?.duplicates ?? 0} dups
                </span>
              )}
            </div>
          </div>
          <Link
            href="/contacts"
            className="text-xs font-medium text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 pt-1"
          >
            Manage contacts <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* AI Drafts Card */}
        <div className="bg-white p-5 rounded-xl border shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              AI Applications
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900">
              {stats?.drafts?.generated ?? 0}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
              <span className="inline-flex items-center text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                {stats?.drafts?.approved ?? 0} Approved
              </span>
              <span className="text-slate-400">
                ({(stats?.drafts?.generated ?? 0) - (stats?.drafts?.approved ?? 0)} pending review)
              </span>
            </div>
          </div>
          <Link
            href="/drafts"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 pt-1"
          >
            Review drafts <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Emails Accepted Card */}
        <div className="bg-white p-5 rounded-xl border shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Accepted by SMTP
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-emerald-700">
              {stats?.sending?.sent ?? 0}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
              <span className="text-rose-600 font-medium">
                {stats?.sending?.failed ?? 0} failed
              </span>
              <span>•</span>
              <span className="text-slate-500">
                {stats?.sending?.skipped ?? 0} skipped
              </span>
            </div>
          </div>
          <Link
            href="/campaigns"
            className="text-xs font-medium text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1 pt-1"
          >
            View campaign logs <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Active Resume Card */}
        <div className="bg-white p-5 rounded-xl border shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Attached Resume
            </span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div>
            {stats?.currentResume ? (
              <>
                <div className="font-bold text-slate-900 text-sm truncate" title={stats.currentResume.originalName}>
                  {stats.currentResume.originalName}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Candidate: <strong className="text-slate-700">{stats.currentResume.candidateName || "Verified"}</strong>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Size: {formatFileSize(stats.currentResume.fileSize)}
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-400 py-1">No resume uploaded yet</div>
            )}
          </div>
          <Link
            href="/resume"
            className="text-xs font-medium text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 pt-1"
          >
            {stats?.currentResume ? "Inspect / replace" : "Upload now"} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Recent Application History Section */}
      <div className="bg-white rounded-xl border shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Recent Application Activity</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time audit log of accepted messages and delivery attempts.
            </p>
          </div>
          <Link
            href="/campaigns"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            Full history →
          </Link>
        </div>

        {stats?.recentActivity && stats.recentActivity.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b">
                <tr>
                  <th className="px-6 py-3">Recipient & Company</th>
                  <th className="px-6 py-3">Subject</th>
                  <th className="px-6 py-3">Campaign</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recentActivity.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-slate-900">{act.contact.name}</div>
                      <div className="text-xs text-slate-500">
                        {act.contact.company} • {act.contact.email}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 max-w-xs truncate text-xs font-medium text-slate-700">
                      {act.draft?.subject || "Job Application"}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-500">
                      {act.campaign?.name || "Outreach"}
                    </td>
                    <td className="px-6 py-3.5">
                      {act.status === "SENT" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> Accepted by SMTP
                        </span>
                      ) : act.status === "FAILED" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200" title={act.lastError || "Failed"}>
                          <AlertCircle className="h-3 w-3" /> Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          <Clock className="h-3 w-3" /> {act.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right text-xs text-slate-400">
                      {new Date(act.acceptedAt || act.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-sm">
            <Send className="h-8 w-8 mx-auto text-slate-300 mb-2" />
            No application activity yet. Upload your resume and contacts to begin.
          </div>
        )}
      </div>
    </div>
  );
}
