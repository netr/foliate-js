import { describe, expect, it } from 'vitest';

import { documentPage, scaledRootStyles } from './page-scale.js';

describe('documentPage', () => {
    it('lays the page out at the container size when the page is not scaled', () => {
        expect(documentPage({ clientWidth: 600, clientHeight: 800, exactWidth: 600.25, exactHeight: 800.5, vertical: false }, 1)).toEqual({
            width: 600,
            height: 800,
            scale: 1,
        });
    });

    it("lays a scaled page out at the reader's whole-pixel size, as an unscaled container of that size measures", () => {
        // An iPad page, 820 x 1180 CSS px, shown 400 px wide.
        const pageScale = 400 / 820;
        const page = documentPage({ clientWidth: 400, clientHeight: 576, exactWidth: 400, exactHeight: 1180 * pageScale, vertical: false }, pageScale);

        expect(page.width).toBe(820);
        expect(page.height).toBe(1180);
    });

    it('draws the page so that one page of the section is exactly one scroll step of the container', () => {
        // A Kindle page whose CSS width is fractional: the section lays it out at the whole pixel the
        // container would measure, and the drawing scale maps that onto the container's whole-pixel step.
        const pageWidthCss = 571.733;
        const pageScale = 409 / pageWidthCss;
        const page = documentPage(
            { clientWidth: 409, clientHeight: 559, exactWidth: 409, exactHeight: 781.5 * pageScale, vertical: false },
            pageScale,
        );

        expect(page.width).toBe(572);
        expect(page.width * page.scale).toBeCloseTo(409, 10);
    });

    it('steps vertical pages by the container height', () => {
        const pageScale = 0.5;
        const page = documentPage({ clientWidth: 300, clientHeight: 451, exactWidth: 300, exactHeight: 450.75, vertical: true }, pageScale);

        expect(page.height).toBe(902);
        expect(page.height * page.scale).toBeCloseTo(451, 10);
    });
});

describe('scaledRootStyles', () => {
    it('draws the section root at the scale, from its top left corner', () => {
        expect(scaledRootStyles(0.5)).toEqual({ transform: 'scale(0.5)', 'transform-origin': '0 0' });
    });

    it('clears the transform on an unscaled page', () => {
        expect(scaledRootStyles(1)).toEqual({ transform: 'none', 'transform-origin': '0 0' });
    });
});
