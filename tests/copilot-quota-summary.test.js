import { createCopilotQuotaUsageLoader } from '../static/app/copilot-quota-summary.js';

describe('GitHub Copilot provider quota summary', () => {
    test('sums each healthy enabled account usage percentage', async () => {
        const providers = [
            { uuid: 'copilot-a', isHealthy: true },
            { uuid: 'copilot-b', isHealthy: true, isDisabled: false },
            { uuid: 'copilot-c', isHealthy: false },
            { uuid: 'copilot-d', isHealthy: true, isDisabled: true }
        ];
        const apiClient = {
            get: jest.fn(async url => url.endsWith('/copilot-a/quota')
                ? { quota: { available: true, usedPercentage: 29.4 } }
                : { quota: { available: true, usedPercentage: 46.7 } })
        };
        const loadUsage = createCopilotQuotaUsageLoader({ apiClient });

        await expect(loadUsage(providers)).resolves.toEqual({
            available: true,
            usedPercent: 76,
            totalPercent: 200
        });
        expect(apiClient.get).toHaveBeenCalledTimes(2);
        expect(apiClient.get).toHaveBeenCalledWith('/providers/github-copilot/copilot-a/quota');
    });

    test.each([
        ['unlimited quota', { available: true, isUnlimited: true, usedPercentage: null }],
        ['unavailable quota', { available: false, usedPercentage: null }]
    ])('marks the total unavailable for an %s account', async (_description, quota) => {
        const apiClient = { get: jest.fn().mockResolvedValue({ quota }) };
        const loadUsage = createCopilotQuotaUsageLoader({ apiClient });

        await expect(loadUsage([{ uuid: 'copilot-a', isHealthy: true }])).resolves.toEqual({
            available: false,
            usedPercent: null,
            totalPercent: 100
        });
    });

    test('marks the total unavailable when a healthy account lookup fails', async () => {
        const apiClient = { get: jest.fn().mockRejectedValue(new Error('request failed')) };
        const loadUsage = createCopilotQuotaUsageLoader({ apiClient });

        await expect(loadUsage([{ uuid: 'copilot-a', isHealthy: true }])).resolves.toEqual({
            available: false,
            usedPercent: null,
            totalPercent: 100
        });
    });

    test('returns zero usage without requests when no healthy enabled accounts exist', async () => {
        const apiClient = { get: jest.fn() };
        const loadUsage = createCopilotQuotaUsageLoader({ apiClient });

        await expect(loadUsage([{ uuid: 'copilot-a', isHealthy: false }])).resolves.toEqual({
            available: true,
            usedPercent: 0,
            totalPercent: 0
        });
        expect(apiClient.get).not.toHaveBeenCalled();
    });
});