const authService = require('../services/authService');
const { emailLogger } = require('../utils/logger');

/**
 * Middleware de Autenticación
 * Verificación de sesiones y protección de rutas
 */

/**
 * Middleware para verificar autenticación
 * Requiere que el usuario esté autenticado
 */
const requireAuth = (req, res, next) => {
  if (!authService.isAuthenticated(req)) {
    emailLogger.session('anonymous', 'access_denied', {
      url: req.url,
      method: req.method
    });
    
    return res.status(401).json({
      success: false,
      error: 'No autorizado. Inicia sesión para continuar.',
      redirect: '/login.html'
    });
  }

  // Verificar si la sesión no ha expirado
  const user = authService.getCurrentUser(req);
  const sessionAge = Date.now() - new Date(user.authenticatedAt).getTime();
  const maxAge = require('../config/email').security.sessionTimeout;

  if (sessionAge > maxAge) {
    emailLogger.session(user.email, 'session_expired', {
      sessionAge: sessionAge,
      maxAge: maxAge
    });

    req.session.destroy(() => {
      return res.status(401).json({
        success: false,
        error: 'Sesión expirada. Inicia sesión nuevamente.',
        redirect: '/login.html'
      });
    });
    return;
  }

  next();
};

/**
 * Middleware para rutas que no requieren autenticación
 * Redirige a dashboard si ya está autenticado
 */
const redirectIfAuthenticated = (req, res, next) => {
  if (authService.isAuthenticated(req)) {
    emailLogger.session(authService.getCurrentUser(req).email, 'redirect_authenticated', {
      url: req.url
    });
    
    return res.redirect('/');
  }
  
  next();
};

/**
 * Middleware para validar datos de entrada de autenticación
 */
const validateAuthInput = (req, res, next) => {
  const { email, password } = req.body;

  // Validar email
  if (!email || !authService.isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      error: 'Email inválido'
    });
  }

  // Validar contraseña
  const passwordValidation = authService.validatePassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({
      success: false,
      error: passwordValidation.errors[0]
    });
  }

  next();
};

/**
 * Middleware para agregar información del usuario a las requests
 */
const addUserInfo = (req, res, next) => {
  if (authService.isAuthenticated(req)) {
    req.user = authService.getCurrentUser(req);
    
    // Agregar información adicional del usuario
    req.user.sessionAge = Date.now() - new Date(req.user.authenticatedAt).getTime();
    req.user.remainingTime = require('../config/email').security.sessionTimeout - req.user.sessionAge;
  }
  
  next();
};

/**
 * Middleware para logging de actividad del usuario
 */
const logUserActivity = (req, res, next) => {
  if (authService.isAuthenticated(req)) {
    const user = authService.getCurrentUser(req);
    
    emailLogger.session(user.email, 'activity', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
  
  next();
};

/**
 * Middleware para verificar permisos de email
 * Asegura que el usuario solo acceda a sus propios emails
 */
const validateEmailAccess = (req, res, next) => {
  if (!authService.isAuthenticated(req)) {
    return res.status(401).json({
      success: false,
      error: 'No autorizado'
    });
  }

  const user = authService.getCurrentUser(req);
  
  // Verificar que el usuario esté accediendo a su propio email
  if (req.body.to && req.body.to !== user.email) {
    emailLogger.session(user.email, 'unauthorized_email_access', {
      attemptedEmail: req.body.to
    });
    
    return res.status(403).json({
      success: false,
      error: 'No tienes permisos para acceder a este email'
    });
  }

  next();
};

/**
 * Middleware para validar formato de datos de email
 */
const validateEmailData = (req, res, next) => {
  const { to, cc, bcc, subject, text, html } = req.body;

  if (!to || !authService.isValidEmail(to)) {
    return res.status(400).json({
      success: false,
      error: 'Email de destino inválido'
    });
  }

  // Validar CC si se proporciona
  if (cc && !authService.isValidEmail(cc)) {
    return res.status(400).json({
      success: false,
      error: 'Email CC inválido'
    });
  }

  // Validar BCC si se proporciona
  if (bcc && !authService.isValidEmail(bcc)) {
    return res.status(400).json({
      success: false,
      error: 'Email BCC inválido'
    });
  }

  if (!subject || subject.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'El asunto es requerido'
    });
  }

  if ((!text || text.trim().length === 0) && (!html || html.trim().length === 0)) {
    return res.status(400).json({
      success: false,
      error: 'El contenido del email es requerido'
    });
  }

  next();
};

/**
 * Middleware para manejo de errores de autenticación
 */
const handleAuthError = (error, req, res, next) => {
  emailLogger.emailError('middleware', 'auth_error', error);
  
  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Token de autenticación inválido'
    });
  }
  
  if (error.message.includes('ECONNREFUSED')) {
    return res.status(503).json({
      success: false,
      error: 'Servidor de email no disponible. Intenta más tarde.'
    });
  }
  
  if (error.message.includes('timeout')) {
    return res.status(504).json({
      success: false,
      error: 'Tiempo de espera agotado. Intenta nuevamente.'
    });
  }
  
  next(error);
};

/**
 * Middleware para limpiar sesiones expiradas
 */
const cleanupExpiredSessions = (req, res, next) => {
  // Este middleware se puede usar para limpiar sesiones expiradas
  // En un entorno de producción, esto debería manejarse con un job scheduler
  const maxAge = require('../config/email').security.sessionTimeout;
  
  if (req.session && req.session.user) {
    const sessionAge = Date.now() - new Date(req.session.user.authenticatedAt).getTime();
    
    if (sessionAge > maxAge) {
      req.session.destroy();
      emailLogger.session(req.session.user.email, 'cleanup_expired_session');
    }
  }
  
  next();
};

module.exports = {
  requireAuth,
  redirectIfAuthenticated,
  validateAuthInput,
  addUserInfo,
  logUserActivity,
  validateEmailAccess,
  validateEmailData,
  handleAuthError,
  cleanupExpiredSessions
};
