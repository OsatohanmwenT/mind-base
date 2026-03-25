import "server-only";

import { createHash } from "node:crypto";

import { createInsforgeServerClient } from "@/lib/insforge/server";

const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_SEMANTIC_RESULT_LIMIT = 20;
const MIN_SEMANTIC_QUERY_LENGTH = 3;

type NoteEmbeddingSource = {
  noteId: string;
  userId: string;
  title: string;
  summary: string;
  content: string;
};

type SearchSemanticNoteRecord = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  summary: string;
  tags: string[] | null;
  status: "draft" | "organized";
  created_at: string;
  updated_at: string;
  similarity: number;
};

function getEmbeddingModel() {
  return process.env.INSFORGE_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
}

export function getMinSemanticQueryLength() {
  return MIN_SEMANTIC_QUERY_LENGTH;
}

export function getSemanticResultLimit() {
  return DEFAULT_SEMANTIC_RESULT_LIMIT;
}

export function buildNoteEmbeddingInput(
  input: Omit<NoteEmbeddingSource, "noteId" | "userId">
) {
  return [
    `Title: ${input.title.trim() || "Untitled note"}`,
    input.summary.trim() ? `Summary: ${input.summary.trim()}` : null,
    `Content:\n${input.content.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function hashEmbeddingInput(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function serializeEmbeddingVector(embedding: number[]) {
  if (embedding.length !== DEFAULT_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${DEFAULT_EMBEDDING_DIMENSIONS} embedding dimensions but received ${embedding.length}.`
    );
  }

  return `[${embedding.join(",")}]`;
}

export async function createEmbeddingForText(
  accessToken: string,
  input: string
): Promise<{
  embedding: number[];
  model: string;
}> {
  const insforge = createInsforgeServerClient(accessToken);
  const response = await insforge.ai.embeddings.create({
    model: getEmbeddingModel(),
    input,
    dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
  });

  const embedding = response.data?.[0]?.embedding;
  const model = response.metadata?.model || getEmbeddingModel();

  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("Embedding request returned no vector.");
  }

  return {
    embedding,
    model,
  };
}

export async function upsertNoteEmbedding(
  accessToken: string,
  source: NoteEmbeddingSource
) {
  const embeddingInput = buildNoteEmbeddingInput(source);
  const contentHash = hashEmbeddingInput(embeddingInput);
  const { embedding, model } = await createEmbeddingForText(
    accessToken,
    embeddingInput
  );
  const insforge = createInsforgeServerClient(accessToken);

  const { error } = await insforge.database.from("note_embeddings").upsert([
    {
      note_id: source.noteId,
      embedding: serializeEmbeddingVector(embedding),
      user_id: source.userId,
      embedding_model: model,
      embedding_version: 1,
      content_hash: contentHash,
      status: "ready",
      last_embedded_at: new Date().toISOString(),
      last_error: null,
    },
  ]);

  if (error) {
    throw new Error(error.message || "Unable to store note embedding.");
  }
}

export async function markNoteEmbeddingFailed(
  accessToken: string,
  noteId: string,
  userId: string,
  errorMessage: string
) {
  const insforge = createInsforgeServerClient(accessToken);
  const { error } = await insforge.database.from("note_embeddings").upsert([
    {
      note_id: noteId,
      user_id: userId,
      embedding: new Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0),
      embedding_model: getEmbeddingModel(),
      embedding_version: 1,
      content_hash: "",
      status: "failed",
      last_error: errorMessage.slice(0, 1000),
      last_embedded_at: null,
    },
  ]);

  if (error) {
    throw new Error(error.message || "Unable to record embedding failure.");
  }
}

export async function searchNotesSemantic(
  accessToken: string,
  input: {
    query: string;
    tags: string[];
    limit?: number;
  }
) {
  const { embedding } = await createEmbeddingForText(accessToken, input.query);
  const insforge = createInsforgeServerClient(accessToken);
  const { data, error } = await insforge.database.rpc("search_notes_semantic", {
    p_embedding: embedding,
    p_tags: input.tags,
    p_limit: input.limit ?? DEFAULT_SEMANTIC_RESULT_LIMIT,
  });

  if (error) {
    throw new Error(error.message || "Unable to run semantic search.");
  }

  return (data ?? []) as SearchSemanticNoteRecord[];
}
