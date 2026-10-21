import { createClient } from "@supabase/supabase-js";

function describeError(error) {
  if (!error) return "Unknown Supabase error";
  const details = [error.message, error.code, error.details, error.hint].filter(Boolean);
  if (details.length) return details.join(" | ");
  const properties = Object.getOwnPropertyNames(error).map((key) => `${key}=${String(error[key])}`);
  return properties.length ? properties.join(" | ") : String(error);
}

if (process.env.NODE_ENV === "production" || process.env.ALLOW_LOCAL_ADMIN_PASSWORD_SEED !== "true") {
  throw new Error("Local password seed is disabled. Set ALLOW_LOCAL_ADMIN_PASSWORD_SEED=true only in local development.");
}

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "LOCAL_SUPER_ADMIN_EMAIL", "LOCAL_SUPER_ADMIN_PASSWORD"];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required`);

const email = process.env.LOCAL_SUPER_ADMIN_EMAIL.trim().toLowerCase();
const password = process.env.LOCAL_SUPER_ADMIN_PASSWORD;
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("LOCAL_SUPER_ADMIN_EMAIL is invalid");
if (password.length < 12) throw new Error("LOCAL_SUPER_ADMIN_PASSWORD must be at least 12 characters");

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { count, error: countError } = await admin.from("users").select("id", { count: "exact", head: true }).eq("role", "superadmin");
if (countError) throw new Error(`Could not check existing Super Admin: ${describeError(countError)}`);
if ((count ?? 0) > 0) throw new Error("Super Admin already exists. Local seed is one-time only.");

const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
let authUser = data?.user;

if (error?.code === "email_exists" || error?.message?.toLowerCase().includes("already been registered")) {
  const { data: listedUsers, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new Error(`Auth user exists, but it could not be located: ${describeError(listError)}`);
  authUser = listedUsers.users.find((user) => user.email?.toLowerCase() === email);
  if (!authUser) throw new Error("Auth user exists, but the matching email could not be located.");
  const { error: passwordError } = await admin.auth.admin.updateUserById(authUser.id, { password, email_confirm: true });
  if (passwordError) throw new Error(`Auth user exists, but its local password could not be updated: ${describeError(passwordError)}`);
} else if (error || !authUser) {
  throw new Error(`Could not create Auth user: ${describeError(error)}`);
}

const { data: existingMember, error: existingMemberError } = await admin.from("users").select("id,role").eq("id", authUser.id).maybeSingle();
if (existingMemberError) throw new Error(`Could not check Super Admin profile: ${describeError(existingMemberError)}`);
if (existingMember) throw new Error(`This Auth user already has a profile with role: ${existingMember.role}`);

const { error: memberError } = await admin.from("users").insert({ id: authUser.id, role: "superadmin", must_change_password: false });
if (memberError) throw new Error(`Could not create Super Admin profile: ${describeError(memberError)}`);
console.log("Local Super Admin profile created. You can now sign in at /login.");
