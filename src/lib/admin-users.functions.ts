import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleEnum = z.enum(["admin", "rh", "manager", "collab"]);

type ImportCollaboratorRow = {
  email: string;
  full_name: string;
  department?: string | null;
  position?: string | null;
  hire_date?: string | null;
  role?: z.infer<typeof RoleEnum>;
};

function splitCsvLine(line: string) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseCollaboratorCsv(csv: string): ImportCollaboratorRow[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must include a header row and at least one data row.");
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    const rawRole = (row.role ?? "").trim();
    const parsedRole = RoleEnum.safeParse(rawRole);
    return {
      email: (row.email ?? "").trim().toLowerCase(),
      full_name: (row.full_name ?? row.name ?? "").trim(),
      department: (row.department ?? "").trim() || null,
      position: (row.position ?? "").trim() || null,
      hire_date: (row.hire_date ?? "").trim() || null,
      role: parsedRole.success ? parsedRole.data : undefined,
    };
  }).filter((item) => item.email && item.full_name);
}


function generateTempPassword(length = 16) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (byte) => alphabet[byte % alphabet.length]).join("");
}

const CreateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(128),
  full_name: z.string().trim().min(1).max(120),
  role: RoleEnum,
  department: z.string().trim().max(120).optional(),
});

const ImportCollaboratorsSchema = z
  .object({
    csv: z.string().min(1).optional(),
    items: z.array(
      z.object({
        email: z.string().trim().toLowerCase().email().max(255),
        full_name: z.string().trim().min(1).max(120),
        department: z.string().trim().max(120).optional(),
        position: z.string().trim().max(120).optional(),
        hire_date: z.string().trim().optional(),
        role: RoleEnum.optional(),
      }),
    ).optional(),
  })
  .refine((value) => !!value.csv || (!!value.items && value.items.length > 0), {
    message: "Provide csv text or an items array",
  });

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Only admins can create accounts
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Failed to create user");
    }
    const newUserId = created.user.id;

    // Resolve organisation from creating admin's profile (fallback: first org)
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("organisation_id")
      .eq("id", userId)
      .maybeSingle();
    let orgId = adminProfile?.organisation_id as string | null | undefined;
    if (!orgId) {
      const { data: anyOrg } = await supabaseAdmin
        .from("organisations")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      orgId = anyOrg?.id;
    }

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newUserId,
        organisation_id: orgId,
        full_name: data.full_name,
        email: data.email,
        department: data.department ?? null,
      });
    if (profileErr) throw new Error(profileErr.message);

    const { error: roleInsErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: data.role });
    if (roleInsErr && !roleInsErr.message.includes("duplicate")) {
      throw new Error(roleInsErr.message);
    }

    return { id: newUserId, email: data.email, full_name: data.full_name, role: data.role };
  });

const ResetPasswordSchema = z.object({
  user_id: z.string().uuid(),
  new_password: z.string().min(8).max(128),
});

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResetPasswordSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.new_password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const importCollaborators = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImportCollaboratorsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows: ImportCollaboratorRow[] = data.items ?? parseCollaboratorCsv(data.csv ?? "");
    const results: Array<{ email: string; status: string; user_id?: string }> = [];

    for (const row of rows) {
      try {
        const roleToAssign = row.role && RoleEnum.options.includes(row.role) ? row.role : undefined;
        let userIdToUse: string | null = null;

        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", row.email)
          .maybeSingle();

        if (existingProfile?.id) {
          userIdToUse = existingProfile.id;
        } else {
          const tempPassword = generateTempPassword(16);
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: row.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: row.full_name },
          });
          if (createErr || !created.user) {
            results.push({ email: row.email, status: `user-create-error: ${createErr?.message ?? "unknown"}` });
            continue;
          }
          userIdToUse = created.user.id;
        }

        const { error: profileErr } = await supabaseAdmin
          .from("profiles")
          .upsert({
            id: userIdToUse,
            email: row.email,
            full_name: row.full_name,
            department: row.department || null,
            position: row.position || null,
            hire_date: row.hire_date || null,
          }, { onConflict: "id" });
        if (profileErr) {
          results.push({ email: row.email, status: `profile-error: ${profileErr.message}`, user_id: userIdToUse });
          continue;
        }

        if (row.role) {
          const { error: roleInsErr } = await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: userIdToUse, role: row.role });
          if (roleInsErr && !roleInsErr.message.includes("duplicate")) {
            results.push({ email: row.email, status: `role-error: ${roleInsErr.message}`, user_id: userIdToUse });
            continue;
          }
        }

        results.push({ email: row.email, status: "imported", user_id: userIdToUse });
      } catch (error) {
        results.push({ email: row.email, status: `error: ${(error as Error).message}` });
      }
    }

    return { results };
  });