// Chapter index for the in-app Teacher Tutorial modal.
// Markdown source is bundled via Vite's `?raw` import so the
// tutorial opens instantly with no network round-trip.

import welcome      from './01-welcome.md?raw';
import adhoc        from './02-adhoc-challenges.md?raw';
import books        from './03-challenge-books.md?raw';
import configuring  from './04-configuring-challenges.md?raw';
import sharing      from './05-saving-and-sharing.md?raw';
import cloudSave    from './06-cloud-save-concept.md?raw';
import backends     from './07-backend-setup.md?raw';
import schoolIt     from './08-appendix-school-it.md?raw';

export const TUTORIAL_CHAPTERS = [
  { slug: 'welcome',          title: '1. Welcome — meet Kara',         body: welcome },
  { slug: 'adhoc',            title: '2. Ad-hoc challenges',            body: adhoc },
  { slug: 'challenge-books',  title: '3. Challenge books',              body: books },
  { slug: 'configuring',      title: '4. Configuring challenges',       body: configuring },
  { slug: 'saving-sharing',   title: '5. Saving & sharing',             body: sharing },
  { slug: 'cloud-save',       title: '6. Cloud save — how it works',    body: cloudSave },
  { slug: 'backends',         title: '7. Backend setup',                body: backends },
  { slug: 'school-it',        title: 'Appendix — School IT',            body: schoolIt },
];

export const DEFAULT_TUTORIAL_SLUG = 'welcome';

export function getTutorialChapter(slug) {
  return TUTORIAL_CHAPTERS.find(c => c.slug === slug) ?? TUTORIAL_CHAPTERS[0];
}
