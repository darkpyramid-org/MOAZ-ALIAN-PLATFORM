import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** WhatsApp business number in international format without "+" (wa.me format). */
export const WHATSAPP_NUMBER = "201152060900";

export const WHATSAPP_DISPLAY = "+20 115 206 0900";

/** Stroked WhatsApp glyph matching the lucide icon style, usable wherever an icon component is expected. */
export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("fill-none stroke-current stroke-2", className)}
      aria-hidden="true"
    >
      <path
        d="M21 11.5a8.5 8.5 0 0 1-12.6 7.44L3 20l1.06-5.4A8.5 8.5 0 1 1 21 11.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 9.5c.5 2.5 2.5 4.5 5 5l1.5-1.5 1.5 1" strokeLinecap="round" />
    </svg>
  );
}

const QUICK_MESSAGES = [
  "مرحبًا، لدي استفسار حول مكتبة مقارنة الأديان.",
  "أريد الاستفسار عن مادة معيّنة في المكتبة.",
  "لدي اقتراح أو ملاحظة على الموقع.",
] as const;

function waLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function WhatsAppPanel() {
  const [message, setMessage] = useState<string>(QUICK_MESSAGES[0]);

  return (
    <div className="chat-tab-in flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <WhatsAppIcon className="size-4 text-[#25D366]" />
        <p className="text-sm font-semibold">مراسلة مباشرة عبر واتساب</p>
      </div>
      <p className="px-4 pb-3 text-xs text-muted-foreground">
        اختر رسالة جاهزة أو اكتب رسالتك، وسيفتح واتساب على الرقم{" "}
        <span dir="ltr" className="font-medium text-foreground">
          {WHATSAPP_DISPLAY}
        </span>{" "}
        مباشرة.
      </p>

      <div className="flex flex-col gap-2 px-4">
        {QUICK_MESSAGES.map((msg) => (
          <button
            key={msg}
            type="button"
            onClick={() => setMessage(msg)}
            className={
              "rounded-2xl border px-3 py-2.5 text-start text-xs leading-relaxed transition-colors " +
              (message === msg
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-secondary text-muted-foreground hover:bg-accent hover:text-accent-foreground")
            }
          >
            {msg}
          </button>
        ))}
      </div>

      <div className="mt-auto space-y-2 border-t border-border bg-popover/60 p-4">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="chat-wa-message">
          رسالتك
        </label>
        <textarea
          id="chat-wa-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder="اكتب رسالتك هنا…"
          className="field w-full resize-none rounded-2xl border-input bg-input/40 px-3 py-2 text-xs"
        />
        <Button asChild className="w-full">
          <a href={waLink(message)} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" aria-hidden="true" />
            فتح واتساب وإرسال الرسالة
          </a>
        </Button>
      </div>
    </div>
  );
}
