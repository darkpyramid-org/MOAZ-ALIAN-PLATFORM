import type { Category } from "@/types/content";

/**
 * Initial configurable taxonomy. Belonging to a category describes the topic of
 * the material; it is not a claim that the archive is exhaustive for that topic.
 */
export const categories: Category[] = [
  {
    id: "comparative",
    name: "مقارنة الأديان",
    description: "مواد تقارن بين العقائد والنصوص والتعاليم بين الأديان.",
  },
  {
    id: "christianity",
    name: "المسيحية",
    description: "مواد تتعلق بعقائد المسيحية وتاريخها ونصوصها.",
  },
  {
    id: "islam",
    name: "الإسلام",
    description: "مواد تتعلق بالعقيدة الإسلامية والرد على ما يطعن فيها.",
  },
  {
    id: "texts",
    name: "النصوص الدينية",
    description: "قراءات ودراسات في النصوص الدينية وتاريخها.",
  },
  {
    id: "responses",
    name: "الشبهات والردود",
    description: "حلقات ومواد للرد على الشبهات المثارة حول الإسلام.",
  },
  {
    id: "dialogues",
    name: "الحوارات والمناظرات",
    description: "حوارات ومناظرات مسجلة مع خصوم ومهتمين.",
  },
  {
    id: "intellectual",
    name: "القضايا الفكرية",
    description: "قضايا العقل والعلمانية والقيم في الفكر المعاصر.",
  },
  {
    id: "series",
    name: "البرامج والسلاسل",
    description: "برامج وسلاسل تعليمية مرتبة على قناة معاذ عليان.",
  },
];

export function categoryById(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}
