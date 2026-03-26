"use client";

import { useSyncExternalStore } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";

function subscribePlatform() {
  return () => {};
}

function getIsMacClient() {
  return navigator.platform.toUpperCase().includes("MAC");
}

function getIsMacServer() {
  return true;
}

export function CommandMenuTrigger() {
  const isMac = useSyncExternalStore(subscribePlatform, getIsMacClient, getIsMacServer);

  function handleClick() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        metaKey: isMac,
        ctrlKey: !isMac,
        bubbles: true,
      })
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-2 text-xs text-muted-foreground hidden sm:flex"
      onClick={handleClick}
      suppressHydrationWarning
    >
      <Search className="h-3 w-3" />
      <span>Search</span>
      <kbd className="pointer-events-none rounded border border-border/60 bg-muted/50 px-1 py-0.5 font-mono text-[10px] leading-none text-muted-foreground/60">
        {isMac ? "⌘K" : "Ctrl+K"}
      </kbd>
    </Button>
  );
}
