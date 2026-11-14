import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth";
import type { UIMessage } from "ai";

export type ChatThread = {
  id: string;
  title: string;
  updated_at: string;
};

const THREADS_KEY = "moaz_chat_threads";
const MESSAGES_KEY_PREFIX = "moaz_chat_messages_";

function getStoredThreads(): ChatThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    return raw ? (JSON.parse(raw) as ChatThread[]) : [];
  } catch {
    return [];
  }
}

function saveStoredThreads(threads: ChatThread[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  } catch {
    // Storage full or unavailable
  }
}

/** Tracks whether the visitor has a signed-in session (for the chat gate). */
export function useChatSession() {
  const [state, setState] = useState<{ loading: boolean; signedIn: boolean }>({
    loading: false,
    signedIn: !!authClient.getAccessToken(),
  });

  useEffect(() => {
    const { data } = authClient.onAuthStateChange((_, user) => {
      setState({ loading: false, signedIn: !!user });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}

/** Threads live in local storage scoped to the active session. */
export function useChatThreads(enabled: boolean) {
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ["chat-threads"],
    enabled,
    queryFn: async () => {
      return getStoredThreads();
    },
  });

  return useMemo(
    () => ({
      ...list,
      async createThread() {
        const user = authClient.getUser();
        if (!user) throw new Error("not_signed_in");
        const newThread: ChatThread = {
          id: `thread_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          title: "محادثة جديدة",
          updated_at: new Date().toISOString(),
        };
        const threads = [newThread, ...getStoredThreads()];
        saveStoredThreads(threads);
        await queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
        return newThread;
      },
      async deleteThread(id: string) {
        const threads = getStoredThreads().filter((t) => t.id !== id);
        saveStoredThreads(threads);
        try {
          localStorage.removeItem(`${MESSAGES_KEY_PREFIX}${id}`);
        } catch {
          // Ignore
        }
        await queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      },
    }),
    [list, queryClient],
  );
}

/** Loads a thread's persisted messages as AI SDK UIMessages. */
export function useThreadMessages(threadId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["chat-messages", threadId],
    enabled: enabled && !!threadId,
    queryFn: async () => {
      if (!threadId || typeof window === "undefined") return [];
      try {
        const raw = localStorage.getItem(`${MESSAGES_KEY_PREFIX}${threadId}`);
        return raw ? (JSON.parse(raw) as UIMessage[]) : [];
      } catch {
        return [];
      }
    },
  });
}
