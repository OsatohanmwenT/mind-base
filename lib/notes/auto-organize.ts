import "server-only";

import { createHash } from "node:crypto";

import { createInsforgeServerClient } from "@/lib/insforge/server";

import {
  AUTO_ORGANIZE_MAX_SUMMARY_LENGTH,
  AUTO_ORGANIZE_MAX_TAGS,
  AUTO_ORGANIZE_MAX_TITLE_LENGTH,
  AUTO_ORGANIZE_MIN_WORD_COUNT,
} from "./auto-organize-shared";
import { countWords, normalizeTags } from "./normalization";
import type {
  AutoOrganizeModelOption,
  AutoOrganizeSuggestion,
} from "./types";

const AUTO_ORGANIZE_RATE_LIMIT_COUNT = 10;
const AUTO_ORGANIZE_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const AUTO_ORGANIZE_SUPPORTED_TEXT_MODELS = new Set([
  "openai/gpt-4o-mini",
  "anthropic/claude-sonnet-4.5",
  "deepseek/deepseek-v3.2",
  "minimax/minimax-m2.1",
  "x-ai/grok-4.1-fast",
]);
const AUTO_ORGANIZE_RECOMMENDED_MODEL = "openai/gpt-4o-mini";

type ModelCatalogEntry = Omit<AutoOrganizeModelOption, "id">;

type AutoOrganizeAvailability = {
  models: AutoOrganizeModelOption[];
  preferredModelId: string | null;
  error: string | null;
};

type AutoOrganizeRunStatus =
  | "started"
  | "succeeded"
  | "failed"
  | "rate_limited";

type AIConfiguration = {
  enabled?: boolean;
  modelId?: string;
  name?: string;
};

const MODEL_CATALOG: Record<string, ModelCatalogEntry> = {
  "openai/gpt-4o-mini": {
    label: "GPT-4o mini",
    provider: "OpenAI",
    qualityTier: "Balanced",
    speedTier: "Fast",
    costTier: "Low",
    recommended: true,
  },
  "anthropic/claude-sonnet-4.5": {
    label: "Claude Sonnet 4.5",
    provider: "Anthropic",
    qualityTier: "Premium",
    speedTier: "Medium",
    costTier: "High",
  },
  "deepseek/deepseek-v3.2": {
    label: "DeepSeek V3.2",
    provider: "DeepSeek",
    qualityTier: "Budget",
    speedTier: "Fast",
    costTier: "Low",
  },
  "minimax/minimax-m2.1": {
    label: "MiniMax M2.1",
    provider: "MiniMax",
    qualityTier: "Experimental",
    speedTier: "Unknown",
    costTier: "Unknown",
  },
  "x-ai/grok-4.1-fast": {
    label: "Grok 4.1 Fast",
    provider: "xAI",
    qualityTier: "Experimental",
    speedTier: "Fast",
    costTier: "Unknown",
  },
};

function getInsforgeBaseUrl() {
  const value = process.env.NEXT_PUBLIC_INSFORGE_URL;

  if (!value) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_INSFORGE_URL");
  }

  return value;
}

function getInsforgeAdminKey() {
  const value =
    process.env.INSFORGE_PROJECT_API_KEY ?? process.env.INSFORGE_API_KEY;

  if (!value) {
    throw new Error(
      "Auto-organize is unavailable because no InsForge admin API key is configured."
    );
  }

  return value;
}

