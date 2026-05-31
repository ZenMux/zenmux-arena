import * as React from "react"

const MOBILE_BREAKPOINT = 768

// Subscribe to the viewport width via matchMedia using useSyncExternalStore —
// the concurrent-safe way to read external (browser) state, with no
// setState-in-effect. getServerSnapshot returns a stable `false` so SSR and the
// first client render agree (no hydration mismatch).
function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  )
}
