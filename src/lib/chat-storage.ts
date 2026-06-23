const CHAT_STORAGE_PREFIX = "wasl.chat.";
const CHAT_LIFETIME_MS = 24 * 60 * 60 * 1000;

type StoredChat = {
  messages: unknown[];
  updatedAt: number;
};

export function chatStorageKey(role: string, userId: string | null): string {
  if (!userId) return "";
  return `${CHAT_STORAGE_PREFIX}${userId}.${role}`;
}

export function loadChatMessages(role: string, userId: string | null): unknown[] {
  if (typeof window === "undefined" || !userId) return [];
  const key = chatStorageKey(role, userId);
  if (!key) return [];

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredChat;
    if (!parsed || !Array.isArray(parsed.messages) || typeof parsed.updatedAt !== "number") {
      localStorage.removeItem(key);
      return [];
    }
    if (Date.now() - parsed.updatedAt > CHAT_LIFETIME_MS) {
      localStorage.removeItem(key);
      return [];
    }
    return parsed.messages;
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

export function saveChatMessages(role: string, userId: string | null, messages: unknown[]) {
  if (typeof window === "undefined" || !userId) return;
  const key = chatStorageKey(role, userId);
  if (!key) return;

  if (!messages.length) {
    localStorage.removeItem(key);
    return;
  }

  try {
    const payload: StoredChat = { messages, updatedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage failures.
  }
}

export function clearChatMessages(role: string, userId: string | null) {
  if (typeof window === "undefined" || !userId) return;
  const key = chatStorageKey(role, userId);
  if (!key) return;
  localStorage.removeItem(key);
}

export function clearAllUserChats(userId: string) {
  if (typeof window === "undefined" || !userId) return;
  const prefix = `${CHAT_STORAGE_PREFIX}${userId}.`;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(prefix)) {
      localStorage.removeItem(key);
    }
  }
}
