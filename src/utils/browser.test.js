import { copyText, randomId } from './browser';

describe('copyText', () => {
    const originalClipboard = navigator.clipboard;

    afterEach(() => {
        Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
        delete document.execCommand;
        jest.restoreAllMocks();
    });

    const setClipboard = value =>
        Object.defineProperty(navigator, 'clipboard', { value, configurable: true });

    it('should use the clipboard API when the page is served over https', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        setClipboard({ writeText });
        await expect(copyText('YVL55H')).resolves.toBe(true);
        expect(writeText).toHaveBeenCalledWith('YVL55H');
    });

    // Production is plain http, where navigator.clipboard does not exist at all —
    // calling .writeText on it threw "Cannot read properties of undefined".
    it('should fall back to execCommand when the clipboard API is missing (http)', async () => {
        setClipboard(undefined);
        document.execCommand = jest.fn(() => true);
        await expect(copyText('YVL55H')).resolves.toBe(true);
        expect(document.execCommand).toHaveBeenCalledWith('copy');
        expect(document.querySelector('textarea')).toBeNull(); // cleaned up after itself
    });

    it('should fall back when the clipboard API exists but is blocked', async () => {
        setClipboard({ writeText: jest.fn().mockRejectedValue(new Error('denied')) });
        document.execCommand = jest.fn(() => true);
        await expect(copyText('YVL55H')).resolves.toBe(true);
    });

    it('should report failure instead of throwing when nothing can copy', async () => {
        setClipboard(undefined);
        document.execCommand = jest.fn(() => {
            throw new Error('not supported');
        });
        await expect(copyText('YVL55H')).resolves.toBe(false);
    });

    it('should ignore empty text', async () => {
        await expect(copyText('')).resolves.toBe(false);
        await expect(copyText(null)).resolves.toBe(false);
    });
});

describe('randomId', () => {
    const originalCrypto = global.crypto;

    afterEach(() => {
        Object.defineProperty(global, 'crypto', { value: originalCrypto, configurable: true });
    });

    const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    it('should use crypto.randomUUID when available', () => {
        Object.defineProperty(global, 'crypto', {
            value: { randomUUID: () => '11111111-2222-4333-8444-555555555555' },
            configurable: true,
        });
        expect(randomId()).toBe('11111111-2222-4333-8444-555555555555');
    });

    // http production has crypto.getRandomValues but NOT crypto.randomUUID
    it('should still produce a valid v4 uuid without crypto.randomUUID', () => {
        Object.defineProperty(global, 'crypto', {
            // The real API fills the array it is given, in place.
            value: {
                getRandomValues: arr => {
                    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
                    return arr;
                },
            },
            configurable: true,
        });
        const id = randomId();
        expect(id).toMatch(UUID_V4);
        expect(randomId()).not.toBe(id);
    });

    it('should still produce a valid v4 uuid with no crypto at all', () => {
        Object.defineProperty(global, 'crypto', { value: undefined, configurable: true });
        expect(randomId()).toMatch(UUID_V4);
    });
});
