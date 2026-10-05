import { createAntigravityQuotaUsageLoader } from '../static/app/antigravity-quota-summary.js';

describe('Antigravity provider quota summary', () => {
    test('sums each healthy enabled account usage percentage', async () => {
        const providers = [
            { uuid: 'antigravity-a', isHealthy: true },
            { uuid: 'antigravity-b', isHealthy: true, isDisabled: false },
            { uuid: 'antigravity-c', isHealthy: false },
            { uuid: 'antigravity-d', isHealthy: true, isDisabled: true }
        ];
        const apiClient = {
            get: jest.fn(async url => url.endsWith('/antigravity-a/quota')
                ? { quota: { available: true, usedPercentage: 24.2 } }
                : { quota: { available: true, usedPercentage: 79.7 } })
        };
        const loadUsage = createAntigravityQuotaUsageLoader({ apiClient });

        await expect(loadUsage(providers)).resolves.toEqual({
            available: true,
            usedPercent: 104,
            totalPercent: 200
        });
        expect(apiClient.get).toHaveBeenCalledTimes(2);
        expect(apiClient.get).toHaveBeenCalledWith('/providers/gemini-antigravity/antigravity-a/quota');
    });

    test('marks the total unavailable when a healthy account quota cannot be read', async () => {
        const apiClient = { get: jest.fn().mockRejectedValue(new Error('request failed')) };
        const loadUsage = createAntigravityQuotaUsageLoader({ apiClient });

        await expect(loadUsage([{ uuid: 'antigravity-a', isHealthy: true }])).resolves.toEqual({
            available: false,
            usedPercent: null,
            totalPercent: 100
        });
    });

    test('returns zero usage without requests when there are no healthy enabled accounts', async () => {
        const apiClient = { get: jest.fn() };
        const loadUsage = createAntigravityQuotaUsageLoader({ apiClient });

        await expect(loadUsage([{ uuid: 'antigravity-a', isHealthy: false }])).resolves.toEqual({
            available: true,
            usedPercent: 0,
            totalPercent: 0
        });
        expect(apiClient.get).not.toHaveBeenCalled();
    });
});