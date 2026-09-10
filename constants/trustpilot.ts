/**
 * Trustpilot Review Collector configuration.
 *
 * Only the free **widget** is wired up here. Trustpilot's "in-app review collector" —
 * the one that takes a rating inside your own UI and posts it through their API — sits
 * behind a paid plan, so what ships is the embeddable widget: it renders Trustpilot's
 * own stars and hands the user off to the review form on trustpilot.com.
 *
 * Web only, and that is a property of the widget rather than a decision: it is a
 * `<script>` that mounts into a DOM node, and there is no React Native build of it. The
 * native apps have the OS review sheet instead (`useAppOpenStoreReview`), which is both
 * a better experience and the only thing App Store review rules allow in-app.
 *
 * Every value is environment-configured, and the widget hides itself until the business
 * unit id is set — so a build without the values renders nothing rather than an empty
 * Trustpilot frame.
 */

/**
 * Trustpilot's id for the Solid business unit. Found in the Trustpilot Business console
 * under the embed code as `data-businessunit-id`. Without it the widget cannot resolve a
 * profile, which is why it is the flag the whole component is gated on.
 */
export const TRUSTPILOT_BUSINESS_UNIT_ID =
  process.env.EXPO_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID ?? '';

/**
 * Which widget to render, as a Trustpilot template id.
 *
 * Defaults to the **Review Collector**, whose id is the same for every business — it is
 * a template identifier, not a secret. That template is the one that exists to *collect*
 * reviews (stars plus a "Review us on Trustpilot" button) rather than to display ones
 * already left, and it is available on the free plan.
 *
 * Worth checking against the embed code in the Trustpilot Business console when the
 * business unit id is filled in: a wrong template id renders an empty frame rather than
 * an error, and this is overridable from config precisely so that is a one-line fix.
 */
export const TRUSTPILOT_TEMPLATE_ID =
  process.env.EXPO_PUBLIC_TRUSTPILOT_TEMPLATE_ID ?? '56278e9abfbbba0bdcd568bc';

/**
 * The domain the reviews belong to, as registered with Trustpilot ("solid.xyz").
 *
 * Trustpilot reads it as `data-businessunit-id`'s companion for the review link, and it
 * is also what the fallback link below is built from.
 */
export const TRUSTPILOT_DOMAIN = process.env.EXPO_PUBLIC_TRUSTPILOT_DOMAIN ?? 'solid.xyz';

/** Locale passed to the widget; decides the language of its own copy. */
export const TRUSTPILOT_LOCALE = process.env.EXPO_PUBLIC_TRUSTPILOT_LOCALE ?? 'en-US';

/**
 * Where "Write a review" goes when the widget script itself cannot load — an ad blocker,
 * a corporate proxy, or an offline first paint.
 *
 * Worth having rather than rendering nothing: the whole point of the widget is to give a
 * happy user somewhere to go, and Trustpilot's own evaluate URL needs nothing but the
 * domain to work.
 */
export const TRUSTPILOT_REVIEW_URL =
  process.env.EXPO_PUBLIC_TRUSTPILOT_REVIEW_URL ??
  `https://www.trustpilot.com/evaluate/${TRUSTPILOT_DOMAIN}`;

/** URL of Trustpilot's widget bootstrap script. Fixed by Trustpilot, not per-business. */
export const TRUSTPILOT_BOOTSTRAP_SRC =
  'https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js';

/**
 * True when the build carries enough configuration to render the widget.
 *
 * Only the business unit id is required — everything else has a working default — so a
 * deploy is one environment variable rather than four.
 */
export const isTrustpilotConfigured = (): boolean => !!TRUSTPILOT_BUSINESS_UNIT_ID;
