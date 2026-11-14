/**
 * Byte-compatible output formatting for the ASP.NET contract.
 *
 * The .NET API surfaces TWO distinct serialisers and the frontend never notices —
 * but a byte-level comparison does, so both are reproduced here:
 *
 *  1. The framework serialiser (Results.Ok / Results.Problem / status pages):
 *     JavaScriptSerializerDefaults.Web keeps non-ASCII characters RAW. Reproduced
 *     with JSON.stringify, which escapes only quote, backslash and control chars.
 *
 *  2. GlobalExceptionHandler's own serialiser (`new JsonSerializerOptions(
 *     JsonSerializerDefaults.Web)`): the default JavaScriptEncoder is ASCII-safe,
 *     so non-ASCII becomes \uXXXX (UPPERCASE hex, e.g. \u062F) on top of the
 *     HTML-sensitive escapes (' < > & +). Reproduced by `sysJson`.
 *
 * Timestamps also differ per table: DateTimeOffset columns print "+00:00" with
 * trailing zeros trimmed, raw ADO DateTime columns print "Z", and the
 * site-settings version string is DateTime.ToString("O") — always seven
 * fractional digits. netTimestamp / netTimestampZ / netOSeven cover each.
 */

const HTML_SENSITIVE = new Set(["'", '<', '>', '&', '+']);

/** One string exactly as System.Text.Json's default JavaScriptEncoder writes it. */
export function stjString(value: string): string {
  let out = '"';
  for (const ch of value) {
    const code = ch.codePointAt(0) as number;
    switch (ch) {
      case '"':
        out += '\\"';
        continue;
      case '\\':
        out += '\\\\';
        continue;
      case '\b':
        out += '\\b';
        continue;
      case '\t':
        out += '\\t';
        continue;
      case '\n':
        out += '\\n';
        continue;
      case '\f':
        out += '\\f';
        continue;
      case '\r':
        out += '\\r';
        continue;
      default:
        break;
    }
    if (code < 0x20 || code === 0x7f) {
      out += `\\u${code.toString(16).toUpperCase().padStart(4, '0')}`;
      continue;
    }
    if (HTML_SENSITIVE.has(ch)) {
      out += `\\u${code.toString(16).toUpperCase().padStart(4, '0')}`;
      continue;
    }
    if (code === 0x2028 || code === 0x2029) {
      out += `\\u${code.toString(16).toUpperCase().padStart(4, '0')}`;
      continue;
    }
    if (code > 0x7e) {
      // ASCII-safe encoder: every non-ASCII code point (including emoji
      // surrogate pairs, iterated as whole points above) escapes individually.
      out += `\\u${code.toString(16).toUpperCase().padStart(4, '0')}`;
      continue;
    }
    out += ch;
  }
  return `${out}"`;
}

/** Serialises a JSON-compatible tree exactly like GlobalExceptionHandler does. */
export function sysJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return stjString(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    let out = '[';
    for (let i = 0; i < value.length; i++) {
      if (i > 0) out += ',';
      out += sysJson(value[i]);
    }
    return `${out}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
  let out = '{';
  let first = true;
  for (const [key, v] of entries) {
    if (!first) out += ',';
    first = false;
    out += stjString(key);
    out += ':';
    out += sysJson(v);
  }
  return `${out}}`;
}

/**
 * Framework-serialiser output: JSON.stringify. Callers must never pass Date
 * instances — all dates are pre-formatted with the net* helpers so the wire
 * format is chosen explicitly, not by JSON's own Date serialisation.
 */
export function httpJson(value: unknown): string {
  return JSON.stringify(value);
}

function pad(value: number, width: number): string {
  return value.toString().padStart(width, '0');
}

function trimTrailingZeros(value: string): string {
  return value.replace(/0+$/, '') || '0';
}

/**
 * DateTimeOffset as System.Text.Json writes it: UTC, fractional seconds kept
 * only down to the last non-zero digit ("…12.278+00:00", "…15:00:00+00:00").
 */
export function netTimestamp(date: Date): string {
  const ms = date.getUTCMilliseconds();
  const fraction = ms === 0 ? '' : `.${trimTrailingZeros(pad(ms, 3))}`;
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}` +
    `T${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:${pad(date.getUTCSeconds(), 2)}` +
    `${fraction}+00:00`
  );
}

/** DateTime (Kind=Utc) as System.Text.Json writes it: same trimming, "Z" suffix. */
export function netTimestampZ(date: Date): string {
  const ms = date.getUTCMilliseconds();
  const fraction = ms === 0 ? '' : `.${trimTrailingZeros(pad(ms, 3))}`;
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}` +
    `T${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:${pad(date.getUTCSeconds(), 2)}` +
    `${fraction}Z`
  );
}

/**
 * DateTime.ToString("O") — the format the site-settings endpoint uses for its
 * version string: ALWAYS seven fractional digits plus Z.
 */
export function netOSeven(date: Date): string {
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}` +
    `T${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:${pad(date.getUTCSeconds(), 2)}` +
    `.${pad(date.getUTCMilliseconds() * 1000, 7)}Z`
  );
}
