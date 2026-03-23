import { FileText, Search } from "lucide-react";

interface EmptyLibraryStateProps {
  isFiltered: boolean;
}

export function EmptyLibraryState({ isFiltered }: EmptyLibraryStateProps) {
  if (isFiltered) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-muted/30">
          <Search className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          No notes match your filters
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Try a different search term or clear your active tags.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-muted/30">
        <FileText className="h-5 w-5 text-muted-foreground/50" />
      </div>
      <p className="mt-4 text-sm font-medium text-muted-foreground">
        Your vault is empty
      </p>
      <p className="mt-1 text-xs text-muted-foreground/60 max-w-xs">
        Start capturing ideas, architecture decisions, debugging sessions, and
        research fragments.
      </p>
    </div>
  );
}
