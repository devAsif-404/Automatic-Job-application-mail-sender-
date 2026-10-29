"use client";

import { useState, useEffect } from "react";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Pause,
  Play,
  XCircle,
  Download,
  RefreshCw,
  FileText,
  Mail,
  Building,
  User,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { SendConfirmationModal } from "@/components/SendConfirmationModal";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalCount: number;
  pendingCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  delayMs: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface CampaignDetail extends Campaign {
  jobs: Array<{
    id: string;
    status: string;
    attempts: number;
    lastError?: string;
    smtpMessageId?: string;
    acceptedAt?: string;
    createdAt: string;
    contact: {
      name: string;
      email: string;
      company: string;
    };
    draft: {
      subject: string;
      targetRole?: string;
    };
    attemptsList: Array<{
      status: string;
      response?: string;
      errorMessage?: string;
      durationMs?: number;
    }>;
  }>;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvedDrafts, setApprovedDrafts] = useState<any[]>([]);
  const [resumeName, setResumeName] = useState<string>("");
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch("/api/campaigns");
      const data = await res.json();
      setCampaigns(data.campaigns || []);

      if (data.campaigns?.length > 0 && !activeCampaign) {
        loadCampaignDetail(data.campaigns[0].id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      const data = await res.json();
      if (data.campaign) {
        setActiveCampaign(data.campaign);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadApprovedDrafts = async () => {
    try {
      const res = await fetch("/api/drafts?approved=true");
      const data = await res.json();
      setApprovedDrafts(data.drafts || []);

      const resumeRes = await fetch("/api/resume/current");
      const resumeData = await resumeRes.json();
      if (resumeData.resume) {
        setResumeName(resumeData.resume.originalName);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    loadApprovedDrafts();
    const interval = setInterval(() => {
      fetchCampaigns();
      if (activeCampaign && (activeCampaign.status === "RUNNING" || activeCampaign.status === "PENDING")) {
        loadCampaignDetail(activeCampaign.id);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [activeCampaign?.id, activeCampaign?.status]);

  const handleStartBatch = async (params: {
    campaignName: string;
    delayMs: number;
    concurrency: number;
  }) => {
    const contactIds = approvedDrafts.map((d) => d.contactId);
    if (contactIds.length === 0) {
      throw new Error("No approved applications to send. Please approve drafts first.");
    }

    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignName: params.campaignName,
        contactIds,
        delayMs: params.delayMs,
        concurrency: params.concurrency,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to start campaign.");

    toast.success(`Batch started! Queued ${data.totalQueued} applications.`);
    await fetchCampaigns();
    await loadCampaignDetail(data.campaignId);
    await loadApprovedDrafts();
  };

  const handlePause = async (id: string) => {
    try {
      const res = await fetch(`/api/campaigns/${id}/pause`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to pause campaign.");
      toast.info("Campaign paused.");
      loadCampaignDetail(id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleResume = async (id: string) => {
    try {
      const res = await fetch(`/api/campaigns/${id}/resume`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to resume campaign.");
      toast.success("Campaign resumed.");
      loadCampaignDetail(id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel the rest of this campaign?")) return;
    try {
      const res = await fetch(`/api/campaigns/${id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to cancel campaign.");
      toast.warning("Campaign cancelled.");
      loadCampaignDetail(id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="container py-8 max-w-7xl space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Outreach Campaigns & Delivery History
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Monitor bulk sending pipelines, inspect SMTP server acceptance receipts, and export application logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSendModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
          >
            <Plus className="h-4 w-4" />
            New Batch ({approvedDrafts.length} Approved)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaigns List (Left Sidebar) */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            All Campaigns ({campaigns.length})
          </h2>

          <div className="space-y-2">
            {campaigns.map((camp) => {
              const isSelected = activeCampaign?.id === camp.id;
              const percent =
                camp.totalCount > 0
                  ? Math.round(((camp.sentCount + camp.failedCount + camp.skippedCount) / camp.totalCount) * 100)
                  : 0;

              return (
                <button
                  key={camp.id}
                  onClick={() => loadCampaignDetail(camp.id)}
                  className={`w-full text-left p-4 rounded-xl border transition shadow-xs ${
                    isSelected
                      ? "bg-blue-50/50 border-blue-400 ring-1 ring-blue-200"
                      : "bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-slate-900 truncate" title={camp.name}>
                      {camp.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        camp.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800"
                          : camp.status === "RUNNING"
                          ? "bg-blue-100 text-blue-800 animate-pulse"
                          : camp.status === "PAUSED"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {camp.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 mb-2">
                    {new Date(camp.createdAt).toLocaleDateString()} • {camp.totalCount} recipients
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${
                        camp.status === "COMPLETED" ? "bg-emerald-500" : "bg-blue-600"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-500 mt-2">
                    <span>
                      ✓ {camp.sentCount} sent
                      {camp.failedCount > 0 && <span className="text-rose-600 ml-1.5">✕ {camp.failedCount} failed</span>}
                    </span>
                    <span>{percent}%</span>
                  </div>
                </button>
              );
            })}

            {campaigns.length === 0 && !loading && (
              <div className="p-8 text-center bg-white rounded-xl border text-slate-400 text-sm">
                No campaigns yet. Click &ldquo;New Batch&rdquo; to launch outreach.
              </div>
            )}
          </div>
        </div>

        {/* Selected Campaign Details & Job Audit (Right 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {activeCampaign ? (
            <>
              {/* Campaign Status Card */}
              <div className="bg-white rounded-xl border p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{activeCampaign.name}</h2>
                    <p className="text-xs text-slate-500">
                      Started: {activeCampaign.startedAt ? new Date(activeCampaign.startedAt).toLocaleString() : "Pending"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/campaigns/${activeCampaign.id}/export`}
                      download
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border hover:bg-slate-50 text-slate-700 transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export Log CSV
                    </a>

                    {activeCampaign.status === "RUNNING" && (
                      <button
                        onClick={() => handlePause(activeCampaign.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 transition"
                      >
                        <Pause className="h-3.5 w-3.5" /> Pause
                      </button>
                    )}

                    {activeCampaign.status === "PAUSED" && (
                      <button
                        onClick={() => handleResume(activeCampaign.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                      >
                        <Play className="h-3.5 w-3.5" /> Resume
                      </button>
                    )}

                    {(activeCampaign.status === "RUNNING" || activeCampaign.status === "PAUSED") && (
                      <button
                        onClick={() => handleCancel(activeCampaign.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Counters row */}
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="text-xs text-slate-500 uppercase font-semibold">Total</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">{activeCampaign.totalCount}</div>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg">
                    <div className="text-xs uppercase font-semibold">SMTP Accepted</div>
                    <div className="text-xl font-bold mt-1">{activeCampaign.sentCount}</div>
                  </div>
                  <div className="p-3 bg-rose-50 text-rose-800 rounded-lg">
                    <div className="text-xs uppercase font-semibold">Failed</div>
                    <div className="text-xl font-bold mt-1">{activeCampaign.failedCount}</div>
                  </div>
                  <div className="p-3 bg-slate-50 text-slate-600 rounded-lg">
                    <div className="text-xs uppercase font-semibold">Pending / Skipped</div>
                    <div className="text-xl font-bold mt-1">
                      {activeCampaign.pendingCount + activeCampaign.skippedCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Jobs Table */}
              <div className="bg-white rounded-xl border shadow-xs overflow-hidden">
                <div className="px-5 py-3 border-b bg-slate-50/70 font-semibold text-xs text-slate-700">
                  Individual Message Deliveries ({activeCampaign.jobs?.length || 0})
                </div>

                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b sticky top-0">
                      <tr>
                        <th className="px-5 py-3">Recipient & Company</th>
                        <th className="px-5 py-3">Subject</th>
                        <th className="px-5 py-3">Delivery Status</th>
                        <th className="px-5 py-3">SMTP Diagnostics</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeCampaign.jobs?.map((job) => (
                        <tr key={job.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-5 py-3">
                            <div className="font-semibold text-slate-900 text-xs">{job.contact.name}</div>
                            <div className="text-[11px] text-slate-500">
                              {job.contact.company} • {job.contact.email}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-xs max-w-xs truncate text-slate-700">
                            {job.draft.subject}
                          </td>
                          <td className="px-5 py-3">
                            {job.status === "SENT" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3" /> Accepted by SMTP
                              </span>
                            ) : job.status === "FAILED" ? (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200"
                                title={job.lastError || "Failed"}
                              >
                                <AlertCircle className="h-3 w-3" /> Failed
                              </span>
                            ) : job.status === "SKIPPED" ? (
                              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                Skipped
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                <Clock className="h-3 w-3" /> {job.status}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-xs font-mono text-slate-500">
                            {job.smtpMessageId ? (
                              <span className="text-slate-700 text-[11px]" title={job.smtpMessageId}>
                                ID: {job.smtpMessageId.slice(0, 18)}...
                              </span>
                            ) : job.lastError ? (
                              <span className="text-rose-600 text-[11px] truncate block max-w-xs" title={job.lastError}>
                                {job.lastError}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl border p-12 text-center text-slate-400 text-sm">
              Select a campaign from the left sidebar to view its live progress.
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <SendConfirmationModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        approvedCount={approvedDrafts.length}
        approvedDrafts={approvedDrafts}
        resumeName={resumeName}
        onConfirmBatch={handleStartBatch}
      />
    </div>
  );
}
