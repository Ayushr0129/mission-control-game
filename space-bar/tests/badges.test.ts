import { describe, it, expect } from 'vitest';
import { achievements } from '../src/game/achievements';
import { badgeSvg } from '../src/ui/badges';

// Read the badge files directly (as raw text), independently of src/ui/badges.ts.
const files = import.meta.glob<string>('../src/ui/badges/*.svg', { query: '?raw', import: 'default', eager: true });
const svgOf = (id: string) => files[`../src/ui/badges/${id}.svg`];

// The palette: every hex value declared on lines 2-3 of src/style.css. Read from disk because
// Vitest blanks CSS imports (even ?raw); the project has no Node types, hence the untyped import.
const fs: { readFileSync(p: URL, enc: 'utf8'): string } = await import('node:fs' as string);
const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const cssLines = css.split('\n').slice(1, 3).join('\n');
const palette = new Set([...cssLines.matchAll(/--[\w-]+:\s*(#[0-9a-fA-F]{3,8})/g)].map((m) => m[1]!.toLowerCase()));

describe('badges', () => {
  it('reads a palette from style.css', () => {
    expect(palette.size).toBeGreaterThan(5);
  });

  for (const { id } of achievements) {
    describe(id, () => {
      it('has an SVG file', () => {
        expect(svgOf(id)).toBeTypeOf('string');
      });

      it('is a safe 64x64 SVG under 4 KB', () => {
        const svg = svgOf(id)!;
        expect(svg).toContain('viewBox="0 0 64 64"');
        expect(svg).not.toMatch(/<text/i);
        expect(svg).not.toMatch(/<script/i);
        expect(svg).not.toMatch(/\son\w+\s*=|<foreignObject|<style|javascript:|<iframe|<embed|<object/i);
        expect(svg).not.toMatch(/href=/i);
        expect(svg).not.toMatch(/url\(\s*['"]?http/i);
        expect(new TextEncoder().encode(svg).length).toBeLessThan(4096);
      });

      it('uses only palette colours', () => {
        const svg = svgOf(id)!;
        const hexes = [...svg.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
        for (const hex of hexes) expect(palette, `${id} uses ${hex}`).toContain(hex);
        // Colours only as hex, none, currentColor or a local url(#id): no named colours or rgb().
        const paints = [...svg.matchAll(/(?:fill|stroke|stop-color|color)\s*[=:]\s*"?([^";\s>]+)/g)].map((m) => m[1]!);
        for (const v of paints) expect(v, `${id} paint ${v}`).toMatch(/^(#[0-9a-fA-F]{3,8}|none|currentColor|url\(#[\w-]+\))$/);
      });

      it('badgeSvg returns the file markup', () => {
        expect(badgeSvg(id)).toBe(svgOf(id));
      });
    });
  }
});
