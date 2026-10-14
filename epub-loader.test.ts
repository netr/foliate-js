import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Loader } from './epub.js';

const IMAGE = { href: 'images/plate.png', mediaType: 'image/png' };

function imageLoader() {
    return new Loader({
        loadText: async () => '',
        loadBlob: async () => new Blob(['png'], { type: 'image/png' }),
        resources: { manifest: [IMAGE] },
        entries: new Map(),
    });
}

describe('Loader reference counting', () => {
    const revoked = new Set<string>();
    let nextUrl = 0;
    const { createObjectURL, revokeObjectURL } = URL;

    beforeEach(() => {
        revoked.clear();
        nextUrl = 0;
        // jsdom has no object URLs; stand-ins record which URLs were revoked.
        URL.createObjectURL = vi.fn(() => `blob:test/${(nextUrl += 1)}`);
        URL.revokeObjectURL = vi.fn((url: string) => {
            revoked.add(url);
        });
    });

    afterEach(() => {
        URL.createObjectURL = createObjectURL;
        URL.revokeObjectURL = revokeObjectURL;
    });

    it('keeps a section loaded while any reader that loaded it has not unloaded it', async () => {
        // A reader shows the section while a second reader of the same book loads and unloads it too.
        const loader = imageLoader();
        const url = await loader.loadItem(IMAGE);
        await loader.loadItem(IMAGE);
        await loader.loadItem(IMAGE);

        loader.unloadItem(IMAGE);
        loader.unloadItem(IMAGE);

        expect(revoked.has(url)).toBe(false);
    });

    it('counts two loads of a section that start together, so one unload leaves it loaded', async () => {
        // A new book: two readers ask for the same section at once.
        const loader = imageLoader();
        await Promise.all([loader.loadItem(IMAGE), loader.loadItem(IMAGE)]);

        loader.unloadItem(IMAGE);

        expect([...revoked]).toEqual([]);
    });

    it('hands both loads of a section that start together the same URL', async () => {
        const loader = imageLoader();
        const [first, second] = await Promise.all([loader.loadItem(IMAGE), loader.loadItem(IMAGE)]);

        expect(second).toBe(first);
    });

    it('revokes a section once every load has been unloaded', async () => {
        const loader = imageLoader();
        const url = await loader.loadItem(IMAGE);
        await loader.loadItem(IMAGE);
        await loader.loadItem(IMAGE);

        loader.unloadItem(IMAGE);
        loader.unloadItem(IMAGE);
        loader.unloadItem(IMAGE);

        expect(revoked.has(url)).toBe(true);
    });
});
