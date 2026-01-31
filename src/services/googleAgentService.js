const { GoogleGenerativeAI } = require('@google/generative-ai');

class GoogleAgentService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.model = null;
        this.isEnabled = process.env.AI_FALLBACK_ENABLED === 'true';
        this.responseTimeout = parseInt(process.env.AI_RESPONSE_TIMEOUT) || 10000;
        
        // Rate limiting
        this.rateLimitPerMinute = parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE) || 30;
        this.requestHistory = [];
        
        this.initializeClient();
    }

    async initializeClient() {
        try {
            if (!this.isEnabled) {
                console.log('🤖 AI Fallback is disabled');
                return;
            }

            if (!this.apiKey) {
                console.warn('⚠️ Gemini API key missing. AI fallback disabled.');
                console.warn('💡 Get your API key from: https://makersuite.google.com/app/apikey');
                this.isEnabled = false;
                return;
            }

            // Initialize Gemini
            const genAI = new GoogleGenerativeAI(this.apiKey);
            this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            console.log('✅ Gemini API Service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Gemini API Service:', error.message);
            this.isEnabled = false;
        }
    }

    isRateLimited() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        // Clean old requests
        this.requestHistory = this.requestHistory.filter(timestamp => timestamp > oneMinuteAgo);
        
        return this.requestHistory.length >= this.rateLimitPerMinute;
    }

    addToRateLimit() {
        this.requestHistory.push(Date.now());
    }

    // Clean markdown formatting for better chat display
    cleanMarkdownForChat(text) {
        return text
            // Remove bold formatting **text** -> text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            // Remove italic formatting *text* -> text  
            .replace(/\*(.*?)\*/g, '$1')
            // Convert bullet points * item -> • item
            .replace(/^\s*\*\s+/gm, '• ')
            // Clean up excessive line breaks
            .replace(/\n{3,}/g, '\n\n')
            // Trim whitespace
            .trim();
    }

    async queryAgent(userMessage, sessionId = null, userId = null) {
        try {
            // Check if service is enabled
            if (!this.isEnabled || !this.model) {
                return {
                    content: "I'm sorry, I don't have an answer for that.",
                    source: 'fallback',
                    confidence: 0
                };
            }

            // Check rate limiting
            if (this.isRateLimited()) {
                console.warn('⚠️ Rate limit exceeded for Gemini API');
                return {
                    content: "I'm experiencing high traffic. Please try again in a moment.",
                    source: 'rate_limited',
                    confidence: 0
                };
            }

            this.addToRateLimit();

            console.log('🤖 Querying Gemini for:', userMessage.substring(0, 50) + '...');

            // Create a helpful prompt for the assistant
            const prompt = `You are a helpful GCET (Geethanjali College of Engineering and Technology) assistant. 
Answer this question concisely and helpfully: ${userMessage}`;

            // Set timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Gemini response timeout')), this.responseTimeout);
            });

            // Make the request with timeout
            const result = await Promise.race([
                this.model.generateContent(prompt),
                timeoutPromise
            ]);

            const response = await result.response;
            const responseText = response.text();

            if (!responseText || responseText.trim().length === 0) {
                throw new Error('Empty response from Gemini');
            }

            // Clean markdown formatting for chat display
            const cleanedText = this.cleanMarkdownForChat(responseText.trim());

            console.log('✅ Gemini responded successfully');

            return {
                content: cleanedText,
                source: 'ai',
                confidence: 0.8, // Gemini doesn't provide confidence scores, so we use a default
                model: 'gemini-2.5-flash'
            };

        } catch (error) {
            console.error('❌ Gemini API Service Error:', error.message);
            
            // Return graceful fallback
            return {
                content: "I'm having trouble accessing my knowledge base right now. Please try again later.",
                source: 'error',
                confidence: 0,
                error: error.message
            };
        }
    }

    // Health check method
    async healthCheck() {
        if (!this.isEnabled) {
            return { status: 'disabled', message: 'AI service is disabled' };
        }

        if (!this.model) {
            return { status: 'error', message: 'Gemini model not initialized' };
        }

        try {
            // Simple test query
            const testResponse = await this.queryAgent('Hello', 'health-check');
            return { 
                status: 'healthy', 
                message: 'Gemini API service is operational',
                lastResponse: testResponse.source,
                model: 'gemini-2.5-flash'
            };
        } catch (error) {
            return { 
                status: 'error', 
                message: `Health check failed: ${error.message}` 
            };
        }
    }

    // Get service statistics
    getStats() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const recentRequests = this.requestHistory.filter(timestamp => timestamp > oneMinuteAgo).length;

        return {
            service: 'Gemini API',
            isEnabled: this.isEnabled,
            hasModel: !!this.model,
            requestsInLastMinute: recentRequests,
            rateLimitPerMinute: this.rateLimitPerMinute,
            isRateLimited: this.isRateLimited(),
            model: 'gemini-2.5-flash'
        };
    }
}

module.exports = new GoogleAgentService();