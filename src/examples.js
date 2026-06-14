import examplesBook from '../dist-content/examples.json';

export {
  INTRO_NOTES_BY_MODE,
  INTRO_NOTES,
  getIntroNotes,
} from './introNotes.js';

export const EXAMPLES = (examplesBook.challenges || []).map(ch => ({
  id: ch.id,
  name: ch.name,
}));

export default examplesBook;
