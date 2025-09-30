const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Crear directorio de logs si no existe
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

/**
 * Configuración del sistema de logs con Winston
 * Logs detallados para debugging y monitoreo
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
      
      if (stack) {
        log += `\n${stack}`;
      }
      
      if (Object.keys(meta).length > 0) {
        log += `\n${JSON.stringify(meta, null, 2)}`;
      }
      
      return log;
    })
  ),
  defaultMeta: { service: 'email-admin' },
  transports: [
    // Archivo de logs de errores
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Archivo de logs generales
    new winston.transports.File({
      filename: path.join(logDir, 'email-admin.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  
  // Manejo de excepciones no capturadas
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log')
    })
  ],
  
  // Manejo de promesas rechazadas
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log')
    })
  ]
});

// En desarrollo, también mostrar logs en consola
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Logger especializado para operaciones de email
 */
const emailLogger = {
  // Log de conexión IMAP
  imapConnect: (user, success = true) => {
    logger.info('IMAP Connection', {
      user: user,
      success: success,
      action: 'connect'
    });
  },

  // Log de operaciones de email
  emailOperation: (user, operation, details = {}) => {
    logger.info('Email Operation', {
      user: user,
      operation: operation,
      ...details
    });
  },

  // Log de errores de email
  emailError: (user, operation, error) => {
    logger.error('Email Error', {
      user: user,
      operation: operation,
      error: error.message,
      stack: error.stack
    });
  },

  // Log de autenticación
  auth: (user, success = true, details = {}) => {
    logger.info('Authentication', {
      user: user,
      success: success,
      ...details
    });
  },

  // Log de sesiones
  session: (user, action, details = {}) => {
    logger.info('Session', {
      user: user,
      action: action,
      ...details
    });
  }
};

/**
 * Middleware para logging de requests HTTP
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  next();
};

module.exports = {
  logger,
  emailLogger,
  requestLogger
};
