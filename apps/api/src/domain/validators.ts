import { ValidationError } from '../lib/errors.js';
import {
  BOOK_AVAILABILITIES,
  CONTENT_TYPES,
  RIGHTS_STATUSES,
  VIDEO_PROVIDERS,
} from './enums.js';
import {
  BODY_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  MAX_AUTHORIZED_LINKS,
  MAX_REFERENCES,
  MAX_TAGS,
  MAX_DURATION_SECONDS,
  TITLE_MAX_LENGTH,
} from './contentItem.js';
import { MAX_SLUG_LENGTH } from '../lib/slugs.js';
import { MAX_SEARCH_LENGTH } from './query.js';

/**
 * Port of Application.Validation.RequestValidators — the FluentValidation rules
 * and their EXACT messages. The messages are authoritative: they are captured
 * from the real validators (see the migration baseline) and the frontend
 * surfaces them verbatim.
 *
 * Two naming behaviours coexist in FluentValidation's built-in messages:
 *   - NotEmpty/MaximumLength use the raw PascalCase property name
 *     ("Title", "CategoryIds[0]");
 *   - IsInEnum / InclusiveBetween humanise it ("RightsStatus" → "Rights Status").
 * Both were captured from the live assembly; they are reproduced literally.
 */

interface Failure {
  propertyName: string;
  message: string;
}

function throwValidation(failures: Failure[]): never {
  // FluentValidation's GlobalExceptionHandler groups by PropertyName and keeps
  // DISTINCT messages in encounter order — the wire's errors dictionary.
  const grouped: { key: string; messages: string[] }[] = [];
  for (const failure of failures) {
    let group = grouped.find((entry) => entry.key === failure.propertyName);
    if (!group) {
      group = { key: failure.propertyName, messages: [] };
      grouped.push(group);
    }
    if (!group.messages.includes(failure.message)) {
      group.messages.push(failure.message);
    }
  }

  const errors: Record<string, string[]> = {};
  for (const group of grouped) {
    errors[group.key] = group.messages;
  }
  throw new ValidationError(errors);
}

/** FluentValidation's NotEmpty + Must(not-whitespace) pair: two identical messages. */
function mustBeNonBlank(failures: Failure[], propertyName: string, value: string | null | undefined): void {
  if (value === null || value === undefined || value === '') {
    failures.push({ propertyName, message: 'A value is required.' });
  }
  if (value === null || value === undefined || value.trim() === '') {
    failures.push({ propertyName, message: 'A value is required.' });
  }
}

function maximumLength(
  failures: Failure[],
  propertyName: string,
  value: string | null | undefined,
  max: number,
): void {
  if (typeof value === 'string' && value.length > max) {
    failures.push({
      propertyName,
      message: `The length of '${propertyName}' must be ${max} characters or fewer. You entered ${value.length} characters.`,
    });
  }
}

