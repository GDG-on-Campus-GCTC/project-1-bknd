class ConfigService {
    constructor() {
        this.config = {
            ai: {
                enabled: process.env.AI_FALLBACK_ENABLED === 'true',
                timeout: parseInt(process.env.AI_RESPONSE_TIMEOUT) || 10000,
                rateLimitPerMinute: parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE) || 30,
                minConfidenceThreshold: parseFloat(process.env.AI_MIN_CONFIDENCE) || 0.3
            },
            csv: {
                enabled: true,
                exactMatchPriority: true,
                partialMatchEnabled: true
            },
            response: {
                includeSource: true,
                includeConfidence: false, // Don't expose confidence to users by default
                maxResponseLength: 2000
            }
        };
    }

    get(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.config);
    }

    isAIEnabled() {
        return this.get('ai.enabled');
    }

    getAITimeout() {
        return this.get('ai.timeout');
    }

    shouldIncludeSource() {
        return this.get('response.includeSource');
    }

    getMaxResponseLength() {
        return this.get('response.maxResponseLength');
    }

    // Method to update config at runtime (useful for admin panel)
    update(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => obj[key], this.config);
        
        if (target) {
            target[lastKey] = value;
            console.log(`📝 Config updated: ${path} = ${value}`);
        }
    }

    // Get current configuration for debugging
    getAll() {
        return { ...this.config };
    }
}

module.exports = new ConfigService();