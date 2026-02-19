export async function embedText(input: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Embeddings failed: ${text}`);
  }

  const json = await res.json();
  return json.data[0].embedding as number[];
}

function extractResponseText(json: unknown): string {
  if (json === null || typeof json !== "object") return "";

  const root = json as Record<string, unknown>;

  // Prefer output_text if present
  const outputText = root["output_text"];
  if (typeof outputText === "string" && outputText.trim()) return outputText;

  // Otherwise, walk the output structure
  const chunks: string[] = [];
  const output = root["output"];
  if (!Array.isArray(output)) return "";

  for (const item of output) {
    if (item === null || typeof item !== "object") continue;
    const itemRec = item as Record<string, unknown>;

    const content = itemRec["content"];
    if (!Array.isArray(content)) continue;

    for (const c of content) {
      if (c === null || typeof c !== "object") continue;
      const cRec = c as Record<string, unknown>;

      const type = cRec["type"];
      const text = cRec["text"];

      if (type === "output_text" && typeof text === "string") chunks.push(text);
      else if (typeof text === "string") chunks.push(text);
    }
  }

  return chunks.join("\n").trim();
}

function extractFirstJsonObject(text: string): string | null {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      if (inString) escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
      continue;
    }

    if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

export async function summarizeAndTag(content: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "Extract a concise title, a short summary (1-3 sentences), and 3–7 topical tags from a note. Output MUST be strict JSON with keys title, summary, tags.",
        },
        {
          role: "user",
          content:
            `NOTE:\n${content}\n\n` +
            "Return ONLY JSON. Constraints: title <= 60 chars; summary <= 300 chars; tags 3-7 items, lowercase, no #.",
        },
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Responses failed (${res.status})`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Responses returned non-JSON payload.");
  }

  const textOut = extractResponseText(payload);

  // Try parse ONLY the first complete JSON object from the model output
  let parsed: unknown = null;
  const jsonStr = extractFirstJsonObject(textOut);
  if (jsonStr) {
    try {
      parsed = JSON.parse(jsonStr) as unknown;
    } catch {
      parsed = null;
    }
  }

  const parsedObj: Record<string, unknown> | null =
    parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;

  // Hard fallback so summary is never empty
  const fallbackTitle =
    content
      .split(/\n|\.|\?|!/)[0]
      ?.trim()
      .slice(0, 60) || "";
  const fallbackSummary =
    content.replace(/\s+/g, " ").trim().slice(0, 280) || "";

  const title = String(parsedObj?.["title"] ?? fallbackTitle)
    .trim()
    .slice(0, 60);
  const summary = String(parsedObj?.["summary"] ?? fallbackSummary)
    .trim()
    .slice(0, 300);

  const rawTags = parsedObj?.["tags"];
  const tags = Array.isArray(rawTags)
    ? rawTags
        .map((t: unknown) => String(t).toLowerCase().trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];

  return { title, summary, tags };
}
