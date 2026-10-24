export default function LoginLoading() {
  return (
    <main className="app-page" aria-busy="true" aria-label="Loading login">
      <div className="form-card">
        <div className="auth-logo brand">
          <span className="brand-mark" aria-hidden="true">◆</span>
          <span>Review Saathi</span>
        </div>
        <div className="panel login-loading-panel">
          <div className="loading-line loading-title" />
          <div className="loading-line" />
          <div className="loading-field" />
          <div className="loading-field" />
          <div className="loading-button" />
        </div>
      </div>
    </main>
  );
}
