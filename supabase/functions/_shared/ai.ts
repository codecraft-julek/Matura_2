// The one place that talks to the AI provider, for all Edge Functions. Deno only: the website
// never imports this file.
//
// Provider: OpenAI. Setting the AI_PROVIDER secret to "anthropic" switches to Claude (not live yet:
// the privacy policy names OpenAI, and Anthropic's rules for users under 18 must be met first).
// Secrets:
//   ANTHROPIC_API_KEY     Claude key
//   ANTHROPIC_MODEL       optional, default below
//   OPENAI_API_KEY        OpenAI key
//   OPENAI_MODEL          optional, default below
//   AI_REASONING_EFFORT   optional, "low" (default), "medium" or "high"
//
// Input format (what the prompt builders in this folder return): a string, or messages whose
// content is a string or a list of input_text / input_image / input_file parts. A "developer"
// message is extra instructions for this request, e.g. the exam task the tutor is helping with.

import Anthropic from "@anthropic-ai/sdk";

export type AiPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail?: "high" }
  | { type: "input_file"; file_url: string };
export type AiMessage = { role: "user" | "assistant" | "developer"; content: string | AiPart[] };
export type AiInput = string | AiMessage[];
export type AiUsage = { input_tokens: number; cached_tokens: number; output_tokens: number; reasoning_tokens: number };

export type AiRequest = {
  instructions: string;
  input: AiInput;
  /** The answer must match this JSON schema (every object: all fields required, no extras). */
  schema?: { name: string; schema: unknown };
  maxTokens: number;
  timeoutMs: number;
  /** Groups requests that share the same instructions, for OpenAI's prompt cache. */
  cacheKey?: string;
  /** Called with each piece of text as it arrives. */
  onDelta?: (text: string) => void;
  /** A chat reply cut off by the token limit is still useful; JSON isn't (default false). */
  allowIncomplete?: boolean;
  /** Overrides the provider for this request; `model` must then belong to that provider. */
  provider?: "anthropic" | "openai";
  model?: string;
};
export type AiResult = { text: string; usage: AiUsage | null; model: string };

const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5-5";
const DEFAULT_OPENAI_MODEL = "gpt-6.1-sol";
const effort = () => Deno.env.get("AI_REASONING_EFFORT") ?? "low";

export function aiProvider(): "anthropic" | "openai" {
  return Deno.env.get("AI_PROVIDER") === "anthropic" ? "anthropic" : "openai";
}
export const aiKey = () => Deno.env.get(aiProvider() === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY");
export const aiModel = () =>
  aiProvider() === "anthropic"
    ? Deno.env.get("ANTHROPIC_MODEL") ?? DEFAULT_CLAUDE_MODEL
    : Deno.env.get("OPENAI_MODEL") ?? DEFAULT_OPENAI_MODEL;

export function askAi(req: AiRequest): Promise<AiResult> {
  return (req.provider ?? aiProvider()) === "anthropic" ? askClaude(req) : askOpenAI(req);
}

// ─── Claude ──────────────────────────────────────────────────────────────────

/** Our input → Claude's messages + extra system text. */
export function toClaudeInput(input: AiInput) {
  const list: AiMessage[] = typeof input === "string" ? [{ role: "user", content: input }] : input;
  const system = list.filter((m) => m.role === "developer").map((m) => String(m.content));
  const turns = list.filter((m) => m.role !== "developer");
  // Claude's conversation must start with the student; cut history can start with a reply.
  while (turns[0]?.role === "assistant") turns.shift();
  const messages = turns.map((m) => ({
    role: m.role as "user" | "assistant",
    content: typeof m.content === "string" ? m.content : m.content.map(toClaudePart),
  }));
  return { system, messages };
}

function toClaudePart(part: AiPart) {
  if (part.type === "input_text") return { type: "text" as const, text: part.text };
  if (part.type === "input_file") return { type: "document" as const, source: { type: "url" as const, url: part.file_url } };
  const data = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(part.image_url);
  if (!data) return { type: "image" as const, source: { type: "url" as const, url: part.image_url } };
  return {
    type: "image" as const,
    source: { type: "base64" as const, media_type: data[1] as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: data[2] },
  };
}

// Claude's structured outputs reject these keywords. Our zod schemas check the same limits on the
// answer afterwards, so they only need to go from what we send.
const CLAUDE_UNSUPPORTED = new Set(["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "minItems", "maxItems", "pattern"]);
export function toClaudeSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toClaudeSchema);
  if (!schema || typeof schema !== "object") return schema;
  return Object.fromEntries(
    Object.entries(schema)
      .filter(([key]) => !CLAUDE_UNSUPPORTED.has(key))
      .map(([key, value]) => [
        key,
        // Under "properties" the keys are our field names, not schema keywords.
        key === "properties" && value && typeof value === "object"
          ? Object.fromEntries(Object.entries(value).map(([name, field]) => [name, toClaudeSchema(field)]))
          : toClaudeSchema(value),
      ]),
  );
}

/** The answer text. After a fallback the earlier model's partial text stays in `content`: skip it. */
export function claudeAnswerText(content: { type: string; text?: string }[]): string {
  const start = content.map((b) => b.type).lastIndexOf("fallback") + 1;
  return content.slice(start).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
}

async function askClaude(req: AiRequest): Promise<AiResult> {
  const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
  const model = req.model ?? aiModel();
  const { system, messages } = toClaudeInput(req.input);
  const stream = client.beta.messages.stream(
    {
      model,
      max_tokens: req.maxTokens,
      // Stable instructions first and cached; per-request context after the breakpoint.
      system: [
        { type: "text", text: req.instructions, cache_control: { type: "ephemeral" } },
        ...system.map((text) => ({ type: "text" as const, text })),
      ],
      messages,
      output_config: {
        effort: effort() as "low" | "medium" | "high",
        ...(req.schema ? { format: { type: "json_schema" as const, schema: toClaudeSchema(req.schema.schema) as Record<string, unknown> } } : {}),
      },
      // A safety decline is re-run on a fallback model where Anthropic supports it.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // deno-lint-ignore no-explicit-any
    } as any,
    { signal: AbortSignal.timeout(req.timeoutMs), maxRetries: 1 },
  );
  // deno-lint-ignore no-explicit-any
  for await (const event of stream as AsyncIterable<any>) {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") req.onDelta?.(event.delta.text);
  }
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new Error(`Claude refused: ${message.stop_details?.category ?? "unknown"}`);
  }
  if (message.stop_reason === "max_tokens" && !req.allowIncomplete) throw new Error("Claude hit the token limit");
  const text = claudeAnswerText(message.content as { type: string; text?: string }[]);
  if (!text.trim()) throw new Error("Claude returned no text");
  const u = message.usage;
  const read = u.cache_read_input_tokens ?? 0;
  console.log(`ai: ${message.model}, in ${u.input_tokens} (cache read ${read}, write ${u.cache_creation_input_tokens ?? 0}), out ${u.output_tokens}`);
  return {
    text,
    model: message.model,
    // input_tokens counts only the uncached part on Claude; ours is the total, as on OpenAI.
    usage: {
      input_tokens: u.input_tokens + read + (u.cache_creation_input_tokens ?? 0),
      cached_tokens: read,
      output_tokens: u.output_tokens,
      reasoning_tokens: 0,
    },
  };
}

