const imap = require('imap-simple');
const emailConfig = require('../config/email');
const { emailLogger } = require('../utils/logger');

/**
 * Servicio de Autenticación
 * Verificación directa contra servidor IMAP de Hostinger
 */
class AuthService {
  constructor() {
    // Pool de conexiones por usuario
    this.userConnections = new Map();
    this.connectionTimeouts = new Map();
  }

  /**
   * Autenticar usuario contra servidor IMAP de Hostinger
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña del usuario
   * @returns {Promise<Object>} - Resultado de autenticación
   */
  async authenticateUser(email, password) {
    try {
      emailLogger.auth(email, false, { action: 'attempt' });

      // Configuración IMAP específica para este usuario
      const imapConfig = {
        ...emailConfig.imap,
        user: email,
        password: password
      };

      // Intentar conexión IMAP para verificar credenciales
      const connection = await imap.connect({ imap: imapConfig });
      
      // Si la conexión es exitosa, las credenciales son válidas
      await connection.end();
      
      emailLogger.auth(email, true, { action: 'success' });
      
      return {
        success: true,
        user: {
          email: email,
          authenticatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      emailLogger.auth(email, false, { 
        action: 'failed',
        error: error.message 
      });
      
      return {
        success: false,
        error: this.getAuthErrorMessage(error)
      };
    }
  }

  /**
   * Crear sesión de usuario autenticado
   * @param {Object} req - Request object
   * @param {Object} user - Datos del usuario
   */
  createUserSession(req, user) {
    req.session.user = {
      email: user.email,
      authenticatedAt: user.authenticatedAt,
      sessionId: req.sessionID
    };

    emailLogger.session(user.email, 'created', {
      sessionId: req.sessionID
    });
  }

  /**
   * Verificar si el usuario está autenticado
   * @param {Object} req - Request object
   * @returns {boolean} - True si está autenticado
   */
  isAuthenticated(req) {
    return req.session && req.session.user && req.session.user.email;
  }

  /**
   * Obtener usuario actual de la sesión
   * @param {Object} req - Request object
   * @returns {Object|null} - Usuario actual o null
   */
  getCurrentUser(req) {
    if (this.isAuthenticated(req)) {
      return req.session.user;
    }
    return null;
  }

  /**
   * Cerrar sesión del usuario
   * @param {Object} req - Request object
   */
  async logoutUser(req) {
    if (this.isAuthenticated(req)) {
      const user = this.getCurrentUser(req);
      
      // Limpiar conexiones del usuario
      await this.clearUserConnections(user.email);
      
      // Destruir sesión
      req.session.destroy((err) => {
        if (err) {
          emailLogger.session(user.email, 'destroy_error', { error: err.message });
        } else {
          emailLogger.session(user.email, 'destroyed');
        }
      });
    }
  }

  /**
   * Obtener conexión IMAP para usuario autenticado
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña del usuario
   * @returns {Promise<Object>} - Conexión IMAP
   */
  async getUserConnection(email, password) {
    // Verificar si ya existe una conexión activa
    if (this.userConnections.has(email)) {
      return this.userConnections.get(email);
    }

    try {
      const imapConfig = {
        ...emailConfig.imap,
        user: email,
        password: password
      };

      const connection = await imap.connect({ imap: imapConfig });
      
      // Guardar conexión en el pool
      this.userConnections.set(email, connection);
      
      // Configurar timeout para limpiar conexión inactiva
      this.setConnectionTimeout(email);
      
      emailLogger.imapConnect(email, true);
      
      return connection;

    } catch (error) {
      emailLogger.imapConnect(email, false);
      throw error;
    }
  }

  /**
   * Configurar timeout para conexión IMAP
   * @param {string} email - Email del usuario
   */
  setConnectionTimeout(email) {
    // Limpiar timeout anterior si existe
    if (this.connectionTimeouts.has(email)) {
      clearTimeout(this.connectionTimeouts.get(email));
    }

    // Configurar nuevo timeout
    const timeout = setTimeout(() => {
      this.clearUserConnections(email);
    }, emailConfig.connection.connectionTimeout);

    this.connectionTimeouts.set(email, timeout);
  }

  /**
   * Limpiar conexiones del usuario
   * @param {string} email - Email del usuario
   */
  async clearUserConnections(email) {
    try {
      // Cerrar conexión IMAP si existe
      if (this.userConnections.has(email)) {
        const connection = this.userConnections.get(email);
        await connection.end();
        this.userConnections.delete(email);
      }

      // Limpiar timeout
      if (this.connectionTimeouts.has(email)) {
        clearTimeout(this.connectionTimeouts.get(email));
        this.connectionTimeouts.delete(email);
      }

      emailLogger.imapConnect(email, false, { action: 'closed' });

    } catch (error) {
      emailLogger.emailError(email, 'clear_connections', error);
    }
  }

  /**
   * Limpiar todas las conexiones (para shutdown graceful)
   */
  async clearAllConnections() {
    const promises = Array.from(this.userConnections.keys()).map(email => 
      this.clearUserConnections(email)
    );
    
    await Promise.all(promises);
  }

  /**
   * Obtener mensaje de error amigable para autenticación
   * @param {Error} error - Error de autenticación
   * @returns {string} - Mensaje de error
   */
  getAuthErrorMessage(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('invalid credentials') || message.includes('authentication failed')) {
      return 'Credenciales inválidas. Verifica tu email y contraseña.';
    }
    
    if (message.includes('connection') || message.includes('timeout')) {
      return 'Error de conexión. Verifica tu conexión a internet.';
    }
    
    if (message.includes('certificate') || message.includes('ssl')) {
      return 'Error de certificado SSL. Contacta al administrador.';
    }
    
    return 'Error de autenticación. Intenta nuevamente.';
  }

  /**
   * Validar formato de email
   * @param {string} email - Email a validar
   * @returns {boolean} - True si es válido
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validar fortaleza de contraseña
   * @param {string} password - Contraseña a validar
   * @returns {Object} - Resultado de validación
   */
  validatePassword(password) {
    const result = {
      valid: true,
      errors: []
    };

    if (!password || password.length < 6) {
      result.valid = false;
      result.errors.push('La contraseña debe tener al menos 6 caracteres');
    }

    return result;
  }
}

module.exports = new AuthService();
