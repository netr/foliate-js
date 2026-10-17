import { describe, expect, it } from 'vitest';

import { fromElements } from './epubcfi.js';

describe('CFI.fromElements', () => {
    // An EPUB whose <spine> has no <itemref> hands fromElements an empty list while the book is parsed.
    it('returns an empty array when given no elements', () => {
        expect(() => fromElements([])).not.toThrow();
        expect(fromElements([])).toEqual([]);
    });
});
