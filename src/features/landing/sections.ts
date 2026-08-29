/**
 * The anchors the landing's navigation points at.
 *
 * Named once so the header, the footer and the sections themselves cannot drift apart: a link to
 * an anchor that no longer exists scrolls nowhere and says nothing about why.
 */
export const LANDING_SECTIONS = {
  features: 'vozmozhnosti',
  trust: 'dannye',
  pricing: 'tarify',
  faq: 'voprosy',
} as const;

/**
 * How far below the top a section starts when the address bar jumps to its anchor.
 *
 * The site header is sticky, so without this the heading of the section lands underneath it and
 * the visitor arrives looking at the second paragraph.
 */
export const HEADER_OFFSET = 76;
