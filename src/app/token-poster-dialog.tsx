"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const POSTER_URL =
  "https://static.zenmux.ai/public/images/thinkthinking/redpacket-TOKENS-poster.png";

interface TokenPosterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
}

export function TokenPosterDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: TokenPosterDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] gap-3 overflow-y-auto overscroll-contain sm:max-w-6xl motion-reduce:animate-none"
        onCloseAutoFocus={onCloseAutoFocus}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="pr-12">
          <DialogTitle>一份 Token 彩蛋</DialogTitle>
          <DialogDescription>扫码领取，兑换码 TOKENS。</DialogDescription>
        </DialogHeader>
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 size-11 cursor-pointer touch-manipulation"
            aria-label="关闭海报"
          >
            <X aria-hidden="true" />
          </Button>
        </DialogClose>
        <PosterImage />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">放心扫码，弹窗不会自动关闭。</p>
          <Button variant="outline" asChild className="min-h-11 touch-manipulation">
            <a href={POSTER_URL} target="_blank" rel="noopener noreferrer">
              打开原图
              <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog content unmounts on close, giving every reveal a fresh load state. */
function PosterImage() {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  return (
    <div className="relative aspect-video max-h-[calc(100dvh-14rem)] w-full overflow-hidden rounded-lg">
      {status === "loading" && (
        <div className="absolute inset-0" role="status">
          <Skeleton className="size-full motion-reduce:animate-none" />
          <span className="sr-only">正在加载海报…</span>
        </div>
      )}
      {status === "error" ? (
        <div className="flex size-full flex-col items-center justify-center gap-3 bg-muted p-4 text-center">
          <p role="status" className="text-sm text-muted-foreground">
            海报加载失败，请重试或打开原图。
          </p>
          <Button
            variant="outline"
            className="min-h-11 cursor-pointer touch-manipulation"
            onClick={() => {
              setStatus("loading");
              setAttempt((value) => value + 1);
            }}
          >
            重新加载
          </Button>
        </div>
      ) : (
        <Image
          key={attempt}
          src={POSTER_URL}
          alt="ZenMux Token 红包海报，扫描二维码领取，兑换码 TOKENS"
          fill
          sizes="(max-width: 640px) calc(100vw - 4rem), 1120px"
          loading="eager"
          // Keep the original PNG so QR modules are not lossily re-encoded.
          unoptimized
          className={cn("object-contain", status === "loading" && "opacity-0")}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      )}
    </div>
  );
}
