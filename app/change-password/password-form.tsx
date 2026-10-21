"use client";

import { useState } from "react";

export default function PasswordForm() {
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const eye = <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="2"/></svg>;
  return <form action="/api/auth/change-password" method="post"><div className="field"><label htmlFor="new-password">New password</label><div className="password-input"><input id="new-password" name="password" type={showNew ? "text" : "password"} minLength={12} required /><button type="button" className="password-toggle" aria-label={showNew ? "Hide new password" : "Show new password"} onClick={() => setShowNew(value => !value)}>{eye}</button></div></div><div className="field"><label htmlFor="confirm-password">Confirm password</label><div className="password-input"><input id="confirm-password" name="confirm" type={showConfirm ? "text" : "password"} minLength={12} required /><button type="button" className="password-toggle" aria-label={showConfirm ? "Hide confirmed password" : "Show confirmed password"} onClick={() => setShowConfirm(value => !value)}>{eye}</button></div></div><button className="btn btn-primary" type="submit">Update password</button></form>;
}
