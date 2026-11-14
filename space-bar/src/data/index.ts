import { chapter1 } from './chapter1';
import { questions, conflicts } from './questions';
import { events } from './events';
import { validateContent } from './validate';

export const content = { chapter: chapter1, questions, conflicts, events };
export type Content = typeof content;
export * from './endings';
export { briefing, eraSources } from './chapter1';
export { history } from './history';

const errors = validateContent(content);
if (errors.length) throw new Error('Content errors:\n' + errors.join('\n'));
