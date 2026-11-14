import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FormActions({
  onCancel,
  busy = false,
  className,
}: {
  onCancel: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 gap-2", className)}>
      <Button type="submit" disabled={busy} className="btn-gold h-10 min-w-0 flex-1">
        <Save aria-hidden />
        {busy ? "جارٍ الحفظ…" : "حفظ"}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={onCancel}
        className="btn-outline h-10 shrink-0"
      >
        <X aria-hidden />
        إلغاء
      </Button>
    </div>
  );
}
