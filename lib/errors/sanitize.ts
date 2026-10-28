/** Longest technical message kept for telemetry. */
export const TECHNICAL_MESSAGE_MAX = 500;

/** Calldata and signatures: anything longer than a 32-byte word. */
const LONG_HEX = /0x[0-9a-fA-F]{65,}/g;

const URL_PATTERN = /\bhttps?:\/\/[^\s"'<>]+/gi;

/**
 * `apikey=…`, `token: …`, `"secret":"…"` and friends, in query strings, headers
 * or JSON. An `Authorization` value loses its scheme's credential too, not just
 * the scheme: `Authorization: Basic dXNl…` → `Authorization: [redacted]`.
 */
const SECRET_PAIR =
  /\b(api[_-]?key|apikey|key|token|access[_-]?token|secret|password|authorization)\b(["']?\s*[:=]\s*["']?)(?:(?:Bearer|Basic)\s+)?[^\s"'&,;}]+/gi;

/** Provider key formats and credentials that turn up bare in SDK errors. */
const BARE_SECRETS = [
  /\bpim_[A-Za-z0-9]{8,}/g,
  /\bsk_(?:live|test)_[A-Za-z0-9]{8,}/g,
  // A credential, not prose: it has a digit or symbol, or is too long to be a
  // word ("Bearer authentication" stays). The scheme is case-insensitive.
  /\bbearer\s+(?:(?=[A-Za-z0-9._~+/=-]*[0-9._~+/=-])[A-Za-z0-9._~+/=-]{8,}|[A-Za-z0-9._~+/=-]{20,})/gi,
];

/**
 * viem and ethers append the whole request after the human part of the
 * message. That tail is where the RPC URL, its API key and the calldata live.
 */
const TRAILING_DETAIL_MARKERS = [
  'Request body:',
  'Raw Call Arguments:',
  'Request Arguments:',
  'Contract Call:',
  'Docs: ',
  'Version: viem@',
];

/**
 * viem's `Details:` line is the server's own reason, e.g. `sponsorshipPolicy
 * perOpMaximumUsd reached`. It sits after the request dump cut off above, and
 * is often the one line that says what went wrong: without it every paymaster
 * refusal read as "Invalid parameters were provided to the RPC method".
 */
const DETAILS_LINE = /^Details:[ \t]*(\S.*)$/m;

const toText = (raw: unknown): string => {
  if (raw === undefined || raw === null) return '';
  if (typeof raw === 'string') return raw;
  if (raw instanceof Error) return raw.message;
  if (typeof raw === 'object') {
    try {
      return JSON.stringify(raw) ?? '';
    } catch {
      return '';
    }
  }
  return String(raw);
};

/**
 * Strip a raw error message down to something safe to send to telemetry: no
 * API keys (query string, URL path or bare), no calldata, no request dumps,
 * bounded length.
 *
 * This is for GlitchTip, Amplitude and the backend's error record. It is never
 * user copy: what a user reads comes from `toUserError`. Mirrors
 * `sanitizeErrorMessage` in the backend, which runs again on write.
 */
export const sanitizeTechnicalMessage = (
  raw: unknown,
  maxLength = TECHNICAL_MESSAGE_MAX,
): string => {
  let message = toText(raw);
  const details = message.match(DETAILS_LINE)?.[1]?.trim();

  // A dump that starts the message goes too; the Details line, if any, is
  // all that is left of it.
  for (const marker of TRAILING_DETAIL_MARKERS) {
    const index = message.indexOf(marker);
    if (index >= 0) message = message.slice(0, index);
  }

  // Redacted below along with everything else.
  if (details && !message.includes(details)) {
    message = `${message.trimEnd()}\nDetails: ${details}`;
  }

  message = message
    .replace(URL_PATTERN, url => {
      try {
        return `${new URL(url).origin}/…`;
      } catch {
        return '[url]';
      }
    })
    .replace(
      SECRET_PAIR,
      (_match, key: string, separator: string) => `${key}${separator}[redacted]`,
    )
    .replace(LONG_HEX, hex => `${hex.slice(0, 10)}…`);

  for (const pattern of BARE_SECRETS) {
    message = message.replace(pattern, '[redacted]');
  }

  message = message.replace(/\s+/g, ' ').trim();
  return message.length > maxLength ? `${message.slice(0, maxLength - 1)}…` : message;
};
