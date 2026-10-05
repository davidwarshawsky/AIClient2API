jest.mock('../src/providers/adapter.js', () => ({
    getServiceAdapter: jest.fn(),
    getRegisteredProviders: jest.fn(() => []),
    invalidateServiceAdapter: jest.fn(),
    serviceInstances: {}
}));

import { handleGetProviderQuota } from '../src/ui-modules/provider-api.js';
import { getServiceAdapter } from '../src/providers/adapter.js';

describe('provider account quota API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns Codex used percentages for the selected OAuth account', async () => {
        const getUsageLimits = jest.fn().mockResolvedValue({
            plan_type: 'plus',
            rate_limit: {
                primary_window: {
                    used_percent: 32,
                    limit_window_seconds: 18000,
                    reset_at: 1800003600
                },
                secondary_window: {
                    used_percent: 57,
                    limit_window_seconds: 604800,
                    reset_at: 1800604800
                }
            }
        });
        getServiceAdapter.mockReturnValue({ getUsageLimits });

        const response = {
            writeHead: jest.fn(),
            end: jest.fn()
        };
        const providerConfig = { uuid: 'codex-account-1', customName: 'Primary' };
        const providerPoolManager = {
            providerPools: { 'openai-codex-oauth': [providerConfig] }
        };

        await handleGetProviderQuota(
            {},
            response,
            {},
            providerPoolManager,
            'openai-codex-oauth',
            'codex-account-1'
        );

        expect(response.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
        const body = JSON.parse(response.end.mock.calls[0][0]);
        expect(body.quota).toEqual({
            available: true,
            planType: 'plus',
            windows: [
                { key: 'fiveHour', usedPercentage: 32, durationMinutes: 300, resetsAt: 1800003600 },
                { key: 'weekly', usedPercentage: 57, durationMinutes: 10080, resetsAt: 1800604800 }
            ]
        });
        expect(getUsageLimits).toHaveBeenCalledTimes(1);
        expect(getServiceAdapter).toHaveBeenCalledWith(expect.objectContaining({
            MODEL_PROVIDER: 'openai-codex-oauth',
            uuid: 'codex-account-1'
        }));
    });

    test('labels a free-plan 30-day window as monthly instead of five-hour', async () => {
        getServiceAdapter.mockReturnValue({
            getUsageLimits: jest.fn().mockResolvedValue({
                plan_type: 'free',
                rate_limit: {
                    primary_window: {
                        used_percent: 81,
                        limit_window_seconds: 2_592_000,
                        reset_at: null
                    }
                }
            })
        });
        const response = { writeHead: jest.fn(), end: jest.fn() };
        const providerPoolManager = {
            providerPools: { 'openai-codex-oauth': [{ uuid: 'free-codex' }] }
        };

        await handleGetProviderQuota(
            {}, response, {}, providerPoolManager, 'openai-codex-oauth', 'free-codex'
        );

        const body = JSON.parse(response.end.mock.calls[0][0]);
        expect(body.quota.windows).toEqual([
            { key: 'monthly', usedPercentage: 81, durationMinutes: 43_200, resetsAt: null }
        ]);
    });

    test('normalizes Antigravity model quota fractions to the highest account usage', async () => {
        const getUsageLimits = jest.fn().mockResolvedValue({
            tierId: 'Google AI Pro',
            models: {
                'gemini-3-pro': { quotaInfo: { remainingFraction: 0.6 } },
                'gemini-3-flash': { quotaInfo: { remainingFraction: 0.15 } },
                'model-without-quota': { quotaInfo: {} }
            }
        });
        getServiceAdapter.mockReturnValue({ getUsageLimits });
        const response = { writeHead: jest.fn(), end: jest.fn() };
        const providerPoolManager = {
            providerPools: { 'gemini-antigravity': [{ uuid: 'antigravity-account-1' }] }
        };

        await handleGetProviderQuota(
            {}, response, {}, providerPoolManager, 'gemini-antigravity', 'antigravity-account-1'
        );

        expect(response.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
        const body = JSON.parse(response.end.mock.calls[0][0]);
        expect(body.quota).toEqual({ available: true, usedPercentage: 85 });
        expect(getUsageLimits).toHaveBeenCalledTimes(1);
        expect(getServiceAdapter).toHaveBeenCalledWith(expect.objectContaining({
            MODEL_PROVIDER: 'gemini-antigravity',
            uuid: 'antigravity-account-1'
        }));
    });
});