// ─── OpenAI (Responses API) ──────────────────────────────────────────────────

async function askOpenAI(req: AiRequest): Promise<AiResult> {
  const model = req.model ?? aiModel();
  const streaming = Boolean(req.onDelta);
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(req.timeoutMs),
    headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: req.instructions,
      input: req.input,
      ...(req.schema ? { text: { format: { type: "json_schema", name: req.schema.name, schema: req.schema.schema, strict: true } } } : {}),
      reasoning: { effort: effort() },
      max_output_tokens: req.maxTokens, // safety cap (includes reasoning tokens)
      ...(req.cacheKey ? { prompt_cache_key: req.cacheKey } : {}),
      store: false, // don't keep the student's content on OpenAI's side for later retrieval
      ...(streaming ? { stream: true } : {}),
    }),
  });
  if (!res.ok || !res.body) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { text, u } = streaming ? await readOpenAiStream(res.body, req) : readOpenAiBody(await res.json(), req);
  if (!text.trim()) throw new Error("OpenAI returned no text");
  console.log(`ai: ${model}, in ${u?.input_tokens} (cached ${u?.input_tokens_details?.cached_tokens}), out ${u?.output_tokens}`);
  return {
    text,
    model,
    usage: u
      ? {
        input_tokens: u.input_tokens ?? 0,
        cached_tokens: u.input_tokens_details?.cached_tokens ?? 0,
        output_tokens: u.output_tokens ?? 0,
        reasoning_tokens: u.output_tokens_details?.reasoning_tokens ?? 0,
      }
      : null,
  };
}

// deno-lint-ignore no-explicit-any
function readOpenAiBody(data: any, req: AiRequest) {
  if (data.status !== "completed" && !(data.status === "incomplete" && req.allowIncomplete)) {
    throw new Error(`OpenAI status ${data.status}: ${JSON.stringify(data.incomplete_details)}`);
  }
  // deno-lint-ignore no-explicit-any
  const content = (data.output ?? []).flatMap((item: any) => (item.type === "message" ? item.content : []));
  // deno-lint-ignore no-explicit-any
  if (content.some((c: any) => c.type === "refusal")) throw new Error("OpenAI refused");
  // deno-lint-ignore no-explicit-any
  return { text: content.filter((c: any) => c.type === "output_text").map((c: any) => c.text).join(""), u: data.usage };
}

async function readOpenAiStream(body: ReadableStream<Uint8Array>, req: AiRequest) {
  let text = "";
  // deno-lint-ignore no-explicit-any
  let u: any = null;
  for await (const event of readSse(body)) {
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      text += event.delta;
      req.onDelta?.(event.delta);
    } else if (event.type === "response.completed") {
      u = event.response?.usage;
    } else if (event.type === "response.incomplete" && req.allowIncomplete && text) {
      u = event.response?.usage;
    } else if (event.type === "response.failed" || event.type === "response.incomplete" || event.type === "error") {
      throw new Error(`OpenAI stream ${event.type}: ${JSON.stringify(event).slice(0, 300)}`);
    } else if (event.type === "response.refusal.delta") {
      throw new Error("OpenAI refused");
    }
  }
  return { text, u };
}

// Minimal Server-Sent Events reader: yields each `data: {...}` JSON payload.
// deno-lint-ignore no-explicit-any
async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<any> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const data = chunk
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data && data !== "[DONE]") yield JSON.parse(data);
    }
  }
}
