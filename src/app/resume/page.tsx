"use client";

import { useState, useEffect, useRef } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Save,
  Download,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface StructuredProfile {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  education: Array<{
    institution: string;
    degree: string;
    fieldOfStudy: string;
    graduationYear: string;
  }>;
  skills: string[];
  experience: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    highlights: string[];
  }>;
  projects: Array<{
    name: string;
    description: string;
    technologies: string[];
    link?: string;
  }>;
  certifications: string[];
  achievements: string[];
  tools: string[];
}

export default function ResumePage() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resumeMeta, setResumeMeta] = useState<any | null>(null);
  const [profile, setProfile] = useState<StructuredProfile | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadResume = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/resume/current");
      const data = await res.json();
      if (data.resume) {
        setResumeMeta(data.resume);
        setProfile(data.resume.structuredData);
      }
    } catch (err: any) {
      toast.error("Failed to load resume details: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResume();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);
      toast.info("Extracting and parsing resume text...");
      const res = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process resume.");
      }

      setResumeMeta(data.resume);
      setProfile(data.resume.structuredData);
      toast.success("Resume uploaded and parsed successfully!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    try {
      setSaving(true);
      const res = await fetch("/api/resume/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structuredData: profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile changes.");
      toast.success("Resume profile saved! All generated emails will use these facts.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    if (!newSkill.trim() || !profile) return;
    if (profile.skills.includes(newSkill.trim())) {
      toast.info("Skill already exists in list.");
      return;
    }
    setProfile({
      ...profile,
      skills: [...profile.skills, newSkill.trim()],
    });
    setNewSkill("");
  };

  const removeSkill = (skillToRemove: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      skills: profile.skills.filter((s) => s !== skillToRemove),
    });
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 KB";
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="container py-8 max-w-5xl space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Resume Profile & Attachment
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Your uploaded resume serves as the sole source of truth for all AI-generated application letters and is attached to every outgoing email.
          </p>
        </div>
        {profile && (
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Corrections"}
          </button>
        )}
      </div>

      {/* Upload Box / Active Card */}
      <div className="bg-white rounded-xl border p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              {resumeMeta ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-base">{resumeMeta.originalName}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" /> Active Attachment
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Uploaded: {new Date(resumeMeta.createdAt).toLocaleDateString()} • Size: {formatFileSize(resumeMeta.fileSize)}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-bold text-slate-900 text-base">No Resume Uploaded</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Upload your master PDF or DOCX resume to start tailoring applications.
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {resumeMeta && (
              <a
                href="/api/resume/download"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition"
              >
                <Download className="h-3.5 w-3.5" />
                Preview File
              </a>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Extracting..." : resumeMeta ? "Replace Resume" : "Upload Resume (PDF/DOCX)"}
            </button>
          </div>
        </div>

        {/* Structured Data Editor */}
        {profile ? (
          <div className="space-y-6 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                Verified Candidate Profile
              </h2>
              <span className="text-xs text-slate-400">
                Double-check any extracted field. Gemini will strictly rely on these details.
              </span>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                />
              </div>
            </div>

            {/* Professional Summary */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Professional Summary</label>
              <textarea
                rows={3}
                value={profile.summary}
                onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              />
            </div>

            {/* Skills Tag Management */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Technical Skills & Tools ({profile.skills.length})
              </label>
              <div className="flex flex-wrap gap-1.5 mb-3 p-3 bg-slate-50 rounded-lg border min-h-[48px]">
                {profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-white border border-slate-200 text-slate-800 shadow-xs"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="text-slate-400 hover:text-rose-600 transition"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add skill (e.g. Next.js, PostgreSQL, TypeScript)..."
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border transition"
                >
                  <Plus className="h-3.5 w-3.5 inline mr-1" /> Add
                </button>
              </div>
            </div>

            {/* Featured Projects */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Key Projects ({profile.projects.length})
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setProfile({
                      ...profile,
                      projects: [
                        ...profile.projects,
                        { name: "New Project", description: "Project description", technologies: [] },
                      ],
                    })
                  }
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Add Project
                </button>
              </div>
              <div className="space-y-3">
                {profile.projects.map((proj, idx) => (
                  <div key={idx} className="p-3 bg-slate-50/70 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={proj.name}
                        onChange={(e) => {
                          const updated = [...profile.projects];
                          updated[idx].name = e.target.value;
                          setProfile({ ...profile, projects: updated });
                        }}
                        className="font-semibold text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setProfile({
                            ...profile,
                            projects: profile.projects.filter((_, i) => i !== idx),
                          });
                        }}
                        className="text-slate-400 hover:text-rose-600 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={proj.description}
                      onChange={(e) => {
                        const updated = [...profile.projects];
                        updated[idx].description = e.target.value;
                        setProfile({ ...profile, projects: updated });
                      }}
                      className="w-full text-xs p-2 rounded border bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
            Loading resume profile...
          </div>
        ) : null}
      </div>
    </div>
  );
}

