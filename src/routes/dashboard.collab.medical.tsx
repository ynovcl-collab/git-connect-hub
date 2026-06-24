import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Stethoscope, Send, Loader2, Clock, CheckCircle2, Calendar } from "lucide-react";
import { PageHeader, Panel } from "@/components/dashboard/Bits";
import { DateField } from "@/components/DateField";
import { createMedicalRequest, listMyMedicalRequests } from "@/lib/medical-requests.functions";

export const Route = createFileRoute("/dashboard/collab/medical")({ component: MedicalRequest });

function MedicalRequest() {
  const listFn = useServerFn(listMyMedicalRequests);
  const createFn = useServerFn(createMedicalRequest);
  const qc = useQueryClient();
  const { data: requests = [], isLoading } = useQuery({ queryKey: ["my-medical-requests"], queryFn: () => listFn() });

  const [topic, setTopic] = useState("");
  const [desc, setDesc] = useState("");
  const [urgency, setUrgency] = useState<"low" | "normal" | "high">("normal");
  const [preferred, setPreferred] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setSending(true);
    try {
      await createFn({ data: { topic, description: desc, urgency, preferred_date: preferred || undefined } });
      setTopic(""); setDesc(""); setUrgency("normal"); setPreferred("");
      setDone(true); setTimeout(() => setDone(false), 2500);
      qc.invalidateQueries({ queryKey: ["my-medical-requests"] });
    } finally { setSending(false); }
  }

  return (
    <div className="space-y-5">
      <PageHeader kicker="Occupational health" title="Request a medical consultation" subtitle="Confidential — only the occupational doctor sees your request." />

      <form onSubmit={submit} className="edunai-card p-4 space-y-3">
        <div className="field">
          <input id="topic" placeholder=" " value={topic} onChange={(e) => setTopic(e.target.value)} required maxLength={120} />
          <label htmlFor="topic">Reason (short)</label>
        </div>
        <div className="field">
          <textarea id="desc" placeholder=" " value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} maxLength={2000} className="w-full" />
          <label htmlFor="desc">Describe what you're experiencing (optional)</label>
        </div>
        <div className="space-y-3">
          <div>
            <div className="bracket-tag mb-2">URGENCY</div>
            <div className="grid grid-cols-3 gap-2">
              {(["low","normal","high"] as const).map((u) => {
                const isActive = urgency === u;
                const tone = u === "high" ? "border-red-300 text-red-700" : u === "normal" ? "border-amber-300 text-amber-700" : "border-emerald-300 text-emerald-700";
                return (
                  <button type="button" key={u} onClick={() => setUrgency(u)}
                    aria-pressed={isActive}
                    className={`text-[11px] uppercase tracking-[0.15em] font-semibold py-2.5 rounded-xl border transition ${isActive ? "bg-foreground text-background border-foreground shadow-sm" : `bg-background ${tone} hover:bg-muted`}`}>
                    {u}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="bracket-tag mb-2">PREFERRED DATE</div>
            <DateField value={preferred} onChange={setPreferred} placeholder="Pick a preferred date" />
          </div>
        </div>
        <button type="submit" disabled={sending || !topic.trim()} className="btn-primary w-full justify-center disabled:opacity-50">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span>{done ? "Sent — the doctor will contact you" : "Send to the occupational doctor"}</span>
        </button>
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground text-center">
          <Stethoscope className="w-3 h-3 inline mr-1" />End-to-end confidential · not visible to HR or your manager
        </p>
      </form>

      <Panel label="HISTORY" title="My consultation requests">
        {isLoading && <div className="text-xs text-muted-foreground py-4">Loading…</div>}
        {!isLoading && requests.length === 0 && <div className="text-xs text-muted-foreground py-4">No requests yet.</div>}
        {requests.map((r: any) => (
          <div key={r.id} className="py-3 border-b border-border last:border-0">
            <div className="flex items-center gap-2">
              {r.status === "scheduled" ? <Calendar className="w-3.5 h-3.5 text-accent" /> :
               r.status === "done" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> :
               <Clock className="w-3.5 h-3.5 text-amber-500" />}
              <span className="text-sm font-medium">{r.topic}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-auto">{r.status}</span>
            </div>
            {r.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</div>}
            {r.scheduled_at && <div className="text-[11px] text-accent mt-1">Scheduled: {new Date(r.scheduled_at).toLocaleString()}</div>}
            {r.doctor_notes && <div className="text-[11px] text-muted-foreground mt-1 italic">Note from doctor: {r.doctor_notes}</div>}
          </div>
        ))}
      </Panel>
    </div>
  );
}
