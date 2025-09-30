require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Importar servicios y configuraciones
const emailConfig = require('./src/config/email');
const { logger, requestLogger } = require('./src/utils/logger');
const authService = require('./src/services/authService');
const emailService = require('./src/services/emailService');

// Importar rutas
const authRoutes = require('./src/routes/auth');
const emailRoutes = require('./src/routes/emails');
const profileRoutes = require('./src/routes/profile');

// Importar middleware
const { cleanupExpiredSessions, handleAuthError } = require('./src/middleware/auth');

/**
 * Servidor Principal - Email Admin MVP
 * Administrador de correos empresarial multi-usuario para Hostinger
 */
class EmailAdminServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Configurar middleware de Express
   */
  setupMiddleware() {
    // Seguridad básica
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          scriptSrcAttr: ["'unsafe-inline'"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: ["'self'", "blob:"],
        },
      },
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' ? false : true,
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: emailConfig.security.rateLimit.windowMs,
      max: emailConfig.security.rateLimit.maxRequests,
      message: {
        success: false,
        error: 'Demasiadas solicitudes. Intenta más tarde.'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api', limiter);

    // Parsing de datos
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Configuración de sesiones
    this.app.use(session({
      secret: process.env.SESSION_SECRET || 'email-admin-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        sameSite: 'strict'
      },
      name: 'email-admin-session'
    }));

    // Logging de requests
    this.app.use(requestLogger);

    // Limpiar sesiones expiradas
    this.app.use(cleanupExpiredSessions);

    // Servir archivos estáticos
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  /**
   * Configurar rutas
   */
  setupRoutes() {
    // API Routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/emails', emailRoutes);
    this.app.use('/api/profile', profileRoutes);

    // Ruta principal - Dashboard
    this.app.get('/', (req, res) => {
      if (authService.isAuthenticated(req)) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
      } else {
        res.redirect('/login.html');
      }
    });

    // Ruta de login
    this.app.get('/login.html', (req, res) => {
      if (authService.isAuthenticated(req)) {
        res.redirect('/');
      } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
      }
    });

    // Ruta de logout (redirect)
    this.app.get('/logout', (req, res) => {
      req.session.destroy(() => {
        res.redirect('/login.html');
      });
    });

    // API Health Check
    this.app.get('/api/health', (req, res) => {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: require('./package.json').version
      });
    });

    // 404 para rutas no encontradas
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Ruta no encontrada'
      });
    });
  }

  /**
   * Configurar manejo de errores
   */
  setupErrorHandling() {
    // Manejo de errores de autenticación
    this.app.use('/api', handleAuthError);

    // Manejo general de errores
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled Error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
          ? 'Error interno del servidor' 
          : error.message
      });
    });

    // Manejo de errores no capturados
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
      });
      
      this.gracefulShutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', {
        reason: reason,
        promise: promise
      });
    });
  }

  /**
   * Iniciar servidor
   */
  async start() {
    try {
      this.server = this.app.listen(this.port, () => {
        logger.info('Email Admin MVP Server Started', {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          pid: process.pid
        });

        console.log(`🚀 Email Admin MVP Server running on port ${this.port}`);
        console.log(`📧 Configurado para Hostinger: ${emailConfig.imap.host}:${emailConfig.imap.port}`);
        console.log(`📁 Carpetas soportadas: ${Object.values(emailConfig.folders).join(', ')}`);
        console.log(`🔐 Autenticación: IMAP directo contra Hostinger`);
        console.log(`🌐 Accede a: http://localhost:${this.port}`);
      });

      // Configurar shutdown graceful
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start server', {
        error: error.message,
        stack: error.stack
      });
      
      process.exit(1);
    }
  }

  /**
   * Configurar shutdown graceful
   */
  setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        logger.info(`Received ${signal}, shutting down gracefully`);
        this.gracefulShutdown();
      });
    });
  }

  /**
   * Shutdown graceful del servidor
   */
  async gracefulShutdown() {
    logger.info('Starting graceful shutdown...');

    try {
      // Cerrar servidor HTTP
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(() => {
            logger.info('HTTP server closed');
            resolve();
          });
        });
      }

      // Limpiar conexiones de email
      await authService.clearAllConnections();
      await emailService.clearAllTransports();

      logger.info('Graceful shutdown completed');
      process.exit(0);

    } catch (error) {
      logger.error('Error during graceful shutdown', {
        error: error.message,
        stack: error.stack
      });
      
      process.exit(1);
    }
  }
}

// Crear e iniciar servidor
const server = new EmailAdminServer();

// Manejar errores de inicio
server.start().catch(error => {
  logger.error('Failed to start Email Admin MVP', {
    error: error.message,
    stack: error.stack
  });
  
  process.exit(1);
});

module.exports = server;