function titleCase(input: string) {
  return input
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isAutoOrganizeCompatibleModel(modelId: string) {
  return AUTO_ORGANIZE_SUPPORTED_TEXT_MODELS.has(modelId);
}

function getModelCatalogEntry(modelId: string): ModelCatalogEntry {
  const configured = MODEL_CATALOG[modelId];

  if (configured) {
    return configured;
  }

  const [providerPart, rawLabel] = modelId.split("/", 2);

  return {
    label: rawLabel ? titleCase(rawLabel) : modelId,
    provider: providerPart ? titleCase(providerPart) : "Custom",
    qualityTier: "Experimental",
    speedTier: "Unknown",
    costTier: "Unknown",
  };
}

function sortModels(models: AutoOrganizeModelOption[]) {
  return [...models].sort((left, right) => {
    if (left.recommended && !right.recommended) return -1;
    if (!left.recommended && right.recommended) return 1;
    return left.label.localeCompare(right.label);
  });
}

function extractMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function stripJsonCodeFence(input: string) {
  const trimmed = input.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function validateSuggestionPayload(
  modelId: string,
  sourceHash: string,
  payload: unknown
): AutoOrganizeSuggestion {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("The AI response was not a valid JSON object.");
  }

  const record = payload as Record<string, unknown>;
  const title =
    typeof record.title === "string"
      ? record.title.trim().slice(0, AUTO_ORGANIZE_MAX_TITLE_LENGTH)
      : "";
  const summary =
    typeof record.summary === "string"
      ? record.summary.trim().slice(0, AUTO_ORGANIZE_MAX_SUMMARY_LENGTH)
      : "";
  const rawTags = Array.isArray(record.tags)
    ? record.tags.filter((value): value is string => typeof value === "string")
    : [];
  const tags = normalizeTags(rawTags).slice(0, AUTO_ORGANIZE_MAX_TAGS);

  if (!title) {
    throw new Error("The AI response did not include a usable title.");
  }

  if (!summary) {
    throw new Error("The AI response did not include a usable summary.");
  }

  return {
    title,
    summary,
    tags,
    modelId,
    sourceHash,
  };
}

function buildPrompt(input: {
  title: string;
  content: string;
  userTags: string[];
}) {
  const manualTags = input.userTags.length > 0 ? input.userTags.join(", ") : "none";

  return [
    "Analyze this private engineering note and organize its metadata.",
    "Return JSON only with this exact shape:",
    '{"title":"string","summary":"string","tags":["string"]}',
    `Rules: title <= ${AUTO_ORGANIZE_MAX_TITLE_LENGTH} chars; summary <= ${AUTO_ORGANIZE_MAX_SUMMARY_LENGTH} chars; tags <= ${AUTO_ORGANIZE_MAX_TAGS} short lowercase-friendly items.`,
    "Do not rewrite or quote the note content. Improve organization only.",
    "",
    `Current title: ${input.title.trim() || "Untitled note"}`,
    `Current manual tags: ${manualTags}`,
    "Content:",
    input.content.trim(),
  ].join("\n");
}

export function getAutoOrganizeMinimumWordCount() {
  return AUTO_ORGANIZE_MIN_WORD_COUNT;
}

export function getAutoOrganizeRecommendedModelId() {
  return AUTO_ORGANIZE_RECOMMENDED_MODEL;
}

export function hashAutoOrganizeSource(input: {
  title: string;
  content: string;
  userTags: string[];
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: input.title.trim(),
        content: input.content,
        userTags: [...input.userTags].sort((left, right) =>
          left.localeCompare(right)
        ),
      })
    )
    .digest("hex");
}

