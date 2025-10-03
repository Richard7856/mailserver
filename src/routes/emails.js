const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const openaiService = require('../services/openaiService');
const emailConfig = require('../config/email');
const { emailLogger, logger } = require('../utils/logger');
const {
  requireAuth,
  addUserInfo,
  logUserActivity,
  validateEmailAccess,
  validateEmailData
} = require('../middleware/auth');

/**
 * Rutas de Email
 * CRUD completo de operaciones de email
 * 
 * IMPORTANTE: Las rutas específicas DEBEN ir antes de las rutas con parámetros
 * para evitar que Express las confunda
 */

/**
 * POST /api/emails/send
 * Enviar nuevo email
 */
router.post('/send', validateEmailData, async (req, res) => {
  try {
    const { to, cc, bcc, subject, text, html, attachments, email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Credenciales requeridas para enviar emails'
      });
    }

    const emailData = {
      to: to,
      cc: cc,
      bcc: bcc,
      subject: subject,
      text: text,
      html: html,
      attachments: attachments || []
    };

    const result = await emailService.sendEmail(email, password, emailData);

    emailLogger.emailOperation(email, 'send_email', {
      to: to,
      subject: subject,
      messageId: result.messageId
    });

    res.json({
      success: true,
      message: 'Email enviado exitosamente',
      messageId: result.messageId,
      response: result.response
    });

  } catch (error) {
    emailLogger.emailError(req.body?.email || 'unknown', 'send_email', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar email'
    });
  }
});

/**
 * POST /api/emails/save-draft
 * Guardar email como borrador
 */
router.post('/save-draft', async (req, res) => {
  try {
    const { email, password, to, cc, bcc, subject, text, html } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Credenciales requeridas para guardar borradores'
      });
    }
    
    const result = await emailService.saveDraft(email, password, {
      to,
      cc,
      bcc,
      subject,
      text,
      html
    });
    
    emailLogger.emailOperation(email, 'save_draft', {
      subject: subject
    });
    
    res.json({
      success: true,
      message: 'Borrador guardado exitosamente'
    });
    
  } catch (error) {
    emailLogger.emailError(req.body?.email || 'unknown', 'save_draft', error);
    res.status(500).json({
      success: false,
      error: 'Error al guardar borrador: ' + error.message
    });
  }
});

/**
 * POST /api/emails/stats
 * Obtener estadísticas de carpetas
 */
router.post('/stats', addUserInfo, logUserActivity, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Credenciales requeridas para obtener estadísticas'
      });
    }

    const stats = await emailService.getFolderStats(email, password);

    emailLogger.emailOperation(email, 'get_folder_stats');

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    emailLogger.emailError(req.user?.email || 'unknown', 'get_stats', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
});

/**
 * POST /api/emails/reply
 * Responder a un email
 */
router.post('/reply', requireAuth, validateEmailAccess, async (req, res) => {
  try {
    const { originalEmail, replyText, email, password } = req.body;
    const user = authService.getCurrentUser(req);
    
    if (!originalEmail || !replyText) {
      return res.status(400).json({
        success: false,
        error: 'Email original y texto de respuesta son requeridos'
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Credenciales requeridas para responder emails'
      });
    }

    const result = await emailService.replyToEmail(
      email,
      password,
      originalEmail,
      replyText
    );

    emailLogger.emailOperation(user?.email || 'unknown', 'reply_email', {
      originalSubject: originalEmail.subject,
      to: originalEmail.from
    });

    res.json({
      success: true,
      message: 'Respuesta enviada exitosamente',
      messageId: result.messageId
    });

  } catch (error) {
    emailLogger.emailError(req.user?.email || 'unknown', 'reply_email', error);
    res.status(500).json({
      success: false,
      error: 'Error al responder email'
    });
  }
});

/**
 * POST /api/emails/move
 * Mover email entre carpetas
 */
