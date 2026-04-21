"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminEventEditable, AdminRaffleRow } from "@/lib/types";
import { compressImageToJpegBlob } from "@/lib/compressImageToJpeg";

type Props = {
  slug: string;
  adminKey: string;
  onSaved?: () => void;
};

function defaultEvent(): AdminEventEditable {
  return {
    name: "",
    description: "",
    logoUrl: "",
    primaryColor: "#c9a227",
    secondaryColor: "#1a1a1a",
    theme: "dark",
    active: true,
    defaultTestMode: false,
    blockTestWrite: false,
    bonusRulesJson: "",
  };
}

function normalizeRaffle(r: Partial<AdminRaffleRow> & { id?: string; raffleId?: string }): AdminRaffleRow {
  const id = String(r.raffleId || r.id || "").trim() || "new-prize";
  return {
    id,
    raffleId: id,
    title: String(r.title || ""),
    subtitle: String(r.subtitle || ""),
    imageUrl: String(r.imageUrl || "").trim(),
    valueLabel: String(r.valueLabel ?? "").trim().slice(0, 160),
    sortOrder: Number.isFinite(Number(r.sortOrder)) ? Number(r.sortOrder) : 0,
    active: r.active !== false && String(r.active).toUpperCase() !== "FALSE",
  };
}

function formatConfigSaveError(code: string | undefined): string {
  switch (code) {
    case "need_at_least_one_raffle":
      return "Keep at least one prize row.";
    case "too_many_raffles":
      return "Too many prizes (max 24).";
    case "invalid_raffle_id":
      return "Each prize needs an ID (letters, numbers, dashes, underscores only).";
    case "invalid_raffle_title":
      return "Each prize needs a title (max 200 characters).";
    case "invalid_raffle_subtitle":
      return "Subtitle too long (max 500 characters).";
    case "duplicate_raffle_id":
      return "Two prizes used the same ID — make each prize ID unique.";
    case "image_url_must_be_https_or_empty":
      return "Image URL must be empty or start with https://";
    case "invalid_raffle_value_label":
      return "Prize value text is too long (max 160 characters).";
    case "invalid_bonus_rules_json":
      return "Bonus rules must be valid JSON or empty.";
    case "unauthorized":
      return "Admin key was rejected.";
    default:
      return code || "Save failed";
  }
}

