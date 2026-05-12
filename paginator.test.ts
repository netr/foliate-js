import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Paginator setStyles rAF guard (regression: LACUNA-RS-KP)', () => {
    // Sentry LACUNA-RS-KP surfaces:
    //   TypeError: null is not an object (evaluating 'this.#s.docBackground')
    // raised inside a `requestAnimationFrame` callback. The only rAF in
    // paginator.js that reads `.docBackground` is the one inside `setStyles`:
    //
    //     requestAnimationFrame(() => {
    //         this.#replaceBackground(this.#view.docBackground, this.columnCount)
    //     })
    //
    // The race is well understood: `setStyles` schedules the rAF while the
    // paginator has a live view, then `destroy()` nulls `#view` before the
    // browser fires the callback. The sibling `#mediaQueryListener` (which
    // calls the exact same method with the exact same arguments) already
    // guards with `if (!this.#view) return`. The fix is to add the same guard
    // to the rAF body so it short-circuits instead of dereferencing null.
    //
    // The rAF callback only fires when a real book is open and a paint frame
    // is pumped — neither is realistic to set up in jsdom without mocking
    // half of foliate-js. So this test asserts the structural guarantee
    // directly against the source file: every closure inside `setStyles` that
    // dereferences `this.#view` must first null-check it.

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
