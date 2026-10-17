import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Paginator setStyles frame guard', () => {
    // `setStyles` schedules a frame that reads `#view`, and `destroy()` can clear `#view` before that
    // frame fires. The frame only fires with a book open and a paint pumped, so this checks the source:
    // every closure inside `setStyles` that reads `this.#view` null-checks it first.

    it('guards every closure inside setStyles that reads from #view', () => {
        const source = readFileSync(resolve(__dirname, './paginator.js'), 'utf-8');

        // Slice out the `setStyles` method body. The method is the only one
        // that schedules a rAF reading `.docBackground`, so isolating it
        // keeps the test focused.
        const setStylesMatch = source.match(/^ {4}setStyles\([\s\S]*?^ {4}\}/m);
        expect(setStylesMatch, 'setStyles method not found in paginator.js').toBeTruthy();
        const body = setStylesMatch![0];

        // Pull out every `() => { ... }` arrow-callback inside setStyles.
        const closures = Array.from(body.matchAll(/\(\s*\)\s*=>\s*\{([\s\S]*?)\n {8}\}\)/g)).map((m) => m[1]);
        expect(closures.length, 'expected at least one deferred callback inside setStyles').toBeGreaterThan(0);

        const unsafe = closures.filter((c) => /this\.#view\b/.test(c) && !/if\s*\(\s*!\s*this\.#view\s*\)\s*return/.test(c));

        expect(unsafe, `setStyles closures must null-check #view before dereferencing it (unsafe: ${unsafe.join('\n---\n')})`).toEqual([]);
    });
});
