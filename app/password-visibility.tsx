"use client";

import { useEffect } from "react";

export default function PasswordVisibility() {
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const attach = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]')).forEach(input => {
      if (input.closest(".password-input") || input.dataset.visibilityReady) return;
      input.dataset.visibilityReady = "true";

      const wrapper = document.createElement("div");
      wrapper.className = "password-input password-input-login";
      input.parentNode?.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "password-toggle";
      button.setAttribute("aria-label", "Show password");
      button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
      wrapper.appendChild(button);

      const toggle = () => {
        const visible = input.type === "text";
        input.type = visible ? "password" : "text";
        button.setAttribute("aria-label", visible ? "Show password" : "Hide password");
        button.setAttribute("aria-pressed", String(!visible));
      };
      button.addEventListener("click", toggle);
      cleanups.push(() => button.removeEventListener("click", toggle));
    });

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    const retry = window.setTimeout(attach, 250);
    return () => {
      observer.disconnect();
      window.clearTimeout(retry);
      cleanups.forEach(cleanup => cleanup());
    };
  }, []);

  return null;
}