export function AdminEventConfigPanel({ slug, adminKey, onSaved }: Props) {
  const [event, setEvent] = useState<AdminEventEditable>(defaultEvent);
  const [raffles, setRaffles] = useState<AdminRaffleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [uploading, setUploading] = useState<"logo" | number | null>(null);

  const load = useCallback(async () => {
    if (!adminKey.trim()) return;
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/${encodeURIComponent(slug)}/config`, {
        method: "GET",
        headers: { "x-admin-key": adminKey.trim() },
      });
      const data = (await res.json()) as {
        ok?: boolean;
        event?: Partial<AdminEventEditable>;
        raffles?: Partial<AdminRaffleRow>[];
        error?: string;
      };
      if (!res.ok || !data.ok || !data.event) {
        setErr(data.error === "unknown_action" ? "Update Google Apps Script (Code.gs) and redeploy the web app — getAdminEventConfig is missing." : data.error || "Could not load config");
        setRaffles([]);
        return;
      }
      const ev = data.event;
      setEvent({
        name: String(ev.name ?? ""),
        description: String(ev.description ?? ""),
        logoUrl: String(ev.logoUrl ?? ""),
        primaryColor: String(ev.primaryColor ?? "#c9a227"),
        secondaryColor: String(ev.secondaryColor ?? "#1a1a1a"),
        theme: ev.theme === "light" ? "light" : "dark",
        active: Boolean(ev.active),
        defaultTestMode: Boolean(ev.defaultTestMode),
        blockTestWrite: Boolean(ev.blockTestWrite),
        bonusRulesJson: String(ev.bonusRulesJson ?? ""),
      });
      const rows = Array.isArray(data.raffles) ? data.raffles.map((r) => normalizeRaffle(r)) : [];
      setRaffles(rows.length ? rows : [normalizeRaffle({ raffleId: "grand-prize", title: "Grand prize", sortOrder: 1 })]);
      setExpandedIdx(0);
    } catch {
      setErr("Network error loading config");
    } finally {
      setLoading(false);
    }
  }, [adminKey, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/${encodeURIComponent(slug)}/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey.trim(),
        },
        body: JSON.stringify({
          event,
          raffles: raffles.map((r, i) => ({
            raffleId: r.raffleId.trim() || r.id.trim(),
            title: r.title.trim(),
            subtitle: r.subtitle,
            imageUrl: r.imageUrl.trim(),
            valueLabel: r.valueLabel.trim().slice(0, 160),
            sortOrder: r.sortOrder || i + 1,
            active: r.active,
          })),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        event?: Partial<AdminEventEditable>;
        raffles?: Partial<AdminRaffleRow>[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErr(formatConfigSaveError(data.error));
        return;
      }
      if (data.event && data.raffles) {
        const ev = data.event;
        setEvent({
          name: String(ev.name ?? ""),
          description: String(ev.description ?? ""),
          logoUrl: String(ev.logoUrl ?? ""),
          primaryColor: String(ev.primaryColor ?? "#c9a227"),
          secondaryColor: String(ev.secondaryColor ?? "#1a1a1a"),
          theme: ev.theme === "light" ? "light" : "dark",
          active: Boolean(ev.active),
          defaultTestMode: Boolean(ev.defaultTestMode),
          blockTestWrite: Boolean(ev.blockTestWrite),
          bonusRulesJson: String(ev.bonusRulesJson ?? ""),
        });
        setRaffles(data.raffles.map((r) => normalizeRaffle(r)));
      }
      setMsg("Saved to Google Sheet. Public entry page may take up to a minute to refresh.");
      onSaved?.();
    } catch {
      setErr("Network error while saving");
    } finally {
      setSaving(false);
    }
  }

  function updateRaffle(i: number, patch: Partial<AdminRaffleRow>) {
    setRaffles((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch, raffleId: patch.raffleId ?? r.raffleId, id: patch.raffleId ?? patch.id ?? r.id } : r)));
  }

  function addRaffle() {
    setRaffles((prev) => {
      const nextSort = prev.reduce((m, r) => Math.max(m, r.sortOrder || 0), 0) + 1;
      const id = "prize-" + Math.random().toString(36).slice(2, 8);
      const next = [...prev, normalizeRaffle({ raffleId: id, title: "New prize", sortOrder: nextSort, active: true })];
      setExpandedIdx(next.length - 1);
      return next;
    });
  }

  function removeRaffle(i: number) {
    if (raffles.length < 2) return;
    setRaffles((prev) => prev.filter((_, j) => j !== i));
    setExpandedIdx((prev) => (prev === i ? 0 : prev > i ? prev - 1 : prev));
  }

  async function uploadPrizeImage(index: number, file: File) {
    if (!adminKey.trim()) return;
    setUploading(index);
    setErr(null);
    try {
      const blob =
        file.type === "image/jpeg" ? file : await compressImageToJpegBlob(file, 1400, 0.85);
      const fd = new FormData();
      fd.append("file", blob, "prize.jpg");
      const res = await fetch(`/api/admin/${encodeURIComponent(slug)}/upload-image`, {
        method: "POST",
        headers: { "x-admin-key": adminKey.trim() },
        body: fd,
      });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok || !data.url) {
        setErr(data.error || "Image upload failed");
        return;
      }
      updateRaffle(index, { imageUrl: String(data.url) });
      setMsg("Image uploaded — Save to Google Sheet when you are ready.");
    } catch {
      setErr("Could not upload image");
    } finally {
      setUploading(null);
    }
  }

  async function uploadLogo(file: File) {
    if (!adminKey.trim()) return;
    setUploading("logo");
    setErr(null);
    try {
      const blob =
        file.type === "image/jpeg" ? file : await compressImageToJpegBlob(file, 800, 0.88);
      const fd = new FormData();
      fd.append("file", blob, "logo.jpg");
      const res = await fetch(`/api/admin/${encodeURIComponent(slug)}/upload-image`, {
        method: "POST",
        headers: { "x-admin-key": adminKey.trim() },
        body: fd,
      });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok || !data.url) {
        setErr(data.error || "Logo upload failed");
        return;
      }
      setEvent((s) => ({ ...s, logoUrl: String(data.url) }));
      setMsg("Logo uploaded — Save to Google Sheet when you are ready.");
    } catch {
      setErr("Could not upload logo");
    } finally {
      setUploading(null);
    }
  }

  return (
    <section className="mb-10 rounded-3xl border border-amber-500/25 bg-neutral-900/80 p-6 shadow-sm">
      <div className="flex flex-col gap-2 border-b border-neutral-800 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-neutral-50">Event &amp; prizes</h2>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            Name the event, add prizes in a few taps, save once. Avoid changing prize IDs after entries exist.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="h-10 rounded-xl border border-neutral-600 px-3 text-sm font-medium text-neutral-200 disabled:opacity-50"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className="h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 px-4 text-sm font-semibold text-white shadow disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save to Google Sheet"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-neutral-500">Loading sheet…</p>
      ) : null}

      {err ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">{err}</div>
      ) : null}
      {msg ? (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{msg}</div>
      ) : null}

      {!loading && !err ? (
        <div className="mt-8 space-y-10">
          <div className="rounded-2xl border border-neutral-800/80 bg-neutral-950/40 p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Step 1 · Event</p>
            <label className="mt-3 block">
              <span className="text-sm font-medium text-neutral-200">Public name</span>
              <input
                className="mt-1.5 h-12 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 text-base text-neutral-100 outline-none ring-0 focus:border-amber-500/50"
                value={event.name}
                onChange={(e) => setEvent((s) => ({ ...s, name: e.target.value.slice(0, 200) }))}
                placeholder="Grand opening giveaway"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-neutral-200">Short description</span>
              <textarea
                className="mt-1.5 min-h-[72px] w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-500/50"
                value={event.description}
                onChange={(e) => setEvent((s) => ({ ...s, description: e.target.value.slice(0, 2000) }))}
                placeholder="What people should know in one or two sentences."
              />
            </label>
            <div className="mt-5 flex flex-wrap items-end gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-neutral-200">Brand colors</span>
                <input
                  type="color"
                  aria-label="Primary"
                  className="h-10 w-14 cursor-pointer rounded-lg border border-neutral-700 bg-neutral-900"
                  value={event.primaryColor.match(/^#[0-9a-fA-F]{6}$/) ? event.primaryColor : "#c9a227"}
                  onChange={(e) => setEvent((s) => ({ ...s, primaryColor: e.target.value }))}
                />
                <input
                  type="color"
                  aria-label="Secondary"
                  className="h-10 w-14 cursor-pointer rounded-lg border border-neutral-700 bg-neutral-900"
                  value={event.secondaryColor.match(/^#[0-9a-fA-F]{6}$/) ? event.secondaryColor : "#1a1a1a"}
                  onChange={(e) => setEvent((s) => ({ ...s, secondaryColor: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-6">
              <span className="text-sm font-medium text-neutral-200">Logo</span>
              <p className="mt-1 text-xs text-neutral-500">Upload a square-ish mark, or paste a link.</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-neutral-600 bg-neutral-900/80 px-4 py-3 text-sm font-medium text-neutral-200 hover:border-amber-500/40">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={uploading === "logo"}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void uploadLogo(f);
                    }}
                  />
                  {uploading === "logo" ? "Uploading…" : "Upload logo"}
                </label>
                <input
                  className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 font-mono text-xs text-neutral-100"
                  value={event.logoUrl}
                  onChange={(e) => setEvent((s) => ({ ...s, logoUrl: e.target.value.slice(0, 2048) }))}
                  placeholder="https://… or /raffle-images/…"
                />
              </div>
              {event.logoUrl.trim() ? (
                <div className="mt-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={event.logoUrl} alt="" className="h-14 w-14 rounded-xl border border-neutral-700 object-contain p-1" />
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Step 2 · Prizes</p>
                <h3 className="mt-1 text-lg font-semibold text-neutral-100">Pools on the entry page</h3>
              </div>
              <button
                type="button"
                onClick={addRaffle}
                className="shrink-0 rounded-full bg-neutral-800 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-neutral-700"
              >
                Add prize
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {raffles.map((row, i) => {
                const open = expandedIdx === i;
                const thumb = row.imageUrl?.trim();
                return (
                  <div
                    key={i + "-" + row.raffleId}
                    className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/50"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedIdx(open ? -1 : i)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-neutral-900/80"
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-neutral-500">
                            {row.title.slice(0, 1).toUpperCase() || "?"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-neutral-100">{row.title || "Untitled prize"}</p>
                        <p className="truncate text-xs text-neutral-500">{row.valueLabel || "Add value text · " + row.raffleId}</p>
                      </div>
                      <span className="text-neutral-500">{open ? "−" : "+"}</span>
                    </button>
                    {open ? (
                      <div className="space-y-4 border-t border-neutral-800 px-4 py-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="block sm:col-span-2">
                            <span className="text-xs font-medium text-neutral-400">Title</span>
                            <input
                              className="mt-1 h-11 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100"
                              value={row.title}
                              onChange={(e) => updateRaffle(i, { title: e.target.value.slice(0, 200) })}
                            />
                          </label>
                          <label className="block sm:col-span-2">
                            <span className="text-xs font-medium text-neutral-400">What they could win (free)</span>
                            <input
                              className="mt-1 h-11 w-full rounded-xl border border-amber-900/30 bg-neutral-950 px-3 text-sm text-amber-50 placeholder:text-neutral-600"
                              value={row.valueLabel}
                              onChange={(e) => updateRaffle(i, { valueLabel: e.target.value.slice(0, 160) })}
                              placeholder="$500+ retail · No purchase necessary"
                            />
                          </label>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-neutral-400">Photo</span>
                          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-neutral-600 bg-neutral-900/80 px-4 py-2.5 text-sm font-medium text-neutral-200 hover:border-amber-500/40">
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="sr-only"
                                disabled={uploading === i}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  e.target.value = "";
                                  if (f) void uploadPrizeImage(i, f);
                                }}
                              />
                              {uploading === i ? "Uploading…" : "Upload"}
                            </label>
                            <input
                              className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 font-mono text-xs text-neutral-100"
                              value={row.imageUrl}
                              onChange={(e) => updateRaffle(i, { imageUrl: e.target.value.slice(0, 2048) })}
                              placeholder="Or paste image URL (https://…)"
                            />
                          </div>
                        </div>
                        <details className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2">
                          <summary className="cursor-pointer text-sm font-medium text-neutral-300">More options</summary>
                          <div className="mt-3 space-y-3 pb-1">
                            <label className="block">
                              <span className="text-xs text-neutral-500">Prize ID (avoid changing after entries)</span>
                              <input
                                className="mt-1 h-10 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 font-mono text-sm text-neutral-100"
                                value={row.raffleId}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
                                  updateRaffle(i, { raffleId: v, id: v });
                                }}
                              />
                            </label>
                            <label className="block">
                              <span className="text-xs text-neutral-500">Subtitle</span>
                              <input
                                className="mt-1 h-10 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 text-sm text-neutral-100"
                                value={row.subtitle}
                                onChange={(e) => updateRaffle(i, { subtitle: e.target.value.slice(0, 500) })}
                              />
                            </label>
                            <div className="flex flex-wrap items-center gap-4">
                              <label className="flex items-center gap-2 text-sm text-neutral-300">
                                <span className="text-xs text-neutral-500">Sort</span>
                                <input
                                  type="number"
                                  className="h-9 w-20 rounded-lg border border-neutral-700 bg-neutral-950 px-2 text-sm text-neutral-100"
                                  value={row.sortOrder}
                                  onChange={(e) =>
                                    updateRaffle(i, { sortOrder: Math.max(0, Math.min(99999, Number(e.target.value) || 0)) })
                                  }
                                />
                              </label>
                              <label className="flex items-center gap-2 text-sm text-neutral-300">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-neutral-600"
                                  checked={row.active}
                                  onChange={(e) => updateRaffle(i, { active: e.target.checked })}
                                />
                                On entry page
                              </label>
                            </div>
                          </div>
                        </details>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeRaffle(i)}
                            disabled={raffles.length < 2}
                            className="text-sm text-red-300 hover:text-red-200 disabled:opacity-30"
                          >
                            Remove prize
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/30">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-neutral-300 hover:bg-neutral-900/50"
            >
              <span>
                <span className="text-neutral-400">Advanced</span>
                <span className="ml-2 text-neutral-600">· theme, test mode, bonus JSON</span>
              </span>
              <span className="text-neutral-500">{advancedOpen ? "−" : "+"}</span>
            </button>
            {advancedOpen ? (
              <div className="space-y-4 border-t border-neutral-800 px-4 py-4">
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-neutral-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-600"
                      checked={event.theme === "light"}
                      onChange={(e) => setEvent((s) => ({ ...s, theme: e.target.checked ? "light" : "dark" }))}
                    />
                    Light entry page
                  </label>
                  <label className="flex items-center gap-2 text-sm text-neutral-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-600"
                      checked={event.active}
                      onChange={(e) => setEvent((s) => ({ ...s, active: e.target.checked }))}
                    />
                    Event accepting entries
                  </label>
                  <label className="flex items-center gap-2 text-sm text-neutral-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-600"
                      checked={event.defaultTestMode}
                      onChange={(e) => setEvent((s) => ({ ...s, defaultTestMode: e.target.checked }))}
                    />
                    Default test entries
                  </label>
                  <label className="flex items-center gap-2 text-sm text-neutral-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-600"
                      checked={event.blockTestWrite}
                      onChange={(e) => setEvent((s) => ({ ...s, blockTestWrite: e.target.checked }))}
                    />
                    Block test rows to sheet
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="font-medium text-neutral-200">Bonus rules JSON</span>
                  <textarea
                    className="mt-1 min-h-[88px] w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-100"
                    value={event.bonusRulesJson}
                    onChange={(e) => setEvent((s) => ({ ...s, bonusRulesJson: e.target.value.slice(0, 8000) }))}
                    placeholder='[{"id":"instagram","label":"…","tickets":2}]'
                  />
                </label>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
