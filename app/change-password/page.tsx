import Link from "next/link";
import PasswordForm from "./password-form";

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; reason?: string }> }) {
  const params = await searchParams;
  const message = params.error === "invalid" ? "Passwords must match and contain at least 12 characters." : params.error === "failed" ? `The password could not be updated.${params.reason ? ` ${params.reason}` : " Please try again."}` : "";
  return <main className="app-page"><div className="form-card"><Link className="auth-logo brand" href="/"><span className="brand-mark">▦</span><span>Review Saathi</span></Link><div className="panel"><div className="auth-title"><h1>Set a new password</h1><p>Your temporary password must be replaced before you continue.</p></div>{message && <div className="auth-alert" role="alert">{message}</div>}<PasswordForm /></div></div></main>;
}