export async function listAutoOrganizeModels(): Promise<AutoOrganizeModelOption[]> {
  const response = await fetch(`${getInsforgeBaseUrl()}/api/ai/configurations`, {
    headers: {
      Authorization: `Bearer ${getInsforgeAdminKey()}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to load the configured InsForge AI models.");
  }

  const payload = (await response.json()) as
    | AIConfiguration[]
    | {
        configurations?: AIConfiguration[];
      };
  const configurations = Array.isArray(payload)
    ? payload
    : payload.configurations ?? [];

  const models = configurations
    .filter(
      (configuration): configuration is Required<Pick<AIConfiguration, "modelId">> &
        AIConfiguration =>
        typeof configuration?.modelId === "string" &&
        configuration.enabled !== false &&
        isAutoOrganizeCompatibleModel(configuration.modelId)
    )
    .map((configuration) => {
      const metadata = getModelCatalogEntry(configuration.modelId);

      return {
        id: configuration.modelId,
        ...metadata,
      };
    });

  return sortModels(models);
}

export function pickAutoOrganizeDefaultModel(
  models: AutoOrganizeModelOption[],
  preferredModelId: string | null
) {
  if (preferredModelId) {
    const preferred = models.find((model) => model.id === preferredModelId);

    if (preferred) {
      return preferred.id;
    }
  }

  return (
    models.find((model) => model.id === AUTO_ORGANIZE_RECOMMENDED_MODEL)?.id ??
    models[0]?.id ??
    null
  );
}

export async function getAutoOrganizeAvailability(
  accessToken: string
): Promise<AutoOrganizeAvailability> {
  try {
    const [models, preferredModelId] = await Promise.all([
      listAutoOrganizeModels(),
      getPreferredAutoOrganizeModel(accessToken),
    ]);

    return {
      models,
      preferredModelId: pickAutoOrganizeDefaultModel(models, preferredModelId),
      error:
        models.length === 0
          ? "No supported InsForge AI models are enabled for auto-organize."
          : null,
    };
  } catch (error) {
    return {
      models: [],
      preferredModelId: null,
      error:
        error instanceof Error
          ? error.message
          : "Auto-organize is unavailable right now.",
    };
  }
}

export async function getPreferredAutoOrganizeModel(accessToken: string) {
  const insforge = createInsforgeServerClient(accessToken);
  const { data, error } = await insforge.database
    .from("user_preferences")
    .select("preferred_auto_organize_model_id")
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message || "Unable to load your auto-organize preference."
    );
  }

  return data?.preferred_auto_organize_model_id ?? null;
}

async function resolveCurrentUserId(accessToken: string) {
  const insforge = createInsforgeServerClient(accessToken);
  const {
    data: authData,
    error,
  } = await insforge.auth.getCurrentUser();

  if (error || !authData.user?.id) {
    throw new Error(error?.message || "Unable to resolve the current user.");
  }

  return authData.user.id;
}

export async function savePreferredAutoOrganizeModel(
  accessToken: string,
  userId: string,
  modelId: string
) {
  const insforge = createInsforgeServerClient(accessToken);
  const { error } = await insforge.database.from("user_preferences").upsert([
    {
      user_id: userId,
      preferred_auto_organize_model_id: modelId,
    },
  ]);

  if (error) {
    throw new Error(
      error.message || "Unable to save your auto-organize preference."
    );
  }
}

export async function assertWithinAutoOrganizeRateLimit(
  accessToken: string,
  noteId: string
) {
  const insforge = createInsforgeServerClient(accessToken);
  const cutoff = new Date(
    Date.now() - AUTO_ORGANIZE_RATE_LIMIT_WINDOW_MS
  ).toISOString();

  const [{ count: recentCount, error: recentError }, { count: activeCount, error: activeError }] =
    await Promise.all([
      insforge.database
        .from("note_auto_organize_runs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", cutoff),
      insforge.database
        .from("note_auto_organize_runs")
        .select("*", { count: "exact", head: true })
        .eq("note_id", noteId)
        .eq("status", "started")
        .gte("created_at", cutoff),
    ]);

  if (recentError) {
    throw new Error(recentError.message || "Unable to verify rate limits.");
  }

  if (activeError) {
    throw new Error(activeError.message || "Unable to verify request state.");
  }

  if ((activeCount ?? 0) > 0) {
    throw new Error("Auto-organize is already running for this note.");
  }

  if ((recentCount ?? 0) >= AUTO_ORGANIZE_RATE_LIMIT_COUNT) {
    throw new Error(
      "You have reached the auto-organize limit. Try again in a few minutes."
    );
  }
}

export async function createAutoOrganizeRun(
  accessToken: string,
  input: {
    noteId: string;
    userId: string;
    requestedModelId: string;
    sourceHash: string;
  }
) {
  const insforge = createInsforgeServerClient(accessToken);
  const { data, error } = await insforge.database
    .from("note_auto_organize_runs")
    .insert([
      {
        note_id: input.noteId,
        user_id: input.userId,
        requested_model_id: input.requestedModelId,
        source_hash: input.sourceHash,
        status: "started",
      },
    ])
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Unable to record the auto-organize run.");
  }

  return data.id as string;
}

export async function completeAutoOrganizeRun(
  accessToken: string,
  runId: string,
  input: {
    status: AutoOrganizeRunStatus;
    resolvedModelId?: string;
    errorCode?: string;
    errorMessage?: string;
    startedAt: number;
  }
) {
  const insforge = createInsforgeServerClient(accessToken);
  const { error } = await insforge.database
    .from("note_auto_organize_runs")
    .update({
      status: input.status,
      resolved_model_id: input.resolvedModelId ?? null,
      error_code: input.errorCode ?? null,
      error_message: input.errorMessage ?? null,
      latency_ms: Date.now() - input.startedAt,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) {
    throw new Error(error.message || "Unable to finalize the auto-organize run.");
  }
}

export async function createRateLimitedAutoOrganizeRun(
  accessToken: string,
  input: {
    noteId: string;
    userId: string;
    requestedModelId: string;
    sourceHash: string;
    message: string;
  }
) {
  const insforge = createInsforgeServerClient(accessToken);
  const { error } = await insforge.database.from("note_auto_organize_runs").insert([
    {
      note_id: input.noteId,
      user_id: input.userId,
      requested_model_id: input.requestedModelId,
      source_hash: input.sourceHash,
      status: "rate_limited",
      error_code: "rate_limited",
      error_message: input.message,
      finished_at: new Date().toISOString(),
      latency_ms: 0,
    },
  ]);

  if (error) {
    throw new Error(
      error.message || "Unable to record the rate-limited auto-organize run."
    );
  }
}

export async function generateAutoOrganizeSuggestion(
  accessToken: string,
  input: {
    noteId: string;
    requestedModelId: string;
    title: string;
    content: string;
    userTags: string[];
  }
) {
  if (countWords(input.content) < AUTO_ORGANIZE_MIN_WORD_COUNT) {
    throw new Error(
      `Write at least ${AUTO_ORGANIZE_MIN_WORD_COUNT} words before using auto-organize.`
    );
  }

  const sourceHash = hashAutoOrganizeSource(input);
  const userId = await resolveCurrentUserId(accessToken);
  const models = await listAutoOrganizeModels();
  const selectedModel = models.find((model) => model.id === input.requestedModelId);

  if (!selectedModel) {
    throw new Error("The selected AI model is no longer available.");
  }

  try {
    await assertWithinAutoOrganizeRateLimit(accessToken, input.noteId);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "You have reached the auto-organize limit. Try again in a few minutes.";

    await createRateLimitedAutoOrganizeRun(accessToken, {
      noteId: input.noteId,
      userId,
      requestedModelId: input.requestedModelId,
      sourceHash,
      message,
    });

    throw error;
  }

  const startedAt = Date.now();
  const runId = await createAutoOrganizeRun(accessToken, {
    noteId: input.noteId,
    userId,
    requestedModelId: input.requestedModelId,
    sourceHash,
  });
  const insforge = createInsforgeServerClient(accessToken);

  try {
    const prompt = buildPrompt(input);
    let response = await insforge.ai.chat.completions.create({
      model: selectedModel.id,
      temperature: 0.2,
      maxTokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You organize notes. Return JSON only and never include markdown fences.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    let rawContent = extractMessageText(response?.choices?.[0]?.message?.content);

    try {
      const parsed = JSON.parse(stripJsonCodeFence(rawContent));
      const suggestion = validateSuggestionPayload(
        selectedModel.id,
        sourceHash,
        parsed
      );

      await completeAutoOrganizeRun(accessToken, runId, {
        status: "succeeded",
        resolvedModelId: selectedModel.id,
        startedAt,
      });

      return suggestion;
    } catch {
      response = await insforge.ai.chat.completions.create({
        model: selectedModel.id,
        temperature: 0,
        maxTokens: 300,
        messages: [
          {
            role: "system",
            content:
              "Return only valid JSON with keys title, summary, tags. No markdown. No explanation.",
          },
          {
            role: "user",
            content: `${prompt}\n\nReturn valid JSON now.`,
          },
        ],
      });

      rawContent = extractMessageText(response?.choices?.[0]?.message?.content);
      const parsed = JSON.parse(stripJsonCodeFence(rawContent));
      const suggestion = validateSuggestionPayload(
        selectedModel.id,
        sourceHash,
        parsed
      );

      await completeAutoOrganizeRun(accessToken, runId, {
        status: "succeeded",
        resolvedModelId: selectedModel.id,
        startedAt,
      });

      return suggestion;
    }
  } catch (error) {
    await completeAutoOrganizeRun(accessToken, runId, {
      status: "failed",
      resolvedModelId: selectedModel.id,
      errorCode: "generation_failed",
      errorMessage:
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "Auto-organize failed.",
      startedAt,
    });

    throw error;
  }
}
