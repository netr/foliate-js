import { describe, expect, it } from 'vitest';

import { fromElements } from './epubcfi.js';

describe('CFI.fromElements', () => {
    it('returns an empty array when given no elements (regression: LACUNA-RS-KD)', () => {
        // Sentry LACUNA-RS-KD: when an EPUB has an empty <spine> (no <itemref>
        // children) the Resources constructor passed `[]` to fromElements,
        // which destructured `elements[0]` and threw:
        //   TypeError: Cannot destructure property 'parentNode' of 'n[0]' as
        //   it is undefined.
        // Expected behavior: an empty input maps to an empty CFI list so the
        // preview component can render a "no content" state instead of
        // crashing during book parsing.
        expect(() => fromElements([])).not.toThrow();
        expect(fromElements([])).toEqual([]);
    });
});
