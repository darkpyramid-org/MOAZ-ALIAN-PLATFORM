import type { ContentItem } from "@/types/content";
import { libraryItems } from "./library";


/**
 * Seed dataset.
 *
 * Verified records (`verified: true`) carry metadata traced to public sources:
 * - Books and the external article: islamland.com author page 731.
 * - Video titles and dates: the reference index of published episodes.
 * Every verified item keeps its `sourceUrl` for traceability.
 *
 * Records with `demo: true` are clearly-labeled demonstration entries so the
 * interface can be evaluated; they must be replaced with real material.
 */
export const seedItems: ContentItem[] = libraryItems;
