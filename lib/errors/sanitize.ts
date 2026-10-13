/** Longest technical message kept for telemetry. */
export const TECHNICAL_MESSAGE_MAX = 500;

/** Calldata and signatures: anything longer than a 32-byte word. */
const LONG_HEX = /0x[0-9a-fA-F]{65,}/g;

const URL_PATTERN = /\bhttps?:\/\/[^\s"'<>]+/gi;

/** `apikey=…`, `token: …`, `"secret":"…"` and friends, in query strings, headers or JSON. */
const SECRET_PAIR =
  /\b(api[_-]?key|apikey|key|token|access[_-]?token|secret|password|authorization)\b(["']?\s*[:=]\s*["']?)(?:Bearer\s+)?[^\s"'&,;}]+/gi;

/** Provider key formats that turn up bare in SDK errors. */
const BARE_SECRETS = [/\bpim_[A-Za-z0-9]{8,}/g, /\bsk_(?:live|test)_[A-Za-z0-9]{8,}/g];

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

  for (const marker of TRAILING_DETAIL_MARKERS) {
    const index = message.indexOf(marker);
    if (index > 0) message = message.slice(0, index);
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
