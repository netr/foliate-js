import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getVisibleRange } from './paginator.js';

/**
 * jsdom lays nothing out, so each element's box comes from its `data-rect` attribute ("left,top,width,height")
 * and a Range measures the way WebKit does: the border boxes of the elements it selects whole, plus the boxes
 * of the text nodes it touches. A range that selects no element whole and touches no text has no rects.
 */
function rectOf(el: Element): DOMRect {
    const [left, top, width, height] = (el.getAttribute('data-rect') ?? '0,0,0,0').split(',').map(Number);
    return new DOMRect(left, top, width, height);
}

function rangeRects(range: Range): DOMRect[] {
    const doc = range.startContainer.ownerDocument!;
    const rects: DOMRect[] = [];
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.nodeValue?.trim() && range.intersectsNode(node)) rects.push(rectOf(node.parentElement!));
            continue;
        }
        const whole = doc.createRange();
        whole.selectNode(node);
        const selectedWhole =
            range.compareBoundaryPoints(Range.START_TO_START, whole) <= 0 && range.compareBoundaryPoints(Range.END_TO_END, whole) >= 0;
        if (selectedWhole) rects.push(rectOf(node as Element));
    }
    return rects;
}

function union(rects: DOMRect[]): DOMRect {
    if (rects.length === 0) return new DOMRect(0, 0, 0, 0);
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return new DOMRect(left, top, right - left, bottom - top);
}

const originals = {
    element: Element.prototype.getBoundingClientRect,
    rangeBounding: Range.prototype.getBoundingClientRect,
    rangeRects: Range.prototype.getClientRects,
};

beforeEach(() => {
    Element.prototype.getBoundingClientRect = function (this: Element) {
        return rectOf(this);
    };
    Range.prototype.getClientRects = function (this: Range) {
        const rects = rangeRects(this);
        return Object.assign(rects, { item: (i: number) => rects[i] ?? null }) as unknown as DOMRectList;
    };
    Range.prototype.getBoundingClientRect = function (this: Range) {
        return union(rangeRects(this));
    };
});

afterEach(() => {
    Element.prototype.getBoundingClientRect = originals.element;
    Range.prototype.getBoundingClientRect = originals.rangeBounding;
    Range.prototype.getClientRects = originals.rangeRects;
});

/** A chapter in three 1095 px columns: the heading, a full-page image, the first paragraph. */
function chapterWithFullPageImage(): Document {
    document.body.innerHTML = `
        <div class="heading" data-rect="41,0,1012,120"><h1 data-rect="41,0,1012,120">Chapter 6</h1></div>
        <div class="full-page-image-block" data-rect="1136,0,1012,1781">
            <div class="full-page-image__container" data-rect="1136,0,1012,1781">
                <div class="full-page-image__block" data-rect="1490,738,304,304">
                    <img class="full-page-image__image" data-rect="1490,738,304,304" alt="" />
                </div>
            </div>
        </div>
        <p class="first" data-rect="2231,0,1012,60">Text after the image.</p>`;
    return document;
}

function ancestorsBelowBody(el: Element): Element[] {
    const out: Element[] = [];
    for (let p = el.parentElement; p && p !== el.ownerDocument.body; p = p.parentElement) out.push(p);
    return out;
}

describe('getVisibleRange on a page with no text', () => {
    it('returns a range with client rects, so a relayout can scroll back to the same page', () => {
        const doc = chapterWithFullPageImage();
        const pageStart = 1095;
        const pageEnd = 2190;

        const range = getVisibleRange(doc, pageStart, pageEnd, (rect: DOMRect) => rect);

        const rects = [...range.getClientRects()];
        expect(rects.length, 'a visible image page must measure as something').toBeGreaterThan(0);
        expect(rects.every((r) => r.left >= pageStart && r.right <= pageEnd), 'every rect lies on the visible page').toBe(true);
        expect(range.intersectsNode(doc.querySelector('img')!)).toBe(true);
    });

    it('selects an image that overflows its page, so the relayout returns to that page and not the first', () => {
        const doc = chapterWithFullPageImage();
        // A plate drawn wider than its column, its wrappers sized by it: every box starts on page 2
        // and runs 300 px into page 3, so nothing between the body and the image is wholly in view.
        const img = doc.querySelector<HTMLElement>('img')!;
        for (const el of [img, ...ancestorsBelowBody(img)]) el.setAttribute('data-rect', '1136,0,1354,1781');
        const pageStart = 1095;
        const pageEnd = 2190;

        const range = getVisibleRange(doc, pageStart, pageEnd, (rect: DOMRect) => rect);

        expect(range.intersectsNode(img), 'the image is the visible content').toBe(true);
        expect(range.intersectsNode(doc.querySelector('h1')!), 'the heading on page 1 is not').toBe(false);
        const rects = [...range.getClientRects()];
        expect(rects.length).toBeGreaterThan(0);
        expect(rects[0].left, 'the anchor rect begins on page 2').toBeGreaterThanOrEqual(pageStart);
        expect(rects[0].left).toBeLessThan(pageEnd);
    });

    it('still splits a paragraph that straddles two pages at its text', () => {
        const doc = chapterWithFullPageImage();
        doc.querySelector('p.first')!.setAttribute('data-rect', '2000,0,1012,60');

        const range = getVisibleRange(doc, 1095, 2190, (rect: DOMRect) => rect);

        expect(range.intersectsNode(doc.querySelector('p.first')!)).toBe(true);
        expect(range.endContainer.nodeType, 'a text-bearing element is entered at its text, not selected whole').toBe(Node.TEXT_NODE);
    });

    it('still measures text pages by their text', () => {
        const doc = chapterWithFullPageImage();

        const range = getVisibleRange(doc, 2190, 3285, (rect: DOMRect) => rect);

        expect(range.toString()).toBe('Text after the image.');
        expect(range.getBoundingClientRect().left).toBe(2231);
    });
});
