import { createFileRoute } from "@tanstack/react-router";

const DEMO = [
  { email: "aya@wasl.app",     password: "aya12345",     full_name: "Aya EL HAQYQY",   role: "collab"  as const },
  { email: "yasmine@wasl.app", password: "yasmine12345", full_name: "Yasmine AMRI",    role: "manager" as const },
  { email: "sara@wasl.app",    password: "sara12345",    full_name: "Sara RAFIK",      role: "rh"      as const },
  { email: "nadia@wasl.app",   password: "nadia12345",   full_name: "Dr. Nadia BENNANI", role: "medecin" as const },
  { email: "oussama@wasl.app", password: "oussama12345", full_name: "Oussama ETTALALI", role: "admin"   as const },
];

export const Route = createFileRoute("/api/public/seed-demo")({
  server: {
    handlers: {
      POST: async () => seed(),
      GET: async () => seed(),
    },
  },
});

async function seed() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const results: Array<{ email: string; status: string }> = [];

  for (const acc of DEMO) {
    // Check whether the user already exists by listing and filtering (Admin API)
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === acc.email);

    let userId: string;
    if (existing) {
      userId = existing.id;
      results.push({ email: acc.email, status: "exists" });
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: { full_name: acc.full_name },
      });
      if (error || !created.user) {
        results.push({ email: acc.email, status: `error: ${error?.message ?? "unknown"}` });
        continue;
      }
      userId = created.user.id;
      results.push({ email: acc.email, status: "created" });
    }

    // Make sure profile exists (trigger usually does this, but be defensive)
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: acc.email,
      full_name: acc.full_name,
      organisation_id: "00000000-0000-0000-0000-000000000001",
    });

    // Assign role (idempotent via unique constraint)
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: acc.role });
    if (roleErr && !roleErr.message.includes("duplicate")) {
      results.push({ email: acc.email, status: `role-error: ${roleErr.message}` });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
