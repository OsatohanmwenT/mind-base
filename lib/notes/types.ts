import type { NotesSearchParams } from "./search-params";

export type NoteStatus = "draft" | "organized";
export type NoteEditorSaveState =
  | "clean"
  | "dirty"
  | "saving"
  | "saved"
  | "error";
export type NotesSearchMode = "browse" | "semantic" | "fallback";
export type NoteImageStatus = "pending" | "uploaded" | "failed";

export type SortMode = NotesSearchParams["sort"];

export interface Note {
  id: string;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  userTags?: string[];
  aiTags?: string[];
  updatedAt: string;
  createdAt: string;
  imageCount: number;
  wordCount: number;
  status: NoteStatus;
  isPinned?: boolean;
}

export type AutoOrganizeQualityTier =
  | "Budget"
  | "Balanced"
  | "Premium"
  | "Experimental";

export type AutoOrganizeSpeedTier = "Fast" | "Medium" | "Slow" | "Unknown";
export type AutoOrganizeCostTier = "Low" | "Medium" | "High" | "Unknown";

export interface AutoOrganizeModelOption {
  id: string;
  label: string;
  provider: string;
  qualityTier: AutoOrganizeQualityTier;
  speedTier: AutoOrganizeSpeedTier;
  costTier: AutoOrganizeCostTier;
  recommended?: boolean;
}

export interface AutoOrganizeSuggestion {
  title: string;
  summary: string;
  tags: string[];
  modelId: string;
  sourceHash: string;
}

export interface AutoOrganizeGenerateResult {
  error: string | null;
  suggestion: AutoOrganizeSuggestion | null;
}

export interface AutoOrganizeApplyInput {
  noteId: string;
  sourceHash: string;
  title: string;
  summary: string;
  tags: string[];
}

export interface AutoOrganizeApplyResult {
  error: string | null;
  note: Note | null;
}

export interface NoteImage {
  id: string;
  noteId: string;
  bucket: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  status: NoteImageStatus;
  uploadedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
  readUrl: string | null;
  readUrlExpiresAt: string | null;
}

export interface RequestNoteImageUploadInput {
  filename: string;
  mimeType: string;
  size: number;
}

export interface NoteImageUploadTarget {
  uploadUrl: string;
  fields: Record<string, string>;
  confirmUrl: string | null;
  expiresAt: string | null;
}

export interface RequestNoteImageUploadResult {
  image: NoteImage;
  upload: NoteImageUploadTarget;
}

export interface CompleteNoteImageUploadInput {
  imageId: string;
  confirmUrl?: string | null;
}

export interface CompleteNoteImageUploadResult {
  image: NoteImage;
}

export interface RefreshNoteImageReadUrlResult {
  readUrl: string;
  expiresAt: string | null;
}

export interface DeleteNoteImageResult {
  imageId: string;
}

export interface FailNoteImageUploadInput {
  imageId: string;
  error?: string;
}

export interface FailNoteImageUploadResult {
  image: NoteImage;
}

export interface NotesListResult {
  notes: Note[];
  totalCount: number;
  searchMode: NotesSearchMode;
}

export type CommandPaletteSearchMode = "semantic" | "fallback";

export interface CommandPaletteNoteItem {
  kind: "note";
  id: string;
  title: string;
  snippet: string;
  tags: string[];
  updatedAt: string;
  status: NoteStatus;
}

export type CommandPaletteItem = CommandPaletteNoteItem;

export interface CommandPaletteResult {
  items: CommandPaletteItem[];
  searchMode: CommandPaletteSearchMode;
  error: string | null;
}
