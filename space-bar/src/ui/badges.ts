import type { AchievementId } from '../game/achievements';

/** The 13 badge SVGs (drawn by Codex from ./badges/BRIEF.md), as raw markup keyed by file path. */
const files = import.meta.glob<string>('./badges/*.svg', { query: '?raw', import: 'default', eager: true });

/** Raw SVG markup for an achievement's badge. */
export function badgeSvg(id: AchievementId): string {
  const svg = files[`./badges/${id}.svg`];
  if (svg === undefined) throw new Error(`No badge art for ${id}`);
  return svg;
}
