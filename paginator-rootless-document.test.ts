import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import './paginator.js';

type PaginatorElement = HTMLElement & {
    open: (book: unknown) => void;
    goTo: (target: { index: number }) => Promise<void>;
    render: () => void;
    destroy: () => void;
};

/**
 * jsdom gives no browsing context to an iframe inside a shadow root, where the paginator keeps its
 * sections, so each section iframe is handed the document of a light-DOM iframe (a real window and
 * a parsed root and body) and its load fires when the paginator sets its src.
 */
const sectionDocuments = new WeakMap<HTMLIFrameElement, Document>();
function giveSectionIframesDocuments() {
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
        configurable: true,
        get(this: HTMLIFrameElement) {
            return sectionDocuments.get(this) ?? null;
        },
    });
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
        configurable: true,
        get: () => '',
        set(this: HTMLIFrameElement) {
            const host = document.createElement('iframe');
            document.body.append(host);
            const doc = host.contentWindow!.document;
            doc.body.innerHTML = '<p>A page of text.</p>';
            // jsdom has no font loading; the paginator waits for it before expanding the section.
            Object.defineProperty(doc, 'fonts', { value: { ready: Promise.resolve() } });
            sectionDocuments.set(this, doc);
            queueMicrotask(() => this.dispatchEvent(new Event('load')));
        },
    });
}

describe('a paginator whose section document has lost its root', () => {
    let colorSchemeListeners: (() => void)[] = [];
    let resizeCallbacks: (() => void)[] = [];

    beforeAll(() => {
        giveSectionIframesDocuments();
        // jsdom does no layout; a range measures as an empty box, so the section is one page.
        Range.prototype.getBoundingClientRect = () => new DOMRect();
        Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
        // jsdom has neither; the paginator's constructor uses both.
        vi.stubGlobal('matchMedia', () => ({
            matches: false,
            addEventListener: (_: string, listener: () => void) => colorSchemeListeners.push(listener),
            removeEventListener: () => {},
        }));
        vi.stubGlobal(
            'ResizeObserver',
            class {
                constructor(callback: () => void) {
                    resizeCallbacks.push(callback);
                }
                observe() {}
                unobserve() {}
                disconnect() {}
            },
        );
    });

    afterEach(() => {
        colorSchemeListeners = [];
        resizeCallbacks = [];
        document.body.replaceChildren();
    });

    /** A paginator showing a one-section book, then its section document emptied the way a teardown leaves it. */
    async function paginatorWithRootlessSection() {
        const Paginator = customElements.get('foliate-paginator') as unknown as new () => PaginatorElement;
        const paginator = new Paginator();
        document.body.append(paginator);
        paginator.open({ dir: 'ltr', sections: [{ linear: 'yes', load: async () => 'section-1.xhtml' }] });
        await paginator.goTo({ index: 0 });
        const iframe = paginator.shadowRoot!.querySelector('iframe')!;
        const doc = iframe.contentDocument!;
        expect(doc.body.textContent).toContain('A page of text.');
        doc.documentElement.remove();
        return paginator;
    }

    it('renders again without styling the missing root', async () => {
        const paginator = await paginatorWithRootlessSection();
        expect(() => paginator.render()).not.toThrow();
    });

    it('takes a layout attribute change without styling the missing root', async () => {
        const paginator = await paginatorWithRootlessSection();
        // A custom element's attribute callback reports what it throws to the window instead of to the caller.
        const reported: unknown[] = [];
        const onError = (event: ErrorEvent) => {
            reported.push(event.error);
            event.preventDefault();
        };
        window.addEventListener('error', onError);
        paginator.setAttribute('flow', 'scrolled');
        paginator.setAttribute('gap', '10%');
        paginator.setAttribute('max-inline-size', '600px');
        window.removeEventListener('error', onError);
        expect(reported).toEqual([]);
    });

    it('takes a resize and a color-scheme change without styling the missing root', async () => {
        await paginatorWithRootlessSection();
        expect(() => {
            for (const callback of resizeCallbacks) callback();
            for (const listener of colorSchemeListeners) listener();
        }).not.toThrow();
    });
});
