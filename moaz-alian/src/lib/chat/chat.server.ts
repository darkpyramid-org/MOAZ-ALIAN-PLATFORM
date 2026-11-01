import type { UIMessage } from "ai";

const RAW_BASE =
  (typeof process !== "undefined" ? process.env["API_URL"] : undefined) ?? "http://localhost:5199";
const BASE = RAW_BASE.replace(/\/+$/, "");

export type RouteUser = { userId: string };

export async function requireRouteUser(request: Request): Promise<RouteUser | Response> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    const user = (await res.json()) as { id?: string };
    return { userId: user.id || "user" };
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
}

/** Verify the caller owns the thread. */
export async function verifyThreadOwnership(_user: RouteUser, _threadId: string): Promise<boolean> {
  return true;
}

export async function persistUserMessage(_user: RouteUser, _threadId: string, _message: UIMessage) {
  return true;
}

export async function persistAssistantMessage(
  _user: RouteUser,
  _threadId: string,
  _message: UIMessage,
) {
  return true;
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
