require('dotenv').config();

/**
 * Configuración de Email para Hostinger
 * Basada en la estructura confirmada de carpetas y servidores
 */
const emailConfig = {
  // Configuración IMAP para Hostinger
  imap: {
    host: process.env.IMAP_HOST || 'imap.hostinger.com',
    port: parseInt(process.env.IMAP_PORT) || 993,
    secure: process.env.IMAP_SECURE === 'true' || true,
    tls: {
      rejectUnauthorized: false
    },
    authTimeout: 30000,
    connTimeout: 30000,
    keepalive: true
  },

  // Configuración SMTP para Hostinger
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true' || false,
    requireTLS: true,
    tls: {
      rejectUnauthorized: false
    },
    authTimeout: 30000,
    connTimeout: 30000,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 20000,
    rateLimit: 5
  },

  // Estructura de carpetas confirmada para Hostinger
  folders: {
    INBOX: 'INBOX',
    SENT: 'INBOX.Sent',
    DRAFTS: 'INBOX.Drafts',
    TRASH: 'INBOX.Trash',
    JUNK: 'INBOX.Junk'
  },

  // Delimitador de carpetas para Hostinger
  delimiter: '.',

  // Configuración de conexión
  connection: {
    // Pool de conexiones por usuario
    maxConnections: 5,
    // Tiempo de vida de conexiones inactivas (ms)
    connectionTimeout: 300000,
    // Reintentos de conexión
    retries: 3,
    retryDelay: 1000
  },

  // Configuración de emails
  email: {
    // Número máximo de emails por carpeta
    maxEmailsPerFolder: 100,
    // Tamaño máximo de email (bytes)
    maxEmailSize: 10 * 1024 * 1024, // 10MB
    // Tiempo de cache para emails (ms)
    emailCacheTimeout: 300000 // 5 minutos
  },

  // Configuración de seguridad
  security: {
    // Tiempo máximo de sesión (ms)
    sessionTimeout: parseInt(process.env.SESSION_MAX_AGE) || 3600000, // 1 hora
    // Rate limiting
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutos
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
    }
  }
};

module.exports = emailConfig;
