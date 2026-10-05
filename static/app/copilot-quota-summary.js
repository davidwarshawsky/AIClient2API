export function createCopilotQuotaUsageLoader({ apiClient } = {}) {
    return async function loadCopilotQuotaUsage(providers = []) {
        const healthyProviders = providers.filter(provider => provider?.isHealthy && !provider.isDisabled);
        const accountUsage = await Promise.all(healthyProviders.map(async provider => {
            if (!provider.uuid) return null;

            try {
                const response = await apiClient.get(
                    `/providers/github-copilot/${encodeURIComponent(provider.uuid)}/quota`
                );
                const quota = response?.quota;
                if (!quota?.available || quota.isUnlimited || quota.usedPercentage == null) return null;

                const usedPercentage = Number(quota.usedPercentage);
                if (!Number.isFinite(usedPercentage)) return null;

                return Math.round(Math.min(100, Math.max(0, usedPercentage)));
            } catch {
                return null;
            }
        }));

        const totalPercent = healthyProviders.length * 100;
        if (accountUsage.some(percentage => percentage === null)) {
            return { available: false, usedPercent: null, totalPercent };
        }

        return {
            available: true,
            usedPercent: accountUsage.reduce((sum, percentage) => sum + percentage, 0),
            totalPercent
        };
    };
}