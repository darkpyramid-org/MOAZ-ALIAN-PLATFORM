import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ImagePlus, Loader2, Link2, Replace, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { mediaUrl } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Reusable image picker: choose a photo from the device (or drag & drop),
 * uploads it to storage and returns its reference via `onChange`.
 *
 * The value can be:
 * - an uploaded object path ("media/<folder>/<file>") — the usual case,
 * - an external https:// image URL (pasted or pre-existing),
 * - a bundled "/images/..." path.
 */
export interface ImageUploadProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  /** Storage bucket (default "media"). */
  bucket?: string;
  /** Folder inside the bucket (default "uploads"). */
  folder?: string;
  /** Preview aspect ratio, e.g. "16/10" (default) or "1/1". */
  aspect?: string;
  /** Accepted file types (default any image). */
  accept?: string;
  /** Maximum file size in MB (default 10). */
  maxSizeMb?: number;
  disabled?: boolean;
  /** Show the paste-external-URL option (default true). */
  allowUrlInput?: boolean;
  previewAlt?: string;
  className?: string;
}

const DEFAULT_ACCEPT = "image/*";

function extensionFor(file: File): string {
  const fromName = file.name.includes(".") ? file.name.split(".").pop() : undefined;
  if (fromName && /^[\w]{1,8}$/.test(fromName)) return fromName.toLowerCase();
  const fromType = file.type.split("/")[1];
  return fromType && /^[\w-]{1,8}$/.test(fromType) ? fromType.replace("jpeg", "jpg") : "bin";
}

export function ImageUpload({
  value,
  onChange,
  bucket = "media",
  folder = "uploads",
  aspect = "16/10",
  accept = DEFAULT_ACCEPT,
  maxSizeMb = 10,
  disabled = false,
  allowUrlInput = true,
  previewAlt = "معاينة الصورة",
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);

  function validate(file: File): string | null {
    if (!file.type.startsWith("image/")) return "الملف ليس صورة. اختر صورة من جهازك.";
    if (file.size > maxSizeMb * 1024 * 1024) return `حجم الصورة أكبر من ${maxSizeMb} ميجابايت.`;
    return null;
  }

  async function upload(file: File) {
    if (disabled || uploading) return;
    const problem = validate(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setUploading(true);
    try {
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFor(file)}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) {
        if (error.statusCode === "403" || error.status === 403) {
          toast.error("ليست لديك صلاحية رفع الصور. سجّل الدخول بحساب الفريق.");
        } else {
          toast.error("تعذّر رفع الصورة. حاول مرة أخرى.");
        }
        console.error("[ImageUpload] upload failed:", error.message);
        return;
      }
      setPreviewFailed(false);
      onChange(`${bucket}/${path}`);
      toast.success("تم رفع الصورة بنجاح — لا تنسَ الحفظ");
    } catch (err) {
      console.error("[ImageUpload] upload crashed:", err);
      toast.error("تعذّر رفع الصورة. حاول مرة أخرى.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void upload(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  const shown = mediaUrl(value);
  const hasImage = !!value && !previewFailed;

  return (
    <div className={cn("min-w-0 space-y-2", className)} dir="rtl">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onPick}
        aria-hidden="true"
        tabIndex={-1}
      />

      {hasImage ? (
        <div className="space-y-2">
          <div
            className="relative overflow-hidden rounded-lg border border-border bg-muted"
            style={{ aspectRatio: aspect }}
          >
            <img
              src={shown}
              alt={previewAlt}
              onError={() => setPreviewFailed(true)}
              className="size-full object-cover"
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
                <span className="ms-2 text-sm font-medium">جارٍ رفع الصورة…</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Replace />
              تغيير الصورة
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => {
                onChange(null);
                setPreviewFailed(false);
              }}
            >
              <Trash2 />
              إزالة
            </Button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled || uploading ? -1 : 0}
          aria-label="رفع صورة من الجهاز"
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !disabled && !uploading) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled && !uploading) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex aspect-[16/10] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 text-center transition-colors hover:border-primary/60 hover:bg-muted",
            dragOver && "border-primary bg-accent",
            uploading && "cursor-wait",
          )}
          style={{ aspectRatio: aspect }}
        >
          {uploading ? (
            <>
              <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
              <span className="text-sm font-medium">جارٍ رفع الصورة…</span>
            </>
          ) : (
            <>
              <ImagePlus className="size-7 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">اضغط لاختيار صورة من جهازك</span>
              <span className="text-xs text-muted-foreground">
                أو اسحب الصورة وأفلتها هنا · حتى {maxSizeMb} ميجابايت
              </span>
            </>
          )}
        </div>
      )}

      {allowUrlInput && (
        <div className="text-start">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs text-muted-foreground"
            onClick={() => setUrlOpen((v) => !v)}
          >
            <Link2 />
            {urlOpen ? "إخفاء" : "أو الصق رابط صورة من الإنترنت"}
          </Button>
          {urlOpen && (
            <div className="mt-2 flex items-start gap-2">
              <Input
                dir="ltr"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={!urlDraft.trim()}
                onClick={() => {
                  setPreviewFailed(false);
                  onChange(urlDraft.trim());
                  setUrlDraft("");
                  setUrlOpen(false);
                  toast.success("تم استخدام الرابط — لا تنسَ الحفظ");
                }}
              >
                استخدام
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
