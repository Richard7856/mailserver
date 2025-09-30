const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { emailLogger } = require('../utils/logger');
const {
  requireAuth,
  redirectIfAuthenticated,
  validateAuthInput,
  addUserInfo,
  logUserActivity
} = require('../middleware/auth');

/**
 * Rutas de Autenticación
 * Login, logout y gestión de perfil de usuario
 */

/**
 * POST /api/auth/login
 * Iniciar sesión con credenciales de Hostinger
 */
router.post('/login', redirectIfAuthenticated, validateAuthInput, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    emailLogger.auth(email, false, { action: 'login_attempt' });

    // Autenticar contra servidor IMAP de Hostinger
    const authResult = await authService.authenticateUser(email, password);
    
    if (authResult.success) {
      // Crear sesión de usuario
      authService.createUserSession(req, authResult.user);
      
      emailLogger.auth(email, true, { 
        action: 'login_success',
        sessionId: req.sessionID 
      });
      
      res.json({
        success: true,
        message: 'Inicio de sesión exitoso',
        user: {
          email: authResult.user.email,
          authenticatedAt: authResult.user.authenticatedAt
        }
      });
    } else {
      emailLogger.auth(email, false, { 
        action: 'login_failed',
        error: authResult.error 
      });
      
      res.status(401).json({
        success: false,
        error: authResult.error
      });
    }

  } catch (error) {
    emailLogger.emailError(req.body.email || 'unknown', 'login_error', error);
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/auth/logout
 * Cerrar sesión del usuario
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const user = authService.getCurrentUser(req);
    
    // Cerrar sesión y limpiar conexiones
    await authService.logoutUser(req);
    
    emailLogger.auth(user.email, true, { action: 'logout' });
    
    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });

  } catch (error) {
    emailLogger.emailError('logout', 'logout_error', error);
    
    res.status(500).json({
      success: false,
      error: 'Error al cerrar sesión'
    });
  }
});

/**
 * GET /api/auth/profile
 * Obtener información del usuario actual
 */
router.get('/profile', requireAuth, addUserInfo, logUserActivity, (req, res) => {
  try {
    const user = authService.getCurrentUser(req);
    
    res.json({
      success: true,
      user: {
        email: user.email,
        authenticatedAt: user.authenticatedAt,
        sessionId: user.sessionId,
        sessionAge: req.user.sessionAge,
        remainingTime: req.user.remainingTime
      }
    });

  } catch (error) {
    emailLogger.emailError('profile', 'get_profile_error', error);
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener perfil'
    });
  }
});

/**
 * GET /api/auth/status
 * Verificar estado de autenticación
 */
router.get('/status', addUserInfo, (req, res) => {
  const isAuthenticated = authService.isAuthenticated(req);
  
  if (isAuthenticated) {
    const user = authService.getCurrentUser(req);
    
    res.json({
      success: true,
      authenticated: true,
      user: {
        email: user.email,
        authenticatedAt: user.authenticatedAt
      }
    });
  } else {
    res.json({
      success: true,
      authenticated: false,
      message: 'Usuario no autenticado'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refrescar sesión del usuario (extender tiempo de vida)
 */
router.post('/refresh', requireAuth, addUserInfo, async (req, res) => {
  try {
    const user = authService.getCurrentUser(req);
    
    // Actualizar tiempo de autenticación
    req.session.user.authenticatedAt = new Date().toISOString();
    
    emailLogger.auth(user.email, true, { action: 'session_refresh' });
    
    res.json({
      success: true,
      message: 'Sesión refrescada exitosamente',
      user: {
        email: user.email,
        authenticatedAt: req.session.user.authenticatedAt
      }
    });

  } catch (error) {
    emailLogger.emailError('refresh', 'refresh_error', error);
    
    res.status(500).json({
      success: false,
      error: 'Error al refrescar sesión'
    });
  }
});

/**
 * GET /api/auth/validate
 * Validar credenciales sin crear sesión (para verificación previa)
 */
router.post('/validate', validateAuthInput, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validar credenciales sin crear sesión
    const authResult = await authService.authenticateUser(email, password);
    
    if (authResult.success) {
      res.json({
        success: true,
        valid: true,
        message: 'Credenciales válidas'
      });
    } else {
      res.json({
        success: true,
        valid: false,
        error: authResult.error
      });
    }

  } catch (error) {
    emailLogger.emailError(req.body.email || 'unknown', 'validate_error', error);
    
    res.status(500).json({
      success: false,
      error: 'Error al validar credenciales'
    });
  }
});

/**
 * Manejo de errores específicos de autenticación
 */
router.use((error, req, res, next) => {
  if (error.message.includes('ECONNREFUSED')) {
    return res.status(503).json({
      success: false,
      error: 'Servidor de email no disponible. Verifica tu conexión.'
    });
  }
  
  if (error.message.includes('timeout')) {
    return res.status(504).json({
      success: false,
      error: 'Tiempo de espera agotado. Intenta nuevamente.'
    });
  }
  
  next(error);
});

module.exports = router;