/** Humanised display name: PascalCase → space-separated words. */
function humanize(propertyName: string): string {
  return propertyName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

function isInEnum(
  failures: Failure[],
  propertyName: string,
  value: number | null | undefined,
  allowed: readonly number[],
): void {
  // FluentValidation's IsInEnum passes nulls through (only non-null values are checked).
  if (value === null || value === undefined) return;
  if (!allowed.includes(value)) {
    failures.push({
      propertyName,
      message: `'${humanize(propertyName)}' has a range of values which does not include '${value}'.`,
    });
  }
}

function inclusiveBetween(
  failures: Failure[],
  propertyName: string,
  value: number | null | undefined,
  min: number,
  max: number,
): void {
  if (value === null || value === undefined) return;
  if (value < min || value > max) {
    failures.push({
      propertyName,
      message: `'${humanize(propertyName)}' must be between ${min} and ${max}. You entered ${value}.`,
    });
  }
}

const CATEGORY_ID_PATTERN = /^[\p{L}\p{Nd}][\p{L}\p{Nd}._-]*$/u;

export interface UpsertContentShape {
  type: number | null;
  slug: string | null | undefined;
  title: string | null;
  description: string | null | undefined;
  body: string | null | undefined;
  rightsStatus: number | null;
  videoProvider: number | null;
  availability: number | null;
  durationSeconds: number | null | undefined;
  tags: (string | null)[] | null | undefined;
  references: (string | null)[] | null | undefined;
  authorizedLinks: { label: string | null; url: string | null }[] | null | undefined;
  categoryIds: (string | null)[] | null | undefined;
}

/** Order-sensitive: rules run top to bottom and the errors dictionary keeps that order. */
export function validateUpsertContent(shape: UpsertContentShape): void {
  const failures: Failure[] = [];

  mustBeNonBlank(failures, 'Title', shape.title);
  maximumLength(failures, 'Title', shape.title, TITLE_MAX_LENGTH);

  maximumLength(failures, 'Slug', shape.slug, MAX_SLUG_LENGTH);
  maximumLength(failures, 'Description', shape.description, DESCRIPTION_MAX_LENGTH);
  maximumLength(failures, 'Body', shape.body, BODY_MAX_LENGTH);

  isInEnum(failures, 'RightsStatus', shape.rightsStatus, RIGHTS_STATUSES);
  isInEnum(failures, 'Type', shape.type, CONTENT_TYPES);
  if (shape.videoProvider !== null && shape.videoProvider !== undefined) {
    isInEnum(failures, 'VideoProvider', shape.videoProvider, VIDEO_PROVIDERS);
  }
  if (shape.availability !== null && shape.availability !== undefined) {
    isInEnum(failures, 'Availability', shape.availability, BOOK_AVAILABILITIES);
  }
  if (shape.durationSeconds !== null && shape.durationSeconds !== undefined) {
    inclusiveBetween(failures, 'DurationSeconds', shape.durationSeconds, 0, MAX_DURATION_SECONDS);
  }

  if (shape.tags !== null && shape.tags !== undefined && shape.tags.length > MAX_TAGS) {
    failures.push({ propertyName: 'Tags', message: `At most ${MAX_TAGS} tags are allowed.` });
  }
  if (shape.references !== null && shape.references !== undefined && shape.references.length > MAX_REFERENCES) {
    failures.push({ propertyName: 'References', message: `At most ${MAX_REFERENCES} references are allowed.` });
  }
  if (
    shape.authorizedLinks !== null &&
    shape.authorizedLinks !== undefined &&
    shape.authorizedLinks.length > MAX_AUTHORIZED_LINKS
  ) {
    failures.push({ propertyName: 'AuthorizedLinks', message: `At most ${MAX_AUTHORIZED_LINKS} authorised links are allowed.` });
  }

  if (shape.categoryIds === null || shape.categoryIds === undefined || shape.categoryIds.length === 0) {
    failures.push({ propertyName: 'CategoryIds', message: 'Select at least one category.' });
  } else {
    shape.categoryIds.forEach((categoryId, index) => {
      mustBeNonBlank(failures, `CategoryIds[${index}]`, categoryId);
    });
  }

  (shape.tags ?? []).forEach((tag, index) => {
    mustBeNonBlank(failures, `Tags[${index}]`, tag);
  });

  (shape.references ?? []).forEach((reference, index) => {
    maximumLength(failures, `References[${index}]`, reference, 500);
  });

  (shape.authorizedLinks ?? []).forEach((link, index) => {
    mustBeNonBlank(failures, `AuthorizedLinks[${index}].Label`, link.label);
    mustBeNonBlank(failures, `AuthorizedLinks[${index}].Url`, link.url);
  });

  if (failures.length > 0) {
    throwValidation(failures);
  }
}

export interface UpsertCategoryShape {
  id: string | null | undefined;
  name: string | null | undefined;
  description: string | null | undefined;
}

export function validateUpsertCategory(shape: UpsertCategoryShape): void {
  const failures: Failure[] = [];

  mustBeNonBlank(failures, 'Id', shape.id);
  maximumLength(failures, 'Id', shape.id, 100);
  if (typeof shape.id === 'string' && shape.id !== '' && !CATEGORY_ID_PATTERN.test(shape.id)) {
    failures.push({
      propertyName: 'Id',
      message: 'Category id may contain letters, digits, dots, hyphens and underscores only.',
    });
  }

  mustBeNonBlank(failures, 'Name', shape.name);
  maximumLength(failures, 'Name', shape.name, 120);

  maximumLength(failures, 'Description', shape.description, 1000);

  if (failures.length > 0) {
    throwValidation(failures);
  }
}

/** ContentQueryValidator: only the search length is a caller-fixable mistake. */
export function validateContentQuery(search: string | null | undefined): void {
  const failures: Failure[] = [];
  maximumLength(failures, 'Search', search, MAX_SEARCH_LENGTH);
  if (failures.length > 0) {
    throwValidation(failures);
  }
}

// Re-exported so modules only need one import site for validation errors.
export { ValidationError };
