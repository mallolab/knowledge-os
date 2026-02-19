type GuardrailConfig = {
  windowMs: number;
  maxRequests: number;
  maxCharsPerRequest: number;
  maxCharsPerWindow: number;
};

type GuardrailWindow = {
  windowStartMs: number;
  requests: number;
  chars: number;
};

const windows = new Map<string, GuardrailWindow>();
const dedupe = new Map<string, number>();

function nowMs() {
  return Date.now();
}

function getWindowKey(userId: string, action: string) {
  return `${userId}:${action}`;
}

function cleanupStale() {
  const now = nowMs();
  for (const [key, value] of windows.entries()) {
    if (now - value.windowStartMs > 24 * 60 * 60 * 1000) {
      windows.delete(key);
    }
  }

  for (const [key, value] of dedupe.entries()) {
    if (value <= now) {
      dedupe.delete(key);
    }
  }
}

export function assertBudget(params: {
  userId: string;
  action: string;
  charCost: number;
  config: GuardrailConfig;
}) {
  cleanupStale();

  const { userId, action, charCost, config } = params;
  if (charCost > config.maxCharsPerRequest) {
    throw new Error(
      `Input too large for ${action}. Max ${config.maxCharsPerRequest} characters.`,
    );
  }

  const key = getWindowKey(userId, action);
  const now = nowMs();
  const current = windows.get(key);

  let next: GuardrailWindow;
  if (!current || now - current.windowStartMs >= config.windowMs) {
    next = { windowStartMs: now, requests: 0, chars: 0 };
  } else {
    next = current;
  }

  if (next.requests + 1 > config.maxRequests) {
    throw new Error(`Rate limit reached for ${action}. Please wait and retry.`);
  }

  if (next.chars + charCost > config.maxCharsPerWindow) {
    throw new Error(`Usage budget reached for ${action}. Please wait and retry.`);
  }

  next.requests += 1;
  next.chars += charCost;
  windows.set(key, next);
}

export function assertNotDuplicate(params: {
  userId: string;
  action: string;
  fingerprint: string;
  dedupeMs: number;
}) {
  cleanupStale();

  const { userId, action, fingerprint, dedupeMs } = params;
  const key = `${userId}:${action}:${fingerprint}`;
  const now = nowMs();
  const expiresAt = dedupe.get(key) ?? 0;

  if (expiresAt > now) {
    throw new Error(`Please wait before retrying ${action}.`);
  }

  dedupe.set(key, now + dedupeMs);
}
