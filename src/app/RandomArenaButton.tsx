"use client";

// The hero's primary CTA. Sends the visitor into a *randomly* chosen live
// experiment, picked in the browser at click time — never at render. The hub
// page is a server component that reads the filesystem per request; if it also
// rolled the dice, the server HTML and the client hydration could disagree on
// the href and trigger a hydration mismatch. Deferring the choice to onClick
// sidesteps that and means the button auto-scales as more live experiments are
// added — no code change here when the registry grows.
//
// `hrefs` is a plain string[] (serializable) so the server can hand the live
// entry points across the RSC boundary without leaking the icon/JSX-bearing
// Experiment objects.

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RandomArenaButton({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();
  // Used both as the no-JS / right-click-open fallback target and as the lone
  // destination when there's only one live experiment.
  const fallback = hrefs[0] ?? "/research/studio";

  function go(e: React.MouseEvent<HTMLAnchorElement>) {
    if (hrefs.length <= 1) return; // let the <Link> handle the single-arena case
    e.preventDefault();
    const pick = hrefs[Math.floor(Math.random() * hrefs.length)];
    router.push(pick);
  }

  return (
    <Button asChild size="lg" className="group h-12 rounded-full px-6">
      <Link href={fallback} onClick={go}>
        <Shuffle data-icon="inline-start" />
        Enter a Random Arena
        <ArrowRight
          data-icon="inline-end"
          className="transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </Button>
  );
}
