const express = require('express');
const router = express.Router();
const profileService = require('../services/profileService');
const { logger, emailLogger } = require('../utils/logger');

/**
 * GET /api/profile
 * Obtener perfil del usuario
 */
router.get('/', async (req, res) => {
  try {
    const userEmail = req.query.email;
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email de usuario requerido'
      });
    }

    const profile = await profileService.getUserProfile(userEmail);
    
    res.json({
      success: true,
      profile: profile
    });

  } catch (error) {
    logger.error('Error getting profile:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener perfil'
    });
  }
});

/**
 * POST /api/profile
 * Guardar perfil del usuario
 */
router.post('/', async (req, res) => {
  try {
    const { email, profile } = req.body;
    
    if (!email || !profile) {
      return res.status(400).json({
        success: false,
        error: 'Email y datos de perfil requeridos'
      });
    }

    await profileService.saveUserProfile(email, profile);
    
    res.json({
      success: true,
      message: 'Perfil guardado exitosamente'
    });

  } catch (error) {
    logger.error('Error saving profile:', error);
    res.status(500).json({
      success: false,
      error: 'Error al guardar perfil'
    });
  }
});

/**
 * POST /api/profile/signature
 * Subir imagen de firma
 */
router.post('/signature', async (req, res) => {
  try {
    const { email, imageData, filename } = req.body;
    
    if (!email || !imageData) {
      return res.status(400).json({
        success: false,
        error: 'Email e imagen requeridos'
      });
    }

    const result = await profileService.saveSignatureImage(email, imageData, filename);
    
    res.json({
      success: true,
      message: 'Imagen de firma guardada exitosamente',
      filename: result.filename
    });

  } catch (error) {
    logger.error('Error saving signature image:', error);
    res.status(500).json({
      success: false,
      error: 'Error al guardar imagen de firma'
    });
  }
});

/**
 * GET /api/profile/signature/:email
 * Obtener imagen de firma
 */
router.get('/signature/:email', async (req, res) => {
  try {
    const userEmail = req.params.email;
    const signaturePath = profileService.getSignatureImagePath(userEmail);
    
    // Verificar si el archivo existe
    const fs = require('fs');
    if (fs.existsSync(signaturePath)) {
      res.sendFile(signaturePath);
    } else {
      res.status(404).json({
        success: false,
        error: 'Imagen de firma no encontrada'
      });
    }

  } catch (error) {
    logger.error('Error getting signature image:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener imagen de firma'
    });
  }
});

module.exports = router;
