/** The help center as flash-support-service serves it (`/support/v1/help/*`). */

export interface HelpCollectionRef {
  slug: string;
  name: string;
}

export interface HelpArticleSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  collection: HelpCollectionRef | null;
}

export interface HelpCollection {
  slug: string;
  name: string;
  description: string;
  articleCount: number;
  articles: HelpArticleSummary[];
  children: HelpCollection[];
}

export interface HelpHome {
  collections: HelpCollection[];
  otherArticles: HelpArticleSummary[];
}

export interface HelpCollectionPage {
  collection: HelpCollection;
  parent: HelpCollectionRef | null;
}

export interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  description: string;
  /** Markdown with absolute links and image URLs. */
  markdown: string;
  audience: 'public' | 'signed_in';
  versionId: string;
  versionNumber: number;
  updatedAt: string;
  collection: HelpCollectionRef | null;
  parent: HelpCollectionRef | null;
  related: HelpArticleSummary[];
  /** The public web page; null for articles only signed-in users can read. */
  url: string | null;
}

export interface HelpSearchHit extends HelpArticleSummary {
  snippet: string;
}

/** An old or renamed slug: the server names the current one. */
export interface HelpRedirect {
  redirectTo: string;
}
