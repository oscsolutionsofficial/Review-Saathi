import { createClient } from "@supabase/supabase-js";

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "INITIAL_SUPER_ADMIN_EMAIL", "NEXT_PUBLIC_SITE_URL"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const email = process.env.INITIAL_SUPER_ADMIN_EMAIL.trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INITIAL_SUPER_ADMIN_EMAIL is invalid");

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { count, error: countError } = await admin.from("users").select("id", { count: "exact", head: true }).eq("role", "superadmin");
if (countError) throw countError;
if ((count ?? 0) > 0) throw new Error("Super Admin seed already completed. No second Super Admin can be created.");

const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/change-password` });
if (error || !data.user) throw error ?? new Error("Supabase did not return the invited user");

const { error: profileError } = await admin.from("users").insert({ id: data.user.id, role: "superadmin", must_change_password: true });
if (profileError) throw profileError;

console.log("Super Admin invite sent. The recipient must use the email link to set a password.");
