"use client";

import { useEffect } from "react";

/**
 * Prevents browser extension errors (e.g. Bitdefender chrome-extension://...)
 * from bubbling up and triggering Next.js dev overlay dialogs.
 */
export function ExtensionErrorSilencer() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (
        event.filename?.startsWith("chrome-extension://") ||
        event.error?.stack?.includes("chrome-extension://") ||
        event.message?.includes("M_ID")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason?.stack?.includes("chrome-extension://") ||
        event.reason?.message?.includes("M_ID")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener("error", handleError, true);
    window.addEventListener("unhandledrejection", handleUnhandledRejection, true);

    return () => {
      window.removeEventListener("error", handleError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection, true);
    };
  }, []);

  return null;
}
