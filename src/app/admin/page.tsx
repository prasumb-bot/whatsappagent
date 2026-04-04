"use client";

import { useEffect, useState, useMemo, useCallback } from "react";

interface Business {
  id: string;
  name: string;
  phone_number_id: string;
  created_at: string;
}

interface BusinessForm {
  name: string;
  phone_number_id: string;
  access_token: string;
  system_prompt: string;
  webhook_verify_token: string;
}

const EMPTY_FORM: BusinessForm = {
  name: "",
  phone_number_id: "",
  access_token: "",
  system_prompt: "",
  webhook_verify_token: "",
};

export default function AdminPanel() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [form, setForm] = useState<BusinessForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [businessDetails, setBusinessDetails] = useState<
    Record<string, BusinessForm>
  >({});

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_DASHBOARD_TOKEN}`,
    }),
    []
  );

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const fetchBusinesses = useCallback(async () => {
    const res = await fetch("/api/businesses", { headers: authHeaders });
    const data = await res.json();
    if (Array.isArray(data)) setBusinesses(data);
  }, [authHeaders]);

  const fetchBusinessDetail = useCallback(
    async (id: string) => {
      if (businessDetails[id]) return;
      const res = await fetch(`/api/businesses/${id}`, {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        setBusinessDetails((prev) => ({ ...prev, [id]: data }));
      }
    },
    [authHeaders, businessDetails]
  );

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  function handleChange(field: keyof BusinessForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.name ||
      !form.phone_number_id ||
      !form.access_token ||
      !form.system_prompt
    ) {
      showToast("Please fill all required fields", "error");
      return;
    }

    setSaving(true);

    const url = editingId
      ? `/api/businesses/${editingId}`
      : "/api/businesses";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: authHeaders,
      body: JSON.stringify(form),
    });

    if (res.ok) {
      showToast(
        editingId ? "Business updated" : "Business created",
        "success"
      );
      setForm(EMPTY_FORM);
      setEditingId(null);
      setShowForm(false);
      setBusinessDetails({});
      fetchBusinesses();
    } else {
      const err = await res.json();
      showToast(err.error || "Something went wrong", "error");
    }

    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        "Delete this business? All conversations and messages will be permanently lost."
      )
    )
      return;

    setDeleting(id);

    const res = await fetch(`/api/businesses/${id}`, {
      method: "DELETE",
      headers: authHeaders,
    });

    if (res.ok) {
      showToast("Business deleted", "success");
      setBusinessDetails((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      fetchBusinesses();
    } else {
      showToast("Failed to delete", "error");
    }

    setDeleting(null);
  }

  function handleEdit(id: string) {
    const detail = businessDetails[id];
    if (!detail) return;
    setForm(detail);
    setEditingId(id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancel() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  function handleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      fetchBusinessDetail(id);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all ${
            toast.type === "success"
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-red-500/20 text-red-400 border border-red-500/30"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div
        className="border-b border-white/[0.06]"
        style={{ background: "#141414" }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </a>
            <div>
              <h1 className="text-base font-semibold text-white">
                Admin Panel
              </h1>
              <p className="text-xs text-white/40">
                {businesses.length} business
                {businesses.length !== 1 ? "es" : ""}
              </p>
            </div>
          </div>
          {!showForm && (
            <button
              onClick={() => {
                setForm(EMPTY_FORM);
                setEditingId(null);
                setShowForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium transition-colors"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Business
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-white/[0.06] p-6 space-y-5"
            style={{ background: "#141414" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                {editingId ? "Edit Business" : "New Business"}
              </h2>
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Business Name */}
              <div className="space-y-1.5">
                <label className="text-xs text-white/50 font-medium">
                  Business Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Dr. Roy Dental Clinic"
                  className="w-full bg-white/[0.06] text-sm text-white/90 rounded-lg px-3 py-2.5 border border-white/[0.06] focus:outline-none focus:border-emerald-500/40 placeholder:text-white/20"
                />
              </div>

              {/* Phone Number ID */}
              <div className="space-y-1.5">
                <label className="text-xs text-white/50 font-medium">
                  WhatsApp Phone Number ID{" "}
                  <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.phone_number_id}
                  onChange={(e) =>
                    handleChange("phone_number_id", e.target.value)
                  }
                  placeholder="1234567890"
                  className="w-full bg-white/[0.06] text-sm text-white/90 rounded-lg px-3 py-2.5 border border-white/[0.06] focus:outline-none focus:border-emerald-500/40 placeholder:text-white/20"
                />
              </div>

              {/* Access Token */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs text-white/50 font-medium">
                  Meta Access Token <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={form.access_token}
                  onChange={(e) =>
                    handleChange("access_token", e.target.value)
                  }
                  placeholder="EAAK..."
                  className="w-full bg-white/[0.06] text-sm text-white/90 rounded-lg px-3 py-2.5 border border-white/[0.06] focus:outline-none focus:border-emerald-500/40 placeholder:text-white/20"
                />
              </div>

              {/* Webhook Verify Token */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs text-white/50 font-medium">
                  Webhook Verify Token{" "}
                  <span className="text-white/30">
                    (auto-generated if empty)
                  </span>
                </label>
                <input
                  type="text"
                  value={form.webhook_verify_token}
                  onChange={(e) =>
                    handleChange("webhook_verify_token", e.target.value)
                  }
                  placeholder="any-random-string"
                  className="w-full bg-white/[0.06] text-sm text-white/90 rounded-lg px-3 py-2.5 border border-white/[0.06] focus:outline-none focus:border-emerald-500/40 placeholder:text-white/20"
                />
              </div>

              {/* System Prompt */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs text-white/50 font-medium">
                  AI System Prompt <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={form.system_prompt}
                  onChange={(e) =>
                    handleChange("system_prompt", e.target.value)
                  }
                  rows={8}
                  placeholder={`You are the AI assistant for Dr. Roy Dental Clinic, Midnapore.\n\nHours: Mon-Sat 10am-8pm\nServices: cleaning, filling, root canal, extraction\nLanguages: Bangla, Hindi, English\n\nRules:\n- Never diagnose\n- For emergencies, tell patient to call +91-9876543210\n- Be warm and concise\n- Ask one question at a time`}
                  className="w-full bg-white/[0.06] text-sm text-white/90 rounded-lg px-3 py-2.5 border border-white/[0.06] focus:outline-none focus:border-emerald-500/40 placeholder:text-white/20 resize-y min-h-[120px]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Business"
                    : "Create Business"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-5 py-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm font-medium text-white/70 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Business List */}
        {businesses.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white/40">
                No businesses yet
              </p>
              <p className="text-xs text-white/20 mt-1">
                Add your first client to get started
              </p>
            </div>
          </div>
        )}

        {businesses.map((biz) => {
          const isExpanded = expandedId === biz.id;
          const detail = businessDetails[biz.id];

          return (
            <div
              key={biz.id}
              className="rounded-xl border border-white/[0.06] overflow-hidden"
              style={{ background: "#141414" }}
            >
              {/* Row */}
              <button
                onClick={() => handleExpand(biz.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {biz.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white/90">
                      {biz.name}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">
                      ID: {biz.phone_number_id} &middot; Added{" "}
                      {formatDate(biz.created_at)}
                    </p>
                  </div>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-1 border-t border-white/[0.06]">
                  {!detail ? (
                    <p className="text-xs text-white/30 py-4">Loading...</p>
                  ) : (
                    <div className="space-y-4 mt-3">
                      {/* Dashboard Link */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/10">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] uppercase tracking-wider text-emerald-400/60 mb-1">
                            Doctor Dashboard Link
                          </p>
                          <p className="text-xs text-white/50 font-mono truncate">
                            {window.location.origin}/dashboard/
                            {detail.webhook_verify_token}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/dashboard/${detail.webhook_verify_token}`;
                            navigator.clipboard.writeText(url);
                            showToast("Dashboard link copied!", "success");
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-xs font-medium text-emerald-400 transition-colors flex-shrink-0"
                        >
                          Copy Link
                        </button>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">
                          System Prompt
                        </p>
                        <pre className="text-xs text-white/60 bg-white/[0.04] rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {detail.system_prompt}
                        </pre>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">
                            Phone Number ID
                          </p>
                          <p className="text-xs text-white/60 font-mono">
                            {detail.phone_number_id}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">
                            Webhook Verify Token
                          </p>
                          <p className="text-xs text-white/60 font-mono">
                            {detail.webhook_verify_token}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">
                            Access Token
                          </p>
                          <p className="text-xs text-white/60 font-mono">
                            {detail.access_token.slice(0, 12)}...
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <button
                          onClick={() => handleEdit(biz.id)}
                          className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white/70 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(biz.id)}
                          disabled={deleting === biz.id}
                          className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-medium text-red-400 transition-colors disabled:opacity-50"
                        >
                          {deleting === biz.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