router.post('/move', requireAuth, async (req, res) => {
  try {
    const { sourceFolder, targetFolder, uid, email, password } = req.body;
    const user = authService.getCurrentUser(req);
    
    const validFolders = [...Object.values(emailConfig.folders), ...Object.keys(emailConfig.folders)];
    if (!validFolders.includes(sourceFolder) || !validFolders.includes(targetFolder)) {
      return res.status(400).json({
        success: false,
        error: 'Carpetas no válidas'
      });
    }

    const emailUid = parseInt(uid);
    if (isNaN(emailUid)) {
      return res.status(400).json({
        success: false,
        error: 'UID de email no válido'
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Credenciales requeridas para mover emails'
      });
    }

    const result = await emailService.moveEmail(
      email,
      password,
      sourceFolder,
      targetFolder,
      emailUid
    );

    emailLogger.emailOperation(user?.email || 'unknown', 'move_email', {
      sourceFolder: sourceFolder,
      targetFolder: targetFolder,
      uid: emailUid
    });

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    emailLogger.emailError(req.user?.email || 'unknown', 'move_email', error);
    res.status(500).json({
      success: false,
      error: 'Error al mover email'
    });
  }
});

/**
 * GET /api/emails/folders
 * Obtener lista de carpetas disponibles
 */
router.get('/folders', requireAuth, (req, res) => {
  try {
    res.json({
      success: true,
      folders: emailConfig.folders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener carpetas'
    });
  }
});

/**
 * POST /api/emails/:folder/:uid/attachment/:index
 * Descargar adjunto de un email específico
 */
router.post('/:folder/:uid/attachment/:index', addUserInfo, async (req, res) => {
  try {
    const { folder, uid, index } = req.params;
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Credenciales requeridas para descargar adjuntos'
      });
    }
    
    const attachment = await emailService.downloadAttachment(
      email,
      password, 
      folder, 
      parseInt(uid), 
      parseInt(index)
    );

    res.setHeader('Content-Type', attachment.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.filename)}"`);
    res.setHeader('Content-Length', attachment.size);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    
    res.send(attachment.content);
    
  } catch (error) {
    console.error('Error in attachment download:', error);
    emailLogger.emailError(req.body?.email || 'unknown', 'download_attachment', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/emails/:folder/:uid
 * Obtener email específico por UID
 */
router.post('/:folder/:uid', addUserInfo, logUserActivity, async (req, res) => {
  try {
    const { folder, uid } = req.params;
    const user = authService.getCurrentUser(req);
    
    const validFolders = [...Object.values(emailConfig.folders), ...Object.keys(emailConfig.folders)];
    if (!validFolders.includes(folder)) {
      return res.status(400).json({
        success: false,
        error: 'Carpeta no válida'
      });
    }

    const emailUid = parseInt(uid);
    if (isNaN(emailUid)) {
      return res.status(400).json({
        success: false,
        error: 'UID de email no válido'
      });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Credenciales requeridas para operaciones de email'
      });
    }

    const emailData = await emailService.getEmailByUid(
      email,
      password,
      folder,
      emailUid
    );

    emailLogger.emailOperation(user?.email || 'unknown', 'get_email', {
      folder: folder,
      uid: emailUid
    });

    res.json({
      success: true,
      email: emailData
    });

  } catch (error) {
    emailLogger.emailError(req.user?.email || 'unknown', 'get_email_by_uid', error);
    
    if (error.message.includes('no encontrado')) {
      return res.status(404).json({
        success: false,
        error: 'Email no encontrado'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener email'
    });
  }
});

/**
 * DELETE /api/emails/:folder/:uid
 * Eliminar email (mover a papelera o eliminar permanentemente)
 */
router.delete('/:folder/:uid', requireAuth, async (req, res) => {
  try {
    const { folder, uid } = req.params;
    const user = authService.getCurrentUser(req);
    
    const validFolders = [...Object.values(emailConfig.folders), ...Object.keys(emailConfig.folders)];
    if (!validFolders.includes(folder)) {
      return res.status(400).json({
        success: false,
        error: 'Carpeta no válida'
      });
    }

    const emailUid = parseInt(uid);
    if (isNaN(emailUid)) {
      return res.status(400).json({
        success: false,
        error: 'UID de email no válido'
      });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Credenciales requeridas para eliminar emails'
      });
    }

    const result = await emailService.deleteEmail(
      email,
      password,
      folder,
      emailUid
    );

    emailLogger.emailOperation(user?.email || 'unknown', 'delete_email', {
      folder: folder,
      uid: emailUid
    });

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    emailLogger.emailError(req.user?.email || 'unknown', 'delete_email', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar email'
    });
  }
});

