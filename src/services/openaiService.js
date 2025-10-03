const logger = require('../utils/logger');

class OpenAIService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
        this.baseURL = 'https://api.openai.com/v1/chat/completions';
    }

    /**
     * Generar respuesta de email con OpenAI
     */
    async generateEmailResponse(email, style = 'formal') {
        try {
            if (!this.apiKey) {
                throw new Error('OpenAI API key no configurada');
            }

            const prompt = this.buildPrompt(email, style);
            
            const response = await fetch(this.baseURL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'Eres un asistente de email profesional. Genera respuestas apropiadas y contextuales.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const aiResponse = data.choices[0]?.message?.content;

            if (!aiResponse) {
                throw new Error('No se pudo generar respuesta de IA');
            }

            logger.info('OpenAI response generated', {
                email: email.from,
                style: style,
                tokens: data.usage?.total_tokens
            });

            return {
                success: true,
                response: aiResponse.trim(),
                tokens: data.usage?.total_tokens
            };

        } catch (error) {
            logger.error('OpenAI API error', error);
            throw error;
        }
    }

    /**
     * Construir prompt para OpenAI
     */
    buildPrompt(email, style) {
        const fromName = this.extractName(email.from);
        const subject = email.subject || 'Sin asunto';
        const date = new Date(email.date).toLocaleDateString('es-ES');
        
        const styleInstructions = {
            formal: 'Escribe una respuesta formal y profesional, usando "Estimado/a" y "Saludos cordiales".',
            casual: 'Escribe una respuesta casual y amigable, usando "Hola" y "¡Saludos!".',
            brief: 'Escribe una respuesta breve y directa, de máximo 2-3 líneas.'
        };

        return `
Contexto del email:
- De: ${fromName}
- Asunto: ${subject}
- Fecha: ${date}

Instrucciones: ${styleInstructions[style] || styleInstructions.formal}

Genera una respuesta apropiada para este email. La respuesta debe ser profesional pero adaptada al estilo solicitado.
        `.trim();
    }

    /**
     * Extraer nombre del remitente
     */
    extractName(fromString) {
        if (!fromString) return 'Usuario';
        
        // Si contiene < y >, extraer el nombre
        const match = fromString.match(/^(.+?)\s*<(.+?)>$/);
        if (match) {
            return match[1].trim().replace(/['"]/g, '');
        }
        
        // Si es solo un email, extraer la parte antes del @
        if (fromString.includes('@')) {
            return fromString.split('@')[0];
        }
        
        return fromString;
    }

    /**
     * Verificar si OpenAI está configurado
     */
    isConfigured() {
        return !!this.apiKey;
    }
}

module.exports = new OpenAIService();


