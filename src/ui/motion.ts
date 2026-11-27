import type { RefObject } from "react";
import { useEffect, useRef } from "react";

export function motionIsReduced() {
  return (
    document.documentElement.dataset.motion === "reduced" ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** Keep the mounted dialog for its short fade-out, then use its existing close action. */
export function useAnimatedDismiss(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const latest = useRef(onClose);
  latest.current = onClose;
  const animation = useRef<Animation | null>(null);
  useEffect(
    () => () => {
      animation.current?.cancel();
      animation.current = null;
    },
    [],
  );
  return () => {
    if (animation.current) return;
    const element =
      ref.current?.closest<HTMLElement>(".sheet-backdrop, .msg-overlay") ?? ref.current;
    if (!element?.animate || motionIsReduced()) {
      latest.current();
      return;
    }
    const current = element.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 120,
      easing: "ease-out",
      fill: "forwards",
    });
    animation.current = current;
    void current.finished
      .then(() => {
        if (animation.current === current && element.isConnected) {
          latest.current();
          // If a caller elects not to close (e.g. a submission is in flight), remain visible.
          current.cancel();
          animation.current = null;
        }
      })
      .catch(() => {});
  };
}
