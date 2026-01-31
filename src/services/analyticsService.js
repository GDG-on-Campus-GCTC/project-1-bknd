class AnalyticsService {
    constructor() {
        // In-memory analytics (resets on server restart)
        this.stats = {
            totalMessages: 0,
            csvResponses: 0,
            aiResponses: 0,
            errorResponses: 0,
            rateLimitedResponses: 0,
            averageResponseTime: 0,
            lastHour: [],
            responseTypes: {}
        };
    }

    recordResponse(source, responseTime = 0, metadata = {}) {
        const now = Date.now();
        
        // Update counters
        this.stats.totalMessages++;
        
        switch (source) {
            case 'csv':
                this.stats.csvResponses++;
                break;
            case 'ai':
                this.stats.aiResponses++;
                break;
            case 'error':
                this.stats.errorResponses++;
                break;
            case 'rate_limited':
                this.stats.rateLimitedResponses++;
                break;
        }

        // Track response times (moving average)
        if (responseTime > 0) {
            const currentAvg = this.stats.averageResponseTime;
            const totalResponses = this.stats.totalMessages;
            this.stats.averageResponseTime = ((currentAvg * (totalResponses - 1)) + responseTime) / totalResponses;
        }

        // Track hourly data (keep last hour only)
        this.stats.lastHour.push({ 
            timestamp: now, 
            source,
            responseTime,
            metadata: metadata.confidence ? { confidence: metadata.confidence } : {}
        });
        
        // Clean old entries (older than 1 hour)
        const oneHourAgo = now - (60 * 60 * 1000);
        this.stats.lastHour = this.stats.lastHour.filter(entry => entry.timestamp > oneHourAgo);

        console.log(`📊 Analytics: ${source} response recorded (${this.stats.totalMessages} total)`);
    }

    getStats() {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        const lastHourEntries = this.stats.lastHour.filter(entry => entry.timestamp > oneHourAgo);
        
        return {
            ...this.stats,
            lastHourCount: lastHourEntries.length,
            lastHourBreakdown: {
                csv: lastHourEntries.filter(e => e.source === 'csv').length,
                ai: lastHourEntries.filter(e => e.source === 'ai').length,
                error: lastHourEntries.filter(e => e.source === 'error').length
            },
            percentages: {
                csvPercent: Math.round((this.stats.csvResponses / this.stats.totalMessages) * 100) || 0,
                aiPercent: Math.round((this.stats.aiResponses / this.stats.totalMessages) * 100) || 0,
                errorPercent: Math.round((this.stats.errorResponses / this.stats.totalMessages) * 100) || 0
            }
        };
    }

    reset() {
        this.stats = {
            totalMessages: 0,
            csvResponses: 0,
            aiResponses: 0,
            errorResponses: 0,
            rateLimitedResponses: 0,
            averageResponseTime: 0,
            lastHour: [],
            responseTypes: {}
        };
        console.log('📊 Analytics reset');
    }

    // Get simple summary for logging
    getSummary() {
        return `📊 Total: ${this.stats.totalMessages} | CSV: ${this.stats.csvResponses} | AI: ${this.stats.aiResponses} | Errors: ${this.stats.errorResponses}`;
    }
}

module.exports = new AnalyticsService();