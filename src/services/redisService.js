const redis = require('redis');

class RedisService {
    constructor() {
        this.publisher = null;
        this.subscriber = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            // Create publisher client
            this.publisher = redis.createClient({
                url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
                password: process.env.REDIS_PASSWORD || undefined,
            });

            // Create subscriber client (separate connection required for pub/sub)
            this.subscriber = redis.createClient({
                url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
                password: process.env.REDIS_PASSWORD || undefined,
            });

            // Error handlers
            this.publisher.on('error', (err) => {
                console.error('Redis Publisher Error:', err);
            });

            this.subscriber.on('error', (err) => {
                console.error('Redis Subscriber Error:', err);
            });

            // Connect both clients
            await this.publisher.connect();
            await this.subscriber.connect();

            this.isConnected = true;
            console.log('✅ Redis clients connected successfully');

        } catch (error) {
            console.error('❌ Failed to connect to Redis:', error);
            this.isConnected = false;
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.publisher) await this.publisher.quit();
            if (this.subscriber) await this.subscriber.quit();
            this.isConnected = false;
            console.log('Redis clients disconnected');
        } catch (error) {
            console.error('Error disconnecting Redis:', error);
        }
    }

    /**
     * Publish a message to a Redis channel
     * @param {string} channel - Channel name
     * @param {object} message - Message object (will be JSON stringified)
     */
    async publish(channel, message) {
        if (!this.isConnected) {
            throw new Error('Redis is not connected');
        }

        try {
            const messageStr = JSON.stringify(message);
            await this.publisher.publish(channel, messageStr);
            console.log(`📤 Published to ${channel}:`, message);
        } catch (error) {
            console.error('Error publishing message:', error);
            throw error;
        }
    }

    /**
     * Subscribe to a Redis channel and handle incoming messages
     * @param {string} channel - Channel name
     * @param {function} callback - Callback function to handle messages
     */
    async subscribe(channel, callback) {
        if (!this.isConnected) {
            throw new Error('Redis is not connected');
        }

        try {
            await this.subscriber.subscribe(channel, (message) => {
                try {
                    const parsedMessage = JSON.parse(message);
                    console.log(`📥 Received from ${channel}:`, parsedMessage);
                    callback(parsedMessage);
                } catch (error) {
                    console.error('Error parsing message:', error);
                    callback({ error: 'Invalid message format' });
                }
            });

            console.log(`👂 Subscribed to channel: ${channel}`);
        } catch (error) {
            console.error('Error subscribing to channel:', error);
            throw error;
        }
    }

    /**
     * Unsubscribe from a Redis channel
     * @param {string} channel - Channel name
     */
    async unsubscribe(channel) {
        if (!this.isConnected) {
            return;
        }

        try {
            await this.subscriber.unsubscribe(channel);
            console.log(`🔇 Unsubscribed from channel: ${channel}`);
        } catch (error) {
            console.error('Error unsubscribing from channel:', error);
        }
    }

    /**
     * Check if Redis is connected
     */
    checkConnection() {
        return this.isConnected;
    }
}

// Export singleton instance
const redisService = new RedisService();
module.exports = redisService;
