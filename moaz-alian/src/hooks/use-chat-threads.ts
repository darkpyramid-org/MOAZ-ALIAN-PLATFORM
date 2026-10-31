import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UIMessage } from "ai";

export type ChatThread = {
  id: string;
  title: string;
  updated_at: string;
};

/** Tracks whether the visitor has a signed-in session (for the chat gate). */
export function useChatSession() {
  const [state, setState] = useState<{ loading: boolean; signedIn: boolean }>({
    loading: true,
    signedIn: false,
  });

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setState({ loading: false, signedIn: !!data.session });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setState({ loading: false, signedIn: !!session });
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}

/** Threads live in the database and are scoped to the signed-in user by RLS. */
export function useChatThreads(enabled: boolean) {
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ["chat-threads"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as ChatThread[];
    },
  });

  return useMemo(
    () => ({
      ...list,
      async createThread() {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) throw new Error("not_signed_in");
        const { data, error } = await supabase
          .from("chat_threads")
          .insert({ user_id: userId })
          .select("id, title, updated_at")
          .single();
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
        return data as ChatThread;
      },
      async deleteThread(id: string) {
        const { error } = await supabase.from("chat_threads").delete().eq("id", id);
        if (error) throw error;
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
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, role, parts")
        .eq("thread_id", threadId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        role: row.role as "user" | "assistant",
        parts: row.parts as UIMessage["parts"],
      }));
    },
  });
}
