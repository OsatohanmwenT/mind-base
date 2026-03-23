export type NoteStatus = "draft" | "organized";

export type SortMode = "updated" | "created" | "alpha";

export interface Note {
  id: string;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  updatedAt: string;
  createdAt: string;
  imageCount: number;
  wordCount: number;
  status: NoteStatus;
  isPinned?: boolean;
}
