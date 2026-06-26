import { useEffect, useState } from "react";

const isBrowser = typeof window !== "undefined";

const resolveInitialValue = (initialValue) =>
  typeof initialValue === "function" ? initialValue() : initialValue;

const defaultHasDraft = (value) => {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.some(defaultHasDraft);
  }

  if (value && typeof value === "object") {
    return Object.values(value).some(defaultHasDraft);
  }

  return Boolean(value);
};

export function usePersistedDraft(storageKey, initialValue, hasDraftValue = defaultHasDraft) {
  const [value, setValue] = useState(() => {
    const fallbackValue = resolveInitialValue(initialValue);

    if (!isBrowser) {
      return fallbackValue;
    }

    try {
      const storedValue = window.localStorage.getItem(storageKey);
      return storedValue ? JSON.parse(storedValue) : fallbackValue;
    } catch {
      return fallbackValue;
    }
  });

  const hasDraft = hasDraftValue(value);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    try {
      if (hasDraft) {
        window.localStorage.setItem(storageKey, JSON.stringify(value));
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      // Ignore storage errors so the form still works without persistence.
    }
  }, [hasDraft, storageKey, value]);

  const clearDraft = () => {
    const nextValue = resolveInitialValue(initialValue);
    setValue(nextValue);

    if (isBrowser) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Ignore storage errors so the form still resets normally.
      }
    }

    return nextValue;
  };

  return { value, setValue, clearDraft, hasDraft };
}

export function useBeforeUnloadWarning(enabled) {
  useEffect(() => {
    if (!enabled || !isBrowser) {
      return;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled]);
}
