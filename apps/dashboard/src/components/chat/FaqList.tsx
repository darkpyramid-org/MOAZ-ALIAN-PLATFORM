import { MessageCircleQuestion } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@/data/faq";

export function FaqList() {
  return (
    <div className="chat-tab-in flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <MessageCircleQuestion className="size-4 text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold">الأسئلة الشائعة</p>
      </div>
      <p className="px-4 pb-3 text-xs text-muted-foreground">
        إجابات سريعة عن أكثر ما يسأل عنه الزوار.
      </p>
      <Accordion
        type="single"
        collapsible
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4"
      >
        {FAQ_ITEMS.map((item) => (
          <AccordionItem key={item.id} value={item.id} className="last:border-b-0">
            <AccordionTrigger className="text-start text-sm font-medium">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-xs leading-relaxed text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
