const fs = require('fs').promises;
const path = require('path');
const { logger, emailLogger } = require('../utils/logger');

class ProfileService {
  constructor() {
    this.profilesDir = path.join(__dirname, '../../data/profiles');
    this.signaturesDir = path.join(__dirname, '../../data/signatures');
    this.ensureDirectories();
  }

  /**
   * Asegurar que los directorios existen
   */
  async ensureDirectories() {
    try {
      await fs.mkdir(this.profilesDir, { recursive: true });
      await fs.mkdir(this.signaturesDir, { recursive: true });
    } catch (error) {
      logger.error('Error creating directories:', error);
    }
  }

  /**
   * Obtener perfil de usuario
   */
  async getUserProfile(userEmail) {
    try {
      const profilePath = path.join(this.profilesDir, `${userEmail}.json`);
      const data = await fs.readFile(profilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // Si no existe el perfil, devolver uno por defecto
      return {
        name: '',
        position: '',
        company: '',
        phone: '',
        website: '',
        signatureEnabled: false,
        signatureImage: null
      };
    }
  }

  /**
   * Guardar perfil de usuario
   */
  async saveUserProfile(userEmail, profileData) {
    try {
      const profilePath = path.join(this.profilesDir, `${userEmail}.json`);
      await fs.writeFile(profilePath, JSON.stringify(profileData, null, 2));
      
      logger.info(`Profile saved for user: ${userEmail}`);
      return { success: true };
    } catch (error) {
      logger.error(`Error saving profile for ${userEmail}:`, error);
      throw error;
    }
  }

  /**
   * Guardar imagen de firma
   */
  async saveSignatureImage(userEmail, imageData, filename) {
    try {
      // Extraer el base64 y el tipo de archivo
      const matches = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Formato de imagen inválido');
      }

      const fileType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      // Determinar extensión
      const extension = fileType.includes('png') ? 'png' : 
                       fileType.includes('jpeg') || fileType.includes('jpg') ? 'jpg' : 'png';
      
      const signatureFilename = `signature_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`;
      const signaturePath = path.join(this.signaturesDir, signatureFilename);

      await fs.writeFile(signaturePath, buffer);

      logger.info(`Signature image saved for user: ${userEmail}`);
      return { 
        success: true, 
        filename: signatureFilename,
        path: signaturePath
      };
    } catch (error) {
      logger.error(`Error saving signature image for ${userEmail}:`, error);
      throw error;
    }
  }

  /**
   * Obtener ruta de imagen de firma
   */
  getSignatureImagePath(userEmail) {
    const signatureFilename = `signature_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    const signaturePath = path.join(this.signaturesDir, signatureFilename);
    return signaturePath;
  }

  /**
   * Generar HTML de firma
   */
  generateSignatureHTML(profile) {
    if (!profile.signatureEnabled) {
      return '';
    }

    let signatureHTML = '<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">';
    
    if (profile.signatureImage) {
      signatureHTML += `<img src="cid:signature" alt="Firma" style="max-width: 400px; height: auto;" />`;
    } else {
      // Firma de texto si no hay imagen
      signatureHTML += '<div style="font-family: Arial, sans-serif; font-size: 12px; color: #666;">';
      
      if (profile.name) {
        signatureHTML += `<div style="font-weight: bold; color: #333; margin-bottom: 5px;">${profile.name}</div>`;
      }
      
      if (profile.position) {
        signatureHTML += `<div style="margin-bottom: 2px;">${profile.position}</div>`;
      }
      
      if (profile.company) {
        signatureHTML += `<div style="margin-bottom: 2px;">${profile.company}</div>`;
      }
      
      if (profile.phone) {
        signatureHTML += `<div style="margin-bottom: 2px;">Tel: ${profile.phone}</div>`;
      }
      
      if (profile.website) {
        signatureHTML += `<div><a href="${profile.website}" style="color: #0066cc;">${profile.website}</a></div>`;
      }
      
      signatureHTML += '</div>';
    }
    
    signatureHTML += '</div>';
    return signatureHTML;
  }
}

module.exports = new ProfileService();
