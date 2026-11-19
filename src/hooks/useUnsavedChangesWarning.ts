"use client";

import { useEffect, useRef, useCallback } from "react";

export interface UseUnsavedChangesWarningOptions {
  isDirty: boolean;
  message?: string;
}

/**
 * Universal hook to protect quotation & R&D forms from accidental data loss.
 *
 * Provides:
 * 1. Native Chrome / browser popup on tab/window close or page refresh (beforeunload).
 * 2. Native Chrome confirm modal on browser back/forward buttons (popstate).
 * 3. Native Chrome confirm modal when clicking in-app navigation links (Back button, navbar, sidebar).
 * 4. markAsSaved() callback to smoothly allow navigation after saving.
 */
export function useUnsavedChangesWarning({
  isDirty,
  message = "You have unsaved changes. Are you sure you want to leave without saving?",
}: UseUnsavedChangesWarningOptions) {
  const isDirtyRef = useRef(isDirty);
  const isSavedRef = useRef(false);
  const hasPushedTrapRef = useRef(false);

  useEffect(() => {
    isDirtyRef.current = isDirty;
    if (isDirty) {
      isSavedRef.current = false;
    }
  }, [isDirty]);

  const markAsSaved = useCallback(() => {
    isSavedRef.current = true;
    isDirtyRef.current = false;
  }, []);

  // 1. Browser tab / window close / page reload (F5 / Ctrl+R / close tab)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current && !isSavedRef.current) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // 2. Browser Back / Forward buttons (popstate trap)
  useEffect(() => {
    if (!isDirty) {
      hasPushedTrapRef.current = false;
      return;
    }

    // Arm the history trap when dirty
    if (!hasPushedTrapRef.current && typeof window !== "undefined") {
      try {
        window.history.pushState({ unsavedTrap: true }, "", window.location.href);
        hasPushedTrapRef.current = true;
      } catch {}
    }

    const handlePopState = () => {
      if (isDirtyRef.current && !isSavedRef.current) {
        const confirmLeave = window.confirm(message);
        if (!confirmLeave) {
          // User chose to stay: re-arm history trap
          try {
            window.history.pushState({ unsavedTrap: true }, "", window.location.href);
          } catch {}
        } else {
          // User chose to leave: disarm and let them navigate back
          isDirtyRef.current = false;
          isSavedRef.current = true;
          window.history.back();
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty, message]);

  // 3. In-app navigation clicks (Links, Back to list, sidebar, logo)
  useEffect(() => {
    const handleCaptureClick = (e: MouseEvent) => {
      if (!isDirtyRef.current || isSavedRef.current) return;

      const target = (e.target as HTMLElement)?.closest("a");
      if (!target || !target.href) return;

      // Ignore external tabs, downloads, or on-page fragment links
      if (
        target.target === "_blank" ||
        target.hasAttribute("download") ||
        target.getAttribute("href")?.startsWith("#")
      ) {
        return;
      }

      // Check if the link navigates away from the current page
      const currentUrl = window.location.href.split("#")[0].split("?")[0];
      const targetUrl = target.href.split("#")[0].split("?")[0];

      if (targetUrl !== currentUrl || target.href !== window.location.href) {
        const confirmLeave = window.confirm(message);
        if (!confirmLeave) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        } else {
          isDirtyRef.current = false;
          isSavedRef.current = true;
        }
      }
    };

    document.addEventListener("click", handleCaptureClick, true);
    return () => {
      document.removeEventListener("click", handleCaptureClick, true);
    };
  }, [message]);

  return { markAsSaved };
}
