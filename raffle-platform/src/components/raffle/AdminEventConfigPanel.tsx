"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminEventEditable, AdminRaffleRow } from "@/lib/types";

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
      return [...prev, normalizeRaffle({ raffleId: id, title: "New prize", sortOrder: nextSort, active: true })];
    });
  }

  function removeRaffle(i: number) {
    if (raffles.length < 2) return;
    setRaffles((prev) => prev.filter((_, j) => j !== i));
  }

  return (
    <section className="mb-10 rounded-3xl border border-amber-500/25 bg-neutral-900/80 p-6 shadow-sm">
      <div className="flex flex-col gap-2 border-b border-neutral-800 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-200">Event &amp; prizes</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-400">
            Edit what visitors see on the entry page. Use <strong className="text-neutral-200">Prize value</strong> to show what
            someone could win for free (dollar amounts, “retail $X”, “package worth …”). Images need a{" "}
            <code className="rounded bg-neutral-950 px-1 font-mono text-xs">https://</code> URL. Changing a prize{" "}
            <strong className="text-neutral-200">ID</strong> after entries exist can break stats; rename the title instead when
            possible.
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
        <div className="mt-6 space-y-8">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-neutral-200">Event name</span>
              <input
                className="mt-1 h-11 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 text-neutral-100"
                value={event.name}
                onChange={(e) => setEvent((s) => ({ ...s, name: e.target.value.slice(0, 200) }))}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-neutral-200">Logo image URL (optional)</span>
              <input
                className="mt-1 h-11 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 font-mono text-xs text-neutral-100"
                value={event.logoUrl}
                onChange={(e) => setEvent((s) => ({ ...s, logoUrl: e.target.value.slice(0, 2048) }))}
                placeholder="https://…"
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="font-medium text-neutral-200">Description</span>
              <textarea
                className="mt-1 min-h-[88px] w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                value={event.description}
                onChange={(e) => setEvent((s) => ({ ...s, description: e.target.value.slice(0, 2000) }))}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-neutral-200">Primary color</span>
              <input
                className="mt-1 h-11 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 font-mono text-sm text-neutral-100"
                value={event.primaryColor}
                onChange={(e) => setEvent((s) => ({ ...s, primaryColor: e.target.value.slice(0, 32) }))}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-neutral-200">Secondary color</span>
              <input
                className="mt-1 h-11 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 font-mono text-sm text-neutral-100"
                value={event.secondaryColor}
                onChange={(e) => setEvent((s) => ({ ...s, secondaryColor: e.target.value.slice(0, 32) }))}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-600"
                checked={event.theme === "light"}
                onChange={(e) => setEvent((s) => ({ ...s, theme: e.target.checked ? "light" : "dark" }))}
              />
              Light theme (otherwise dark)
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-600"
                checked={event.active}
                onChange={(e) => setEvent((s) => ({ ...s, active: e.target.checked }))}
              />
              Event active (public can enter)
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-600"
                checked={event.defaultTestMode}
                onChange={(e) => setEvent((s) => ({ ...s, defaultTestMode: e.target.checked }))}
              />
              Default entries as test mode
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-600"
                checked={event.blockTestWrite}
                onChange={(e) => setEvent((s) => ({ ...s, blockTestWrite: e.target.checked }))}
              />
              Block saving test entries to the sheet
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-neutral-200">Bonus rules JSON (optional)</span>
            <textarea
              className="mt-1 min-h-[100px] w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-100"
              value={event.bonusRulesJson}
              onChange={(e) => setEvent((s) => ({ ...s, bonusRulesJson: e.target.value.slice(0, 8000) }))}
              placeholder='[{"id":"instagram","label":"…","tickets":2}, …]'
            />
          </label>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-200">Prize pools</h3>
              <button
                type="button"
                onClick={addRaffle}
                className="text-sm font-medium text-amber-300 hover:text-amber-200"
              >
                + Add prize
              </button>
            </div>
            <div className="space-y-4">
              {raffles.map((row, i) => (
                <div
                  key={i + "-" + row.raffleId}
                  className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 md:grid md:grid-cols-[1fr_1fr_auto] md:gap-4"
                >
                  <div className="space-y-3">
                    <label className="block text-xs text-neutral-400">
                      Prize ID <span className="text-neutral-600">(slug-safe, unique)</span>
                      <input
                        className="mt-1 h-10 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 font-mono text-sm text-neutral-100"
                        value={row.raffleId}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
                          updateRaffle(i, { raffleId: v, id: v });
                        }}
                      />
                    </label>
                    <label className="block text-xs text-neutral-400">
                      Title
                      <input
                        className="mt-1 h-10 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 text-sm text-neutral-100"
                        value={row.title}
                        onChange={(e) => updateRaffle(i, { title: e.target.value.slice(0, 200) })}
                      />
                    </label>
                    <label className="block text-xs text-neutral-400">
                      Subtitle
                      <input
                        className="mt-1 h-10 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 text-sm text-neutral-100"
                        value={row.subtitle}
                        onChange={(e) => updateRaffle(i, { subtitle: e.target.value.slice(0, 500) })}
                      />
                    </label>
                    <label className="block text-xs text-neutral-400">
                      Prize value <span className="text-neutral-600">(e.g. $450+ retail · No purchase necessary)</span>
                      <input
                        className="mt-1 h-10 w-full rounded-lg border border-amber-900/40 bg-neutral-900 px-2 text-sm text-amber-100 placeholder:text-neutral-600"
                        value={row.valueLabel}
                        onChange={(e) => updateRaffle(i, { valueLabel: e.target.value.slice(0, 160) })}
                        placeholder="What they could win for free"
                      />
                    </label>
                  </div>
                  <div className="mt-3 space-y-3 md:mt-0">
                    <label className="block text-xs text-neutral-400">
                      Image URL (<code className="text-neutral-500">https://</code> only)
                      <input
                        className="mt-1 h-10 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 font-mono text-xs text-neutral-100"
                        value={row.imageUrl}
                        onChange={(e) => updateRaffle(i, { imageUrl: e.target.value.slice(0, 2048) })}
                        placeholder="https://cdn…/photo.jpg"
                      />
                    </label>
                    {row.imageUrl && row.imageUrl.toLowerCase().startsWith("https://") ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={row.imageUrl}
                          alt=""
                          className="h-16 w-16 rounded-lg border border-neutral-700 object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <span className="text-xs text-neutral-500">Preview</span>
                      </div>
                    ) : null}
                    <label className="flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                      <span>Sort order</span>
                      <input
                        type="number"
                        className="h-9 w-24 rounded-lg border border-neutral-700 bg-neutral-900 px-2 text-sm text-neutral-100"
                        value={row.sortOrder}
                        onChange={(e) => updateRaffle(i, { sortOrder: Math.max(0, Math.min(99999, Number(e.target.value) || 0)) })}
                      />
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-neutral-600"
                          checked={row.active}
                          onChange={(e) => updateRaffle(i, { active: e.target.checked })}
                        />
                        Active on entry page
                      </label>
                    </label>
                  </div>
                  <div className="mt-3 flex items-start justify-end md:mt-0">
                    <button
                      type="button"
                      onClick={() => removeRaffle(i)}
                      disabled={raffles.length < 2}
                      className="text-sm text-red-300 hover:text-red-200 disabled:opacity-30"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
