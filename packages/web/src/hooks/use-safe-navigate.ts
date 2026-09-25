import { useCallback, useContext } from "react";
import { UNSAFE_NavigationContext } from "react-router-dom";

/** navigate() that works inside a router and falls back to a full load outside one. */
export function useSafeNavigate(): (to: string) => void {
  const ctx = useContext(UNSAFE_NavigationContext) as { navigator?: { push(to: string): void } } | null;
  return useCallback(
    (to: string) => {
      if (ctx?.navigator) ctx.navigator.push(to);
      else window.location.assign(to);
    },
    [ctx],
  );
}
