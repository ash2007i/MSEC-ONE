import { useEffect, useRef, useState } from "react";
import { ServiceUnavailableError } from "./services";

/** One in-flight action; abort on navigation and never set state on an unmounted page. */
export function useServiceAction() {
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      controller.current = null;
    };
  }, []);
  async function run<T>(
    action: (signal: AbortSignal) => Promise<T>,
    onSuccess?: (value: T) => void,
  ) {
    if (controller.current) return;
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError("");
    try {
      const value = await action(current.signal);
      if (mounted.current && !current.signal.aborted) onSuccess?.(value);
    } catch (caught) {
      if (mounted.current && !current.signal.aborted) {
        setError(
          caught instanceof ServiceUnavailableError
            ? caught.message
            : typeof navigator !== "undefined" && !navigator.onLine
              ? "You’re offline. Check your connection and try again."
              : "The service could not confirm this action. Please try again.",
        );
      }
    } finally {
      if (controller.current === current) {
        controller.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  }
  return { busy, error, setError, run };
}
