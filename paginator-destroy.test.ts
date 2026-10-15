import { beforeAll, describe, expect, it, vi } from 'vitest';

import './paginator.js';

describe('Paginator.destroy', () => {
    beforeAll(() => {
        // jsdom has neither; the paginator's constructor uses both.
        vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {}
                unobserve() {}
                disconnect() {}
            },
        );
    });

    // A paginator can be torn down before any book was opened in it, for
    // example when a newer book replaces it while it is still mounting.
    it('tears down a paginator that never opened a book', () => {
        const PaginatorElement = customElements.get('foliate-paginator') as unknown as new () => HTMLElement & { destroy: () => void };
        const paginator = new PaginatorElement();
        document.body.append(paginator);

        expect(() => paginator.destroy()).not.toThrow();

        paginator.remove();
    });
});
