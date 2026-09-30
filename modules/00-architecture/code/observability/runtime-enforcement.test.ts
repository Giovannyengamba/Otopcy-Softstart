// Source: pattern composed from D-05 + fast-glob's documented sync API.
// Goal: any route file under app/api/** that lacks `runtime = 'nodejs'` fails CI.
import { describe, expect, it } from 'vitest';
import fg from 'fast-glob';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API_GLOB = 'src/app/api/**/route.ts';
// Project-root-relative; vitest by default cwd is the package root (frontend/).
const ROOT = resolve(__dirname, '../../../..');

describe('runtime enforcement: every API route exports runtime="nodejs"', () => {
  const routeFiles = fg.sync(API_GLOB, { cwd: ROOT, absolute: true });

  it('discovered at least one API route file', () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  // Per-file tests — failure message names the exact file
  // (D-05 specifics: "should output the offending file path on failure").
  for (const file of routeFiles) {
    const rel = file.replace(ROOT + '/', '');
    it(`${rel} exports runtime = 'nodejs'`, () => {
      const src = readFileSync(file, 'utf8');
      // Tolerant regex — handles single/double quotes and trailing semicolon.
      const ok = /export\s+const\s+runtime\s*=\s*['"]nodejs['"]/.test(src);
      const hasEdge = /export\s+const\s+runtime\s*=\s*['"]edge['"]/.test(src);
      expect(hasEdge, `${rel} declares runtime='edge' — Prisma/bcrypt/Buffer break on edge`).toBe(
        false,
      );
      expect(ok, `${rel} is missing \`export const runtime = 'nodejs'\``).toBe(true);
    });
  }
});
