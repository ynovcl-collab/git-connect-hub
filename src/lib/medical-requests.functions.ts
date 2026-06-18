import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyMedicalRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("medical_requests")
      .select("*")
      .eq("employee_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createMedicalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { topic: string; description?: string; urgency?: "low" | "normal" | "high"; preferred_date?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("medical_requests")
      .insert({
        employee_id: userId,
        topic: data.topic.slice(0, 120),
        description: data.description?.slice(0, 2000) ?? null,
        urgency: data.urgency ?? "normal",
        preferred_date: data.preferred_date ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listAllMedicalRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isMedic } = await supabase.rpc("has_role", { _user_id: userId, _role: "medecin" });
    if (!isMedic) throw new Error("Forbidden");
    const { data, error } = await supabase
      .from("medical_requests")
      .select("*, profiles!medical_requests_employee_id_fkey(full_name,department,position)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateMedicalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status?: "pending" | "scheduled" | "done" | "cancelled"; scheduled_at?: string | null; doctor_notes?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isMedic } = await supabase.rpc("has_role", { _user_id: userId, _role: "medecin" });
    if (!isMedic) throw new Error("Forbidden");
    const patch: { status?: "pending" | "scheduled" | "done" | "cancelled"; scheduled_at?: string | null; doctor_notes?: string } = {};
    if (data.status) patch.status = data.status;
    if (data.scheduled_at !== undefined) patch.scheduled_at = data.scheduled_at;
    if (data.doctor_notes !== undefined) patch.doctor_notes = data.doctor_notes;
    const { error } = await supabase.from("medical_requests").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
