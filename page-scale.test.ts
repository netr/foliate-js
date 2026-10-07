import { describe, expect, it } from 'vitest';

import { documentPage, pageViewportStyles, scaledRootStyles, viewportUnitsOfPage } from './page-scale.js';

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

describe('viewportUnitsOfPage', () => {
    it("measures the book's viewport lengths against the section's page, which a scaled page no longer is", () => {
        expect(viewportUnitsOfPage('.page { min-height: 99vh; max-height: 98vh !important; }')).toBe(
            '.page { min-height: calc(99 * var(--page-vh, 1vh)); max-height: calc(98 * var(--page-vh, 1vh)) !important; }',
        );
    });

    it('rewrites widths, the smaller and larger side, decimals, negatives and the small, large and dynamic variants', () => {
        expect(viewportUnitsOfPage('a { width: 50vw; margin: -2.5vmin 0 .5vmax; height: 100dvh; top: 10svh; }')).toBe(
            'a { width: calc(50 * var(--page-vw, 1vw)); margin: calc(-2.5 * var(--page-vmin, 1vmin)) 0 calc(.5 * var(--page-vmax, 1vmax)); height: calc(100 * var(--page-vh, 1vh)); top: calc(10 * var(--page-vh, 1vh)); }',
        );
    });

    it('leaves feature tests alone and rewrites the rules inside them', () => {
        expect(viewportUnitsOfPage('@supports (display: flex) and (min-height: 90vh) { .a { min-height: 90vh; } }')).toBe(
            '@supports (display: flex) and (min-height: 90vh) { .a { min-height: calc(90 * var(--page-vh, 1vh)); } }',
        );
    });

    it('leaves names that only contain a unit alone', () => {
        const css = '.image-90vh, #h100vw { color: red; } @import url(img-10vh.png);';
        expect(viewportUnitsOfPage(css)).toBe(css);
    });
});

describe('pageViewportStyles', () => {
    it("gives a scaled section's viewport units the section's own size", () => {
        expect(pageViewportStyles({ width: 820, height: 1180 }, 0.5)).toEqual({
            '--page-vw': '8.2px',
            '--page-vh': '11.8px',
            '--page-vmin': '8.2px',
            '--page-vmax': '11.8px',
        });
    });

    it('leaves an unscaled section on the browser viewport', () => {
        expect(pageViewportStyles({ width: 820, height: 1180 }, 1)).toEqual({
            '--page-vw': '1vw',
            '--page-vh': '1vh',
            '--page-vmin': '1vmin',
            '--page-vmax': '1vmax',
        });
    });
});
