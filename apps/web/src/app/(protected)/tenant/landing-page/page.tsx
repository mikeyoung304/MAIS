import { redirect } from 'next/navigation';

/**
 * Legacy redirect: /tenant/landing-page → /tenant/pages
 *
 * The old "landing page" terminology has been replaced with
 * multi-page management. This redirect ensures old links and
 * bookmarks continue to work.
 */
export default function LandingPageRedirect() {
  redirect('/tenant/pages');
}
