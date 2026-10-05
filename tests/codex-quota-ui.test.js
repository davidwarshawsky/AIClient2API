import { createCodexQuotaBadgeLoader } from '../static/app/codex-quota-badges.js';

describe('Codex provider quota badges', () => {
    const translations = {
        'providers.codexQuota.fiveHour': '5h',
        'providers.codexQuota.weekly': 'weekly',
        'providers.codexQuota.monthly': 'monthly',
        'providers.codexQuota.unknownReset': 'reset unknown',
        'providers.codexQuota.unknownPlan': 'Unknown plan',
        'providers.codexQuota.unavailable': 'Codex quota unavailable'
    };

    const translate = (key, params = {}) => {
        if (key === 'providers.codexQuota.windowUsed') {
            return `${params.window} ${params.percent}% used`;
        }
        if (key === 'providers.codexQuota.details') {
            return `${params.plan} plan · ${params.windows}`;
        }
        return translations[key] || key;
    };

    const createBadge = uuid => ({
        dataset: { providerUuid: uuid },
        isConnected: true,
        textContent: 'Loading Codex quota...',
        title: ''
    });

    const createContainer = badges => ({
        querySelectorAll: () => badges
    });

    test('fetches every configured account on open and renders visible account percentages', async () => {
        let now = 1_800_000_000_000;
        const providers = Array.from({ length: 8 }, (_, index) => ({ uuid: `codex-${index + 1}` }));
        const visibleBadges = providers.slice(0, 5).map(provider => createBadge(provider.uuid));
        const apiClient = {
            get: jest.fn(async url => {
                const uuid = decodeURIComponent(url.split('/').at(-2));
                return {
                    quota: {
                        available: true,
                        planType: 'plus',
                        windows: [
                            { key: 'fiveHour', usedPercentage: 32, resetsAt: 1_800_003_600 },
                            { key: 'weekly', usedPercentage: 57, resetsAt: 1_800_604_800 }
                        ],
                        account: uuid
                    }
                };
            })
        };
        const loadBadges = createCodexQuotaBadgeLoader({ apiClient, translate, now: () => now });

        await loadBadges(createContainer(visibleBadges), { forceRefresh: true, providers });

        expect(apiClient.get).toHaveBeenCalledTimes(providers.length);
        expect(apiClient.get.mock.calls.map(([url]) => url)).toEqual(providers.map(({ uuid }) =>
            `/providers/openai-codex-oauth/${uuid}/quota`
        ));
        expect(visibleBadges[0].textContent).toBe('5h 32% used · weekly 57% used');
        expect(visibleBadges[0].title).toContain('plus plan');
        expect(visibleBadges[0].title).toContain('weekly: 57%');

        now += 120_000;
        const laterPageBadges = providers.slice(5).map(provider => createBadge(provider.uuid));
        await loadBadges(createContainer(laterPageBadges), { requestMissing: false, providers });

        expect(apiClient.get).toHaveBeenCalledTimes(providers.length);
        expect(laterPageBadges[0].textContent).toBe('5h 32% used · weekly 57% used');
    });

    test('refreshes every account when the provider modal is opened again', async () => {
        const providers = [{ uuid: 'codex-a' }, { uuid: 'codex-b' }];
        const apiClient = {
            get: jest.fn().mockResolvedValue({
                quota: {
                    available: true,
                    planType: 'free',
                    windows: [{ key: 'monthly', usedPercentage: 81, resetsAt: null }]
                }
            })
        };
        const loadBadges = createCodexQuotaBadgeLoader({ apiClient, translate });
        const container = createContainer(providers.map(provider => createBadge(provider.uuid)));

        await loadBadges(container, { forceRefresh: true, providers });
        await loadBadges(container, { forceRefresh: true, providers });

        expect(apiClient.get).toHaveBeenCalledTimes(providers.length * 2);
    });
});