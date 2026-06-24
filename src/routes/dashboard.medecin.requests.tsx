import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Stethoscope, Calendar, CheckCircle2, Clock, X, Loader2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/dashboard/Bits";
import { DateField } from "@/components/DateField";
import { listAllMedicalRequests, updateMedicalRequest } from "@/lib/medical-requests.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/medecin/requests")({ component: Requests });

function Requests() {
  const listFn = useServerFn(listAllMedicalRequests);
  const updateFn = useServerFn(updateMedicalRequest);
  const qc = useQueryClient();
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["all-medical-requests"],
    queryFn: () => listFn(),
    refetchInterval: 30000,
  });

  // Realtime — refresh when a new request lands
  useEffect(() => {
    const ch = supabase
      .channel("rt-medical-requests-medecin")
      .on("postgres_changes", { event: "*", schema: "public", table: "medical_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["all-medical-requests"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const [editing, setEditing] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(id: string, status: "scheduled" | "done" | "cancelled") {
    setBusy(true);
    try {
      await updateFn({ data: { id, status, scheduled_at: status === "scheduled" ? when || null : null, doctor_notes: notes || undefined } });
      setEditing(null); setNotes(""); setWhen("");
      qc.invalidateQueries({ queryKey: ["all-medical-requests"] });
    } finally { setBusy(false); }
  }

  const pending = requests.filter((r: any) => r.status === "pending");
  const scheduled = requests.filter((r: any) => r.status === "scheduled");
  const closed = requests.filter((r: any) => r.status === "done" || r.status === "cancelled");

  return (
    <div className="space-y-5">
      <PageHeader kicker="Consultation queue" title="Employee requests" subtitle="Live queue of consultation requests — updates in real time." />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="edunai-card p-3 text-center min-w-0"><div className="bracket-tag">PENDING</div><div className="font-display font-bold text-2xl mt-1">{pending.length}</div></div>
        <div className="edunai-card p-3 text-center min-w-0"><div className="bracket-tag">SCHEDULED</div><div className="font-display font-bold text-2xl mt-1">{scheduled.length}</div></div>
        <div className="edunai-card p-3 text-center min-w-0"><div className="bracket-tag">CLOSED</div><div className="font-display font-bold text-2xl mt-1">{closed.length}</div></div>
      </div>

      <Panel label="QUEUE" title="Awaiting your action">
        {isLoading && <div className="text-xs text-muted-foreground py-4">Loading…</div>}
        {!isLoading && pending.length === 0 && <div className="text-xs text-muted-foreground py-4">No pending requests.</div>}
        {pending.map((r: any) => (
          <div key={r.id} className="py-3 border-b border-border last:border-0">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-sm font-medium">{r.topic}</span>
              <span className={`ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${r.urgency==="high"?"bg-red-100 text-red-700":r.urgency==="low"?"bg-secondary text-muted-foreground":"bg-amber-100 text-amber-700"}`}>{r.urgency}</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">{r.profiles?.full_name ?? "—"} · {r.profiles?.department ?? "—"}</div>
            {r.description && <div className="text-xs mt-1.5">{r.description}</div>}
            {r.preferred_date && <div className="text-[11px] text-accent mt-1">Preferred: {new Date(r.preferred_date).toLocaleDateString()}</div>}

            {editing === r.id ? (
              <div className="mt-2 space-y-2 bg-secondary/40 p-2 rounded-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Date</label>
                    <div className="mt-1"><DateField value={when.slice(0,10)} onChange={(v) => setWhen(v + "T" + (when.slice(11) || "09:00"))} placeholder="Pick a date" /></div>
                  </div>
                  <div className="min-w-0">
                    <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Time</label>
                    <input type="time" value={when.slice(11,16)} onChange={(e) => setWhen((when.slice(0,10) || new Date().toISOString().slice(0,10)) + "T" + e.target.value)} className="mt-1 w-full min-w-0 rounded-md border border-border bg-background px-2 py-2 text-xs appearance-none" />
                  </div>
                </div>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Private note for the employee…" rows={2} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
                <div className="flex flex-wrap gap-1">
                  <button disabled={busy} onClick={() => act(r.id, "scheduled")} className="flex-1 min-w-[120px] btn-primary !py-2 !px-2 !text-[11px] justify-center disabled:opacity-50">
                    {busy ? <Loader2 className="w-3 h-3 animate-spin"/> : <Calendar className="w-3 h-3"/>}<span>Schedule</span>
                  </button>
                  <button disabled={busy} onClick={() => act(r.id, "cancelled")} className="px-3 py-2 text-[11px] uppercase tracking-wider border border-border rounded-lg hover:bg-muted">Cancel</button>
                  <button onClick={() => setEditing(null)} className="w-9 h-9 grid place-items-center rounded-lg hover:bg-muted"><X className="w-3.5 h-3.5"/></button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setEditing(r.id); setNotes(r.doctor_notes ?? ""); setWhen(""); }} className="mt-2 text-[11px] uppercase tracking-wider text-accent font-bold">
                Respond →
              </button>
            )}
          </div>
        ))}
      </Panel>

      <Panel label="UPCOMING" title="Scheduled consultations">
        {scheduled.length === 0 && <div className="text-xs text-muted-foreground py-4">Nothing scheduled.</div>}
        {scheduled.map((r: any) => (
          <div key={r.id} className="py-2 border-b border-border last:border-0 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-accent" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{r.topic} · {r.profiles?.full_name}</div>
              <div className="text-[11px] text-muted-foreground">{r.scheduled_at ? new Date(r.scheduled_at).toLocaleString() : "Time TBD"}</div>
            </div>
            <button disabled={busy} onClick={() => act(r.id, "done")} className="text-[10px] uppercase tracking-wider border border-border rounded-md px-2 py-1 hover:bg-muted">
              <CheckCircle2 className="w-3 h-3 inline mr-1"/>Mark done
            </button>
          </div>
        ))}
      </Panel>

      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground text-center">
        <Stethoscope className="w-3 h-3 inline mr-1" />Encrypted · audit-logged
      </p>
    </div>
  );
}
