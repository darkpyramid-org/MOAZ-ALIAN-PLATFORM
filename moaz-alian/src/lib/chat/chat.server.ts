// Server-only helpers for the chat API route: bearer verification, thread
// authorization and message persistence. Never import this module from
// client code or *.functions.ts files.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { UIMessage } from "ai";
import { createSupabaseFetch } from "@/lib/supabase-fetch";

function createUserClient(token: string) {
  const SUPABASE_URL = process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing Supabase environment variable(s). Connect Lovable Cloud.");
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export type RouteUser = { supabase: ReturnType<typeof createUserClient>; userId: string };

export async function requireRouteUser(request: Request): Promise<RouteUser | Response> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createUserClient(token);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return { supabase, userId: data.user.id };
}

/** Verify the caller owns the thread; RLS scopes the read, but the explicit check gives a clean 404. */
export async function verifyThreadOwnership(
  supabase: RouteUser["supabase"],
  threadId: string,
): Promise<boolean> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(threadId);
  if (!isUuid) return false;
  const { data, error } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("id", threadId)
    .maybeSingle();
  return !error && !!data;
}

export async function persistUserMessage(
  supabase: RouteUser["supabase"],
  threadId: string,
  message: UIMessage,
) {
  const { error } = await supabase.from("chat_messages").insert({
    thread_id: threadId,
    role: "user",
    parts: JSON.parse(JSON.stringify(message.parts)),
  });
  if (error) {
    console.error("[chat] failed to persist user message", error.message);
    return false;
  }

  // Seed the thread title from the first exchange.
  const text = message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
  if (text) {
    await supabase
      .from("chat_threads")
      .update({ title: text.slice(0, 60) })
      .eq("id", threadId)
      .eq("title", "محادثة جديدة");
  }
  return true;
}

export async function persistAssistantMessage(
  supabase: RouteUser["supabase"],
  threadId: string,
  message: UIMessage,
) {
  const { error } = await supabase.from("chat_messages").insert({
    thread_id: threadId,
    role: "assistant",
    parts: JSON.parse(JSON.stringify(message.parts)),
  });
  if (error) {
    console.error("[chat] failed to persist assistant message", error.message);
  }
}

const CATEGORIES = [
  { id: "comparative", name: "مقارنة الأديان" },
  { id: "christianity", name: "المسيحية" },
  { id: "islam", name: "الإسلام" },
  { id: "texts", name: "النصوص الدينية" },
  { id: "responses", name: "الشبهات والردود" },
  { id: "dialogues", name: "الحوارات والمناظرات" },
  { id: "intellectual", name: "القضايا الفكرية" },
  { id: "series", name: "البرامج والسلاسل" },
];

export function buildSystemPrompt(): string {
  return [
    "أنت «مساعد المكتبة» في موقع معاذ عليان، مكتبة عربية معرفية في مقارنة الأديان.",
    "دورك: مساعدة الزائر في استكشاف محتوى الموقع والإجابة عن أسئلته المعرفية بلغة عربية فصيحة وودودة ومحترمة.",
    "",
    "أقسام الموقع المتاحة:",
    ...CATEGORIES.map((c) => `- ${c.name}`),
    "أنواع المحتوى: فيديوهات، كتب، مقالات، أبحاث. كل نوع له صفحة قائمة وصفحة تفاصيل لكل مادة.",
    "صفحات مفيدة: /videos و /books و /articles و /research و /categories و /about، وصفحة البحث /search.",
    "",
    "قواعد:",
    "- ردودك قصيرة ومركزة (يفضل أقل من 120 كلمة) إلا إذا طلب الزائر تفصيلًا.",
    "- لا تختلق أسماء مواد أو حلقات غير موجودة؛ إذا لم تكن متأكدًا من وجود مادة بعينها، انصح الزائر بالبحث في القسم المناسب.",
    "- عند سؤال معرفي في مقارنة الأديان، أجب بدقة وأمانة واذكر أن الموقع يقدم مواد تفصيلية في الأقسام.",
    "- لا تتحدث بأي لغة غير العربية إلا إذا كتب الزائر بلغة أخرى.",
  ].join("\n");
}
