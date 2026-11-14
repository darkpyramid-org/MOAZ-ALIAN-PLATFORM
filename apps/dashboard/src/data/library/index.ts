import type { ContentItem } from "@/types/content";
import { articles } from "./articles";
import { books } from "./books";
import { research } from "./research";
import { videos } from "./videos";

export { articles, books, research, videos };

/** Every bundled record, one file per content type. */
export const libraryItems: ContentItem[] = [...videos, ...books, ...articles, ...research];
