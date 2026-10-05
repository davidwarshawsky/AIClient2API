const CODEX_QUOTA_CACHE_TTL_MS = 60_000;

export function createCodexQuotaBadgeLoader({ apiClient, translate, now = Date.now } = {}) {
    const cache = new Map();
    const requests = new Map();

    function renderBadge(badge, result) {
        if (!badge.isConnected) return;
        if (result.error) {
            badge.textContent = translate('providers.codexQuota.unavailable');
            badge.title = translate('providers.codexQuota.unavailable');
            return;
        }

        const quota = result.response?.quota;
        if (!quota?.available || !Array.isArray(quota.windows) || quota.windows.length === 0) {
            badge.textContent = translate('providers.codexQuota.unavailable');
            badge.title = quota?.message || translate('providers.codexQuota.unavailable');
            return;
        }

        badge.textContent = quota.windows.map(window => translate('providers.codexQuota.windowUsed', {
            window: translate(`providers.codexQuota.${window.key}`),
            percent: Math.round(window.usedPercentage)
        })).join(' · ');
        const details = quota.windows.map(window => {
            const reset = window.resetsAt
                ? new Date(window.resetsAt * 1000).toLocaleString()
                : translate('providers.codexQuota.unknownReset');
            return `${translate(`providers.codexQuota.${window.key}`)}: ${Math.round(window.usedPercentage)}% (${reset})`;
        }).join(' · ');
        badge.title = translate('providers.codexQuota.details', {
            plan: quota.planType || translate('providers.codexQuota.unknownPlan'),
            windows: details
        });
    }

    return function loadCodexQuotaBadges(container, {
        requestMissing = true,
        forceRefresh = false,
        providers = []
    } = {}) {
        if (!container?.querySelectorAll) return Promise.resolve();

        const badges = Array.from(container.querySelectorAll('.codex-quota-badge[data-provider-uuid]'));
        const providerUuids = new Set([
            ...badges.map(badge => badge.dataset.providerUuid),
            ...providers.map(provider => provider?.uuid).filter(Boolean)
        ]);
        const pending = [];

        providerUuids.forEach(providerUuid => {
            const accountBadges = badges.filter(badge => badge.dataset.providerUuid === providerUuid);
            const cached = cache.get(providerUuid);
            if (!forceRefresh && cached && (now() - cached.cachedAt < CODEX_QUOTA_CACHE_TTL_MS || !requestMissing)) {
                accountBadges.forEach(badge => renderBadge(badge, cached.result));
                return;
            }

            let request = requests.get(providerUuid);
            if (!request) {
                if (!requestMissing && !forceRefresh) {
                    accountBadges.forEach(badge => {
                        badge.textContent = translate('providers.codexQuota.unavailable');
                        badge.title = translate('providers.codexQuota.unavailable');
                    });
                    return;
                }
                request = apiClient.get(
                    `/providers/openai-codex-oauth/${encodeURIComponent(providerUuid)}/quota`
                )
                    .then(response => ({ response }))
                    .catch(() => ({ error: true }))
                    .then(result => {
                        cache.set(providerUuid, { cachedAt: now(), result });
                        return result;
                    })
                    .finally(() => requests.delete(providerUuid));
                requests.set(providerUuid, request);
            }

            accountBadges.forEach(badge => {
                badge.textContent = translate('providers.codexQuota.loading');
            });
            pending.push(request.then(result => {
                accountBadges.forEach(badge => renderBadge(badge, result));
            }));
        });

        return Promise.all(pending);
    };
}