/**
 * POST /api/emails/clear-cache
 * Limpiar caché de emails para el usuario actual
 */
router.post('/clear-cache', addUserInfo, logUserActivity, async (req, res) => {
  try {
    const user = authService.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    emailService.clearUserCache(user.email);
    
    emailLogger.emailOperation(user.email, 'clear_cache');
    
    res.json({
      success: true,
      message: 'Caché limpiado exitosamente'
    });

  } catch (error) {
    emailLogger.emailError(req.user?.email || 'unknown', 'clear_cache', error);
    res.status(500).json({
      success: false,
      error: 'Error al limpiar caché'
    });
  }
});

/**
 * POST /api/emails/:folder
 * Obtener lista de emails de una carpeta específica
 */
router.post('/:folder', addUserInfo, logUserActivity, async (req, res) => {
  try {
    const { folder } = req.params;
    const { limit = 50, page = 1 } = req.query;
    const user = authService.getCurrentUser(req);
    
    const validFolders = [...Object.values(emailConfig.folders), ...Object.keys(emailConfig.folders)];
    if (!validFolders.includes(folder)) {
      return res.status(400).json({
        success: false,
        error: 'Carpeta no válida'
      });
    }

    const maxLimit = Math.min(parseInt(limit) || 50, emailConfig.email.maxEmailsPerFolder);

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Credenciales requeridas para operaciones de email'
      });
    }

    const result = await emailService.getEmailsFromFolder(
      email,
      password,
      folder,
      maxLimit
    );

    // Manejar tanto el formato antiguo como el nuevo
    const emails = result.emails || result;
    const totalCount = result.totalCount || emails.length;

    emailLogger.emailOperation(user?.email || email, 'list_emails', {
      folder: folder,
      count: emails.length,
      totalCount: totalCount,
      limit: maxLimit,
      page: page,
      fromCache: result.emails !== undefined
    });

    res.json({
      success: true,
      folder: folder,
      emails: emails,
      pagination: {
        page: parseInt(page),
        limit: maxLimit,
        total: totalCount,
        returned: emails.length
      }
    });

  } catch (error) {
    emailLogger.emailError(req.user?.email || 'unknown', 'get_emails', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener emails'
    });
  }
});

/**
 * Manejo de errores específicos de email
 */
router.use((error, req, res, next) => {
  if (error.message.includes('ECONNREFUSED')) {
    return res.status(503).json({
      success: false,
      error: 'Servidor de email no disponible'
    });
  }
  
  if (error.message.includes('timeout')) {
    return res.status(504).json({
      success: false,
      error: 'Tiempo de espera agotado'
    });
  }
  
  if (error.message.includes('authentication')) {
    return res.status(401).json({
      success: false,
      error: 'Error de autenticación con servidor de email'
    });
  }
  
  next(error);
});

// Ruta para generar respuesta con IA
router.post('/ai-response', async (req, res) => {
  try {
    const { email, style = 'formal' } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Datos del email requeridos'
      });
    }
    
    if (!openaiService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'OpenAI no está configurado. Usando respuesta predefinida.',
        fallback: true
      });
    }
    
    const result = await openaiService.generateEmailResponse(email, style);
    
    emailLogger.emailOperation(email.from, 'ai_response_generated', {
      style: style,
      tokens: result.tokens
    });
    
    res.json({
      success: true,
      response: result.response,
      tokens: result.tokens
    });
    
  } catch (error) {
    emailLogger.emailError(req.body?.email?.from || 'unknown', 'ai_response', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar respuesta con IA: ' + error.message
    });
  }
});

module.exports = router;