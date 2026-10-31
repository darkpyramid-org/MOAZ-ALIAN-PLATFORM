import type { ArticleItem } from "@/types/content";
import { ISLAMLAND_AUTHOR, TANWERY_AUTHOR, YT_CHANNEL } from "./sources";

export const articles: ArticleItem[] = [
  {
    id: "a01",
    slug: "zamili-almasihi",
    type: "article",
    title: "زميلي المسيحي نُحِبُّ لك الخير",
    description: "مقال منشور على منصة إسلام لاند.",
    thumbnailUrl: null,
    authorName: "معاذ عليان",
    categoryIds: ["comparative", "dialogues"],
    tags: ["مقالات"],
    publishedAt: null,
    sourceUrl: "https://www.islamland.com/ose/articles/zamily-almaseehi",
    featured: true,
    verified: true,
    demo: false,
    rightsStatus: "external",
    body: null,
    readingTimeMinutes: null,
  },
  {
    id: "a02",
    slug: "kayfa-naqra-nusus",
    type: "article",
    title: "كيف نقرأ النصوص الدينية بموضوعية؟",
    description: "مقال تجريبي لعرض تجربة القراءة الطويلة في الموقع.",
    thumbnailUrl: null,
    authorName: "معاذ عليان",
    categoryIds: ["texts"],
    tags: ["منهج"],
    publishedAt: null,
    sourceUrl: null,
    featured: false,
    verified: false,
    demo: true,
    rightsStatus: "unknown",
    body: `هذا المقال **محتوى تجريبي** وُضع لعرض تجربة القراءة في الموقع فقط، ولا يمثل نصًا منشورًا حقيقيًا.

## لماذا تهم الموضوعية؟

الموضوعية في قراءة النصوص الدينية تعني البحث عن معنى النص في سياقه، لا في افتراضاتنا المسبقة عنه. ويحتاج القارئ إلى أدوات واضحة تمكنه من التمييز بين النص وشرحه.

## خطوات عملية

1. تحديد سياق النص: من قالها؟ ومتى؟ ولمن؟
2. النظر إلى النسخ والترجمات المتوفرة ومقارنة الفروق.
3. جمع أقوال المفسّرين المختلفين قبل الحكم.
4. صياغة نتيجة محدودة بما وُجد من الأدلة.

## خاتمة

الغاية ليست الفوز في جدال، بل الاقتراب من فهم أدق. وهذه الخطوات قابلة للتطبيق على أي نص ديني يدرسه القارئ.`,
    readingTimeMinutes: 4,
  },
  {
    id: "a03",
    slug: "manhaj-alradd-ala-shubuhat",
    type: "article",
    title: "منهجية الرد على الشبهات: خمس خطوات",
    description: "مقال تجريبي يعرض منهجًا مقترحًا للتعامل مع الشبهات.",
    thumbnailUrl: null,
    authorName: "معاذ عليان",
    categoryIds: ["responses"],
    tags: ["منهج"],
    publishedAt: null,
    sourceUrl: null,
    featured: false,
    verified: false,
    demo: true,
    rightsStatus: "unknown",
    body: `هذا المقال **محتوى تجريبي** وُضع لعرض تجربة القراءة في الموقع فقط، ولا يمثل نصًا منشورًا حقيقيًا.

## لماذا نحتاج منهجًا؟

التعامل مع الشبهات بردود متسرعة يفتح باب اللبس. المنهج يجعل الرد أقرب إلى البحث منه إلى الجدال.

## الخطوات الخمس

1. **نقل الشبهة بأمانة**: بنص كامل ومصدرها.
2. **فهم مقصودها**: ما السؤال الحقيقي المطروح؟
3. **جمع الأدلة**: من النصوص والمصادر الموثوقة.
4. **صياغة الرد**: بلغة واضحة بلا مبالغة.
5. **مراجعة الرد**: هل يجيب عن الشبهة نفسها فعلًا؟

## خلاصة

الرد الجيد يبدأ بالإنصاف، وينتهي بالوضوح لا بالاستعراض.`,
    readingTimeMinutes: 3,
  },

];
