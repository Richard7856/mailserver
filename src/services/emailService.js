const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const emailConfig = require('../config/email');
const authService = require('./authService');
const profileService = require('./profileService');
const { emailLogger } = require('../utils/logger');

/**
 * Servicio de Email
 * Manejo completo de operaciones IMAP/SMTP para Hostinger
 */
class EmailService {
  constructor() {
    // Pool de transportadores SMTP por usuario
    this.smtpTransports = new Map();
    
    // Sistema de caché para emails
    this.emailCache = new Map(); // key: userEmail_folder, value: { emails, timestamp, totalCount }
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos en milisegundos
  }

  /**
   * Generar clave de caché para un usuario y carpeta
   * @param {string} userEmail - Email del usuario
   * @param {string} folder - Nombre de la carpeta
   * @returns {string} - Clave de caché
   */
  _getCacheKey(userEmail, folder) {
    return `${userEmail}_${folder}`;
  }

  /**
   * Obtener datos de caché si están disponibles y no han expirado
   * @param {string} userEmail - Email del usuario
   * @param {string} folder - Nombre de la carpeta
   * @returns {Object|null} - Datos de caché o null si no existe/expirado
   */
  _getCachedData(userEmail, folder) {
    const cacheKey = this._getCacheKey(userEmail, folder);
    const cachedData = this.emailCache.get(cacheKey);
    
    if (!cachedData) {
      return null;
    }
    
    const now = Date.now();
    if (now - cachedData.timestamp > this.cacheTimeout) {
      // Caché expirado, eliminarlo
      this.emailCache.delete(cacheKey);
      return null;
    }
    
    return cachedData;
  }

  /**
   * Guardar datos en caché
   * @param {string} userEmail - Email del usuario
   * @param {string} folder - Nombre de la carpeta
   * @param {Array} emails - Lista de emails
   * @param {number} totalCount - Número total de emails
   */
  _setCachedData(userEmail, folder, emails, totalCount) {
    const cacheKey = this._getCacheKey(userEmail, folder);
    this.emailCache.set(cacheKey, {
      emails: emails,
      timestamp: Date.now(),
      totalCount: totalCount
    });
  }

  /**
   * Limpiar caché para un usuario específico
   * @param {string} userEmail - Email del usuario
   */
  clearUserCache(userEmail) {
    for (const [key] of this.emailCache) {
      if (key.startsWith(`${userEmail}_`)) {
        this.emailCache.delete(key);
      }
    }
  }

  /**
   * Obtener lista de emails de una carpeta específica
   * @param {string} userEmail - Email del usuario
   * @param {string} userPassword - Contraseña del usuario
   * @param {string} folder - Nombre de la carpeta
   * @param {number} limit - Límite de emails a obtener
   * @returns {Promise<Array>} - Lista de emails
   */
  async getEmailsFromFolder(userEmail, userPassword, folder, limit = 50) {
    try {
      // Convertir clave de carpeta a valor real si es necesario
      const realFolder = emailConfig.folders[folder] || folder;
      
      // Verificar caché primero
      const cachedData = this._getCachedData(userEmail, folder);
      if (cachedData) {
        console.log(`📦 Usando caché para ${userEmail}/${folder} (${cachedData.emails.length} emails)`);
        // Retornar solo el número limitado de emails solicitados
        return {
          emails: cachedData.emails.slice(0, limit),
          totalCount: cachedData.totalCount
        };
      }

      console.log(`🔄 Cargando emails desde servidor para ${userEmail}/${folder} -> ${realFolder}`);
      const connection = await authService.getUserConnection(userEmail, userPassword);
      
      // Abrir carpeta usando el valor real
      await connection.openBox(realFolder, true);
      
      // Buscar emails (los más recientes primero)
      const searchCriteria = ['ALL'];
      const fetchOptions = {
        bodies: 'HEADER',  // Solo headers, sin preview de contenido
        struct: true,
        markSeen: false
      };

      const messages = await connection.search(searchCriteria, fetchOptions);
      
      // Log para depuración
      console.log('Total messages found:', messages.length);
      if (messages.length > 0) {
        console.log('First message structure:', JSON.stringify(messages[0], null, 2));
      }
      
      // Limitar resultados
      const limitedMessages = messages.slice(0, limit);
      
      // Procesar emails
      const emails = await Promise.all(
        limitedMessages.map(async (message) => {
          try {
            // Obtener información básica del mensaje
            let headers = {};
            
            // Intentar obtener headers de diferentes formas
            if (message.parts && message.parts[0] && message.parts[0].body) {
              headers = message.parts[0].body;
            } else if (message.body) {
              headers = message.body;
            } else if (message.attributes) {
              // Usar atributos básicos si no hay headers
              headers = {
                subject: message.attributes.subject || '(Sin asunto)',
                from: message.attributes.from || 'Desconocido',
                to: message.attributes.to || 'Desconocido',
                date: message.attributes.date || new Date()
              };
            }
            
            // Log para depuración
            console.log('Message structure:', {
              uid: message.attributes.uid,
              hasParts: !!message.parts,
              partsLength: message.parts ? message.parts.length : 0,
              hasBody: !!message.body,
              hasAttributes: !!message.attributes,
              headers: headers
            });
            
            // Intentar extraer headers de la estructura completa del mensaje
            if (!headers.subject && !headers.from && !headers.to) {
              // Buscar en diferentes ubicaciones
              const possibleHeaders = [
                message.attributes,
                message.parts?.[0]?.body,
                message.body,
                message
              ];
              
              for (const possibleHeader of possibleHeaders) {
                if (possibleHeader && typeof possibleHeader === 'object') {
                  if (possibleHeader.subject || possibleHeader.from || possibleHeader.to) {
                    headers = { ...headers, ...possibleHeader };
                    break;
                  }
                }
              }
            }
            
            const extractedSubject = this.extractHeaderValue(headers.subject);
            const extractedFrom = this.extractHeaderValue(headers.from);
            const extractedTo = this.extractHeaderValue(headers.to);
            
            // Log para depuración
            console.log('Extracted values:', {
              subject: extractedSubject,
              from: extractedFrom,
              to: extractedTo,
              originalSubject: headers.subject,
              originalFrom: headers.from,
              originalTo: headers.to
            });
            
            // Procesar adjuntos si existen (corregido para estructura de array)
            const attachments = [];
            
            const processPartForAttachments = (part, depth = 0) => {
              if (!part) return;
              
              // Si es un array, procesar cada elemento
              if (Array.isArray(part)) {
                part.forEach(item => processPartForAttachments(item, depth));
                return;
              }
              
              // Si es un objeto (parte del mensaje)
              if (typeof part === 'object') {
                // Verificar si es un adjunto por disposition
                if (part.disposition && typeof part.disposition === 'object') {
                  if (part.disposition.type === 'attachment' || part.disposition.type === 'inline') {
                    const filename = part.disposition.params?.filename || part.params?.name;
                    if (filename) {
                      attachments.push({
                        filename: filename,
                        contentType: `${part.type}/${part.subtype}`,
                        size: part.size || 0
                      });
                    }
                  }
                }
                // Verificar si tiene nombre de archivo en params (adjuntos sin disposition)
                else if (part.params && part.params.name && part.type && part.type !== 'text') {
                  attachments.push({
                    filename: part.params.name,
                    contentType: `${part.type}/${part.subtype}`,
                    size: part.size || 0
                  });
                }
              }
            };
            
            // La estructura puede ser un array o un objeto
            if (message.attributes.struct) {
              if (Array.isArray(message.attributes.struct)) {
                // Estructura en formato array (Gmail, etc.)
                message.attributes.struct.forEach(part => processPartForAttachments(part));
              } else {
                // Estructura en formato objeto (tradicional)
                processPartForAttachments(message.attributes.struct);
              }
            }
            
            return {
              uid: message.attributes.uid,
              subject: extractedSubject || '(Sin asunto)',
              from: extractedFrom || 'Desconocido',
              to: extractedTo || 'Desconocido',
              date: this.extractHeaderValue(headers.date) || new Date(),
              flags: message.attributes.flags,
              seen: message.attributes.flags.includes('\\Seen'),
              size: message.attributes.size,
              attachments: attachments
              // NO incluir preview de texto - demasiado complicado limpiar MIME
            };
          } catch (parseError) {
            emailLogger.emailError(userEmail, 'parse_email', parseError);
            return null;
          }
        })
      );

      // Filtrar emails nulos
      const validEmails = emails.filter(email => email !== null);
      
      emailLogger.emailOperation(userEmail, 'list_emails', {
        folder: folder,
        count: validEmails.length
      });

      // Guardar en caché (guardamos todos los emails, no solo los limitados)
      this._setCachedData(userEmail, folder, validEmails, validEmails.length);
      
      // Retornar solo el número limitado de emails solicitados
      return {
        emails: validEmails.slice(0, limit),
        totalCount: validEmails.length
      };

    } catch (error) {
      emailLogger.emailError(userEmail, 'get_emails_from_folder', error);
      throw error;
    }
  }

  /**
   * Obtener email específico por UID (MEJORADO con soporte de adjuntos)
   * @param {string} userEmail - Email del usuario
   * @param {string} userPassword - Contraseña del usuario
   * @param {string} folder - Nombre de la carpeta
   * @param {number} uid - UID del email
   * @returns {Promise<Object>} - Email completo
   */
  async getEmailByUid(userEmail, userPassword, folder, uid) {
    try {
      // Convertir clave de carpeta a valor real si es necesario
      const realFolder = emailConfig.folders[folder] || folder;
      
      const connection = await authService.getUserConnection(userEmail, userPassword);
      
      await connection.openBox(realFolder, true);
      
      const searchCriteria = [['UID', uid]];
      const fetchOptions = {
        bodies: '',  // Obtener TODO el contenido
        struct: true,
        markSeen: true
      };

      const messages = await connection.search(searchCriteria, fetchOptions);
      
      if (messages.length === 0) {
        throw new Error('Email no encontrado');
      }

      const message = messages[0];
      
      // Log para depuración
      console.log('Message structure:', {
        hasParts: !!message.parts,
        partsCount: message.parts?.length || 0,
        partTypes: message.parts?.map(p => ({ which: p.which, size: p.size })) || []
      });
      
      // Obtener el body completo
      const bodyPart = message.parts.find(part => part.which === '');
      if (!bodyPart) {
        console.error('No body part found. Available parts:', message.parts);
        throw new Error('No se pudo obtener el contenido del email');
      }
      
      console.log('Body part found:', {
        size: bodyPart.size,
        bodyType: typeof bodyPart.body,
        isBuffer: Buffer.isBuffer(bodyPart.body)
      });

      // Parsear con simpleParser
      const parsed = await simpleParser(bodyPart.body);
      
      console.log('Email parseado:', {
        hasAttachments: !!(parsed.attachments && parsed.attachments.length > 0),
        attachmentCount: parsed.attachments?.length || 0
      });

      // Extraer direcciones de email
      const extractEmailFromParser = (emailObj) => {
        if (!emailObj) return '';
        if (typeof emailObj === 'string') return emailObj;
        if (emailObj.text) return emailObj.text;
        if (emailObj.value && Array.isArray(emailObj.value) && emailObj.value.length > 0) {
          const firstValue = emailObj.value[0];
          if (firstValue.address && firstValue.name) {
            return `${firstValue.name} <${firstValue.address}>`;
          }
          if (firstValue.address) return firstValue.address;
        }
        if (emailObj.address && emailObj.name) {
          return `${emailObj.name} <${emailObj.address}>`;
        }
        if (emailObj.address) return emailObj.address;
        return String(emailObj);
      };

      // Procesar adjuntos CON contenido
      const processedAttachments = [];
      if (parsed.attachments && Array.isArray(parsed.attachments)) {
        console.log('Raw attachments from parser:', parsed.attachments.length);
        parsed.attachments.forEach((attachment, index) => {
          console.log(`Adjunto ${index}:`, {
            filename: attachment.filename,
            contentType: attachment.contentType,
            size: attachment.size,
            hasContent: !!attachment.content,
            contentLength: attachment.content?.length || 0,
            contentType: Object.prototype.toString.call(attachment.content)
          });

          processedAttachments.push({
            filename: attachment.filename || `attachment_${index}`,
            contentType: attachment.contentType || 'application/octet-stream',
            size: attachment.size || 0,
            cid: attachment.cid || null,
            // GUARDAR EL CONTENIDO
            content: attachment.content // Este es el Buffer con los datos
          });
        });
        console.log(`Processed ${processedAttachments.length} attachments with content`);
      } else {
        console.log('No attachments found in parsed email');
      }

      const email = {
        uid: message.attributes.uid,
        subject: parsed.subject || '(Sin asunto)',
        from: extractEmailFromParser(parsed.from),
        to: extractEmailFromParser(parsed.to),
        cc: extractEmailFromParser(parsed.cc),
        bcc: extractEmailFromParser(parsed.bcc),
        date: parsed.date || new Date(),
        flags: message.attributes.flags,
        seen: message.attributes.flags.includes('\\Seen'),
        size: message.attributes.size,
        text: parsed.text || '',
        html: parsed.html || '',
        attachments: processedAttachments
      };

      emailLogger.emailOperation(userEmail, 'get_email', {
        folder: folder,
        uid: uid,
        attachmentCount: processedAttachments.length
      });

      return email;

    } catch (error) {
      emailLogger.emailError(userEmail, 'get_email_by_uid', error);
      throw error;
    }
  }

  /**
   * Descargar adjunto SIMPLIFICADO
   * @param {string} userEmail - Email del usuario
   * @param {string} userPassword - Contraseña del usuario
   * @param {string} folder - Nombre de la carpeta
   * @param {number} uid - UID del email
   * @param {number} attachmentIndex - Índice del adjunto
   * @returns {Promise<Object>} - Adjunto con contenido
   */
  async downloadAttachment(userEmail, userPassword, folder, uid, attachmentIndex) {
    try {
      console.log('Download attachment request:', { 
        userEmail, 
        folder, 
        uid, 
        attachmentIndex 
      });
      
      // Obtener el email completo (que ahora incluye el contenido de adjuntos)
      const email = await this.getEmailByUid(userEmail, userPassword, folder, uid);
      
      console.log('Email retrieved:', { 
        hasEmail: !!email, 
        hasAttachments: !!(email && email.attachments), 
        attachmentsCount: email?.attachments?.length || 0 
      });
      
      // Validaciones
      if (!email || !email.attachments || email.attachments.length === 0) {
        throw new Error('No se encontraron adjuntos en este email');
      }
      
      const index = parseInt(attachmentIndex);
      if (index < 0 || index >= email.attachments.length) {
        throw new Error(`Índice de adjunto inválido. Este email tiene ${email.attachments.length} adjunto(s)`);
      }
      
      const attachment = email.attachments[index];
      
      console.log('Attachment found:', { 
        filename: attachment.filename, 
        contentType: attachment.contentType,
        size: attachment.size,
        hasContent: !!attachment.content 
      });
      
      // Verificar que tenga contenido
      if (!attachment.content) {
        throw new Error('El adjunto no tiene contenido disponible');
      }

      // El contenido ya es un Buffer, listo para enviar
      return {
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size,
        content: attachment.content // Buffer listo para enviar
      };

    } catch (error) {
      console.error('Error downloading attachment:', error);
      emailLogger.emailError(userEmail, 'download_attachment', error);
      throw error;
    }
  }

  /**
   * Enviar nuevo email
   * @param {string} userEmail - Email del usuario
   * @param {string} userPassword - Contraseña del usuario
   * @param {Object} emailData - Datos del email
   * @returns {Promise<Object>} - Resultado del envío
   */
  async sendEmail(userEmail, userPassword, emailData) {
    try {
      console.log('Starting email send process for:', userEmail);
      console.log('Email data:', {
        to: emailData.to,
        subject: emailData.subject,
        hasText: !!emailData.text,
        hasHtml: !!emailData.html,
        hasAttachments: !!(emailData.attachments && emailData.attachments.length > 0)
      });

      const transporter = await this.getSmtpTransporter(userEmail, userPassword);
      console.log('SMTP transporter created successfully');
      
      // Obtener perfil del usuario para la firma
      const profile = await profileService.getUserProfile(userEmail);
      console.log('User profile loaded:', {
        signatureEnabled: profile.signatureEnabled,
        hasSignatureImage: !!profile.signatureImage
      });
      
      // Generar HTML con firma
      let htmlContent = emailData.html || emailData.text;
      if (profile.signatureEnabled) {
        const signatureHTML = profileService.generateSignatureHTML(profile);
        htmlContent += signatureHTML;
        console.log('Signature added to email');
      }
      
      // Preparar adjuntos
      const attachments = [...(emailData.attachments || [])];
      
      // Agregar imagen de firma como adjunto si existe
      if (profile.signatureEnabled && profile.signatureImage) {
        try {
          const fs = require('fs');
          const signaturePath = profileService.getSignatureImagePath(userEmail);
          
          if (fs.existsSync(signaturePath)) {
            attachments.push({
              filename: 'signature.png',
              path: signaturePath,
              cid: 'signature' // Content-ID para referenciar en HTML
            });
            console.log('Signature image added as attachment');
          }
        } catch (error) {
          emailLogger.error('Error adding signature image:', error);
        }
      }
      
      const mailOptions = {
        from: userEmail,
        to: emailData.to,
        cc: emailData.cc,
        bcc: emailData.bcc,
        subject: emailData.subject,
        text: emailData.text,
        html: htmlContent,
        attachments: attachments
      };

      console.log('Sending email with options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        attachmentsCount: mailOptions.attachments.length
      });

      const result = await transporter.sendMail(mailOptions);
      
      console.log('Email sent successfully:', {
        messageId: result.messageId,
        response: result.response
      });
      
      // Guardar copia en la carpeta de enviados usando IMAP
      try {
        console.log('Saving copy to Sent folder...');
        const connection = await authService.getUserConnection(userEmail, userPassword);
        
        // Construir el mensaje RFC822 completo
        const boundary = '----=_Part_' + Date.now();
        let message = '';
        
        // Headers del mensaje
        message += `From: ${userEmail}\r\n`;
        message += `To: ${emailData.to}\r\n`;
        if (emailData.cc) message += `Cc: ${emailData.cc}\r\n`;
        if (emailData.bcc) message += `Bcc: ${emailData.bcc}\r\n`;
        message += `Subject: ${emailData.subject}\r\n`;
        message += `Message-ID: ${result.messageId}\r\n`;
        message += `Date: ${new Date().toUTCString()}\r\n`;
        message += `MIME-Version: 1.0\r\n`;
        
        if (attachments.length > 0) {
          message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
          message += `--${boundary}\r\n`;
        }
        
        message += `Content-Type: text/html; charset=utf-8\r\n`;
        message += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
        message += htmlContent.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
        
        if (attachments.length > 0) {
          message += `\r\n--${boundary}--\r\n`;
        }
        
        message += `\r\n`;
        
        // Append al folder de enviados
        await connection.append(message, {
          mailbox: emailConfig.folders.SENT,
          flags: ['\\Seen']
        });
        
        console.log('Copy saved to Sent folder successfully');
      } catch (saveError) {
        console.error('Error saving to Sent folder:', saveError);
        emailLogger.error('Error saving to Sent folder:', saveError);
        // No lanzar el error para que el envío se considere exitoso
      }
      
      emailLogger.emailOperation(userEmail, 'send_email', {
        to: emailData.to,
        subject: emailData.subject,
        messageId: result.messageId,
        hasSignature: profile.signatureEnabled
      });

      return {
        success: true,
        messageId: result.messageId,
        response: result.response
      };

    } catch (error) {
      console.error('Error sending email:', error);
      emailLogger.emailError(userEmail, 'send_email', error);
      throw error;
    }
  }

  /**
   * Responder a un email
   * @param {string} userEmail - Email del usuario
   * @param {string} userPassword - Contraseña del usuario
   * @param {Object} originalEmail - Email original
   * @param {string} replyText - Texto de respuesta
   * @returns {Promise<Object>} - Resultado de la respuesta
   */
  async replyToEmail(userEmail, userPassword, originalEmail, replyText) {
    try {
      const replySubject = originalEmail.subject.startsWith('Re: ') 
        ? originalEmail.subject 
        : `Re: ${originalEmail.subject}`;

      const replyData = {
        to: originalEmail.from,
        subject: replySubject,
        text: replyText,
        html: `<p>${replyText.replace(/\n/g, '<br>')}</p>`,
        inReplyTo: originalEmail.messageId,
        references: originalEmail.references || originalEmail.messageId
      };

      return await this.sendEmail(userEmail, userPassword, replyData);

    } catch (error) {
      emailLogger.emailError(userEmail, 'reply_to_email', error);
      throw error;
    }
  }

  /**
   * Guardar email como borrador
   * @param {string} userEmail - Email del usuario
   * @param {string} userPassword - Contraseña del usuario
   * @param {Object} draftData - Datos del borrador
   * @returns {Promise<Object>} - Resultado del guardado
   */
  async saveDraft(userEmail, userPassword, draftData) {
    try {
      const connection = await authService.getUserConnection(userEmail, userPassword);
      
      // Construir el mensaje RFC822
      const boundary = '----=_Part_' + Date.now();
      let message = '';
      
      // Headers del mensaje
      message += `From: ${userEmail}\r\n`;
      if (draftData.to) message += `To: ${draftData.to}\r\n`;
      if (draftData.cc) message += `Cc: ${draftData.cc}\r\n`;
      if (draftData.bcc) message += `Bcc: ${draftData.bcc}\r\n`;
      message += `Subject: ${draftData.subject || '(Sin asunto)'}\r\n`;
      message += `Date: ${new Date().toUTCString()}\r\n`;
      message += `MIME-Version: 1.0\r\n`;
      message += `Content-Type: text/html; charset=utf-8\r\n`;
      message += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      message += (draftData.html || draftData.text || '').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
      message += `\r\n`;
      
      // Guardar en la carpeta de borradores
      await connection.append(message, {
        mailbox: emailConfig.folders.DRAFTS,
        flags: ['\\Draft']
      });
      
      emailLogger.emailOperation(userEmail, 'save_draft', {
        subject: draftData.subject
      });
      
      return {
        success: true,
        message: 'Borrador guardado exitosamente'
      };
      
    } catch (error) {
      console.error('Error saving draft:', error);
      emailLogger.emailError(userEmail, 'save_draft', error);
      throw error;
    }
  }

  /**
   * Mover email entre carpetas
   * @param {string} userEmail - Email del usuario
   * @param {string} userPassword - Contraseña del usuario
   * @param {string} sourceFolder - Carpeta origen
   * @param {string} targetFolder - Carpeta destino
   * @param {number} uid - UID del email
   * @returns {Promise<Object>} - Resultado del movimiento
   */
  async moveEmail(userEmail, userPassword, sourceFolder, targetFolder, uid) {
    try {
      // Convertir claves de carpeta a valores reales si es necesario
      const realSourceFolder = emailConfig.folders[sourceFolder] || sourceFolder;
      const realTargetFolder = emailConfig.folders[targetFolder] || targetFolder;
      
      const connection = await authService.getUserConnection(userEmail, userPassword);
      
      // Abrir carpeta origen
      await connection.openBox(realSourceFolder, false);
      
      // Mover email usando addFlags y expunge
      // Primero copiar el email a la carpeta destino
      await connection.moveMessage(uid, realTargetFolder);
      
      emailLogger.emailOperation(userEmail, 'move_email', {
        sourceFolder: sourceFolder,
        targetFolder: targetFolder,
        uid: uid
      });

      return {
        success: true,
        message: 'Email movido exitosamente'
      };

    } catch (error) {
      emailLogger.emailError(userEmail, 'move_email', error);
      throw error;
    }
  }

  /**
   * Eliminar email (mover a papelera)
   * @param {string} userEmail - Email del usuario
   * @param {string} userPassword - Contraseña del usuario
   * @param {string} folder - Carpeta del email
   * @param {number} uid - UID del email
   * @returns {Promise<Object>} - Resultado de eliminación
   */
  async deleteEmail(userEmail, userPassword, folder, uid) {
    try {
      // Convertir clave de carpeta a valor real si es necesario
      const realFolder = emailConfig.folders[folder] || folder;
      
      // Si no está en la papelera, mover a papelera
      if (realFolder !== emailConfig.folders.TRASH) {
        return await this.moveEmail(userEmail, userPassword, folder, 'TRASH', uid);
      }
      
      // Si ya está en la papelera, eliminar permanentemente
      const connection = await authService.getUserConnection(userEmail, userPassword);
      await connection.openBox(realFolder, false);
      
      // Marcar como eliminado y expunge
      await connection.addFlags(uid, '\\Deleted');
      await connection.imap.expunge();
      
      emailLogger.emailOperation(userEmail, 'delete_email', {
        folder: folder,
        uid: uid
      });

      return {
        success: true,
        message: 'Email eliminado permanentemente'
      };

    } catch (error) {
      emailLogger.emailError(userEmail, 'delete_email', error);
      throw error;
    }
  }

  /**
   * Obtener transportador SMTP para usuario
   * @param {string} userEmail - Email del usuario
   * @param {string} userPassword - Contraseña del usuario
   * @returns {Promise<Object>} - Transportador SMTP
   */
  async getSmtpTransporter(userEmail, userPassword) {
    // Verificar si ya existe un transportador para este usuario
    if (this.smtpTransports.has(userEmail)) {
      return this.smtpTransports.get(userEmail);
    }

    // Crear nuevo transportador
    const transporter = nodemailer.createTransport({
      ...emailConfig.smtp,
      auth: {
        user: userEmail,
        pass: userPassword
      }
    });

    // Verificar conexión
    await transporter.verify();

    // Guardar en el pool
    this.smtpTransports.set(userEmail, transporter);

    return transporter;
  }

  /**
   * Formatear dirección de email para mostrar
   * @param {Object|Array} address - Dirección(es) de email
   * @returns {string} - Dirección formateada
   */
  /**
   * Extraer valor de header (puede ser array o string)
   * @param {string|Array|Object} headerValue - Valor del header
   * @returns {string} - Valor extraído
   */
  extractHeaderValue(headerValue) {
    if (!headerValue) return '';
    
    // Si es un array, tomar el primer elemento
    if (Array.isArray(headerValue)) {
      const firstElement = headerValue[0];
      if (typeof firstElement === 'string') {
        return firstElement;
      }
      if (typeof firstElement === 'object' && firstElement !== null) {
        // Si es un objeto, extraer nombre y dirección de email
        if (firstElement.address && firstElement.name) {
          return `${firstElement.name} <${firstElement.address}>`;
        }
        if (firstElement.address) {
          return firstElement.address;
        }
        if (firstElement.name && firstElement.value) {
          return `${firstElement.name} <${firstElement.value}>`;
        }
        return String(firstElement);
      }
      return String(firstElement);
    }
    
    // Si es un objeto, extraer nombre y dirección de email
    if (typeof headerValue === 'object' && headerValue !== null) {
      if (headerValue.address && headerValue.name) {
        return `${headerValue.name} <${headerValue.address}>`;
      }
      if (headerValue.address) {
        return headerValue.address;
      }
      if (headerValue.name && headerValue.value) {
        return `${headerValue.name} <${headerValue.value}>`;
      }
      return String(headerValue);
    }
    
    // Si es un string, devolverlo tal como está
    if (typeof headerValue === 'string') {
      return headerValue;
    }
    
    return String(headerValue);
  }

  formatEmailAddress(address) {
    if (!address) return '';
    
    // Si es un string, devolverlo tal como está
    if (typeof address === 'string') {
      return address;
    }
    
    if (Array.isArray(address)) {
      return address.map(addr => {
        if (typeof addr === 'string') return addr;
        return `${addr.name ? addr.name + ' ' : ''}<${addr.address}>`;
      }).join(', ');
    }
    
    // Si es un objeto con propiedades
    if (typeof address === 'object') {
      if (address.address) {
        return `${address.name ? address.name + ' ' : ''}<${address.address}>`;
      }
      // Si no tiene address, intentar usar el valor directamente
      return address.name || address.value || JSON.stringify(address);
    }
    
    return String(address);
  }

  /**
   * Obtener estadísticas de carpetas
   * @param {string} userEmail - Email del usuario
   * @param {string} userPassword - Contraseña del usuario
   * @returns {Promise<Object>} - Estadísticas de carpetas
   */
  async getFolderStats(userEmail, userPassword) {
    try {
      const connection = await authService.getUserConnection(userEmail, userPassword);
      
      const stats = {};
      
      // Solo procesar INBOX por ahora, las otras carpetas pueden no existir
      const foldersToCheck = {
        INBOX: 'INBOX'
      };
      
      for (const [key, folderName] of Object.entries(foldersToCheck)) {
        try {
          console.log(`Trying to open folder: ${folderName}`);
          const box = await connection.openBox(folderName, true);
          
          console.log(`Successfully opened folder ${folderName}:`, {
            hasBox: !!box,
            boxKeys: box ? Object.keys(box) : [],
            total: box?.messages?.total,
            unseen: box?.messages?.new
          });
          
          stats[key] = {
            name: folderName,
            messages: box?.messages?.total || 0,
            unseen: box?.messages?.new || 0,
            size: box?.size || 0
          };
        } catch (error) {
          console.log(`Error opening folder ${folderName}:`, error.message, error.stack);
          stats[key] = {
            name: folderName,
            messages: 0,
            unseen: 0,
            size: 0,
            error: 'Carpeta no accesible'
          };
        }
      }
      
      // Agregar carpetas adicionales con valores por defecto
      stats.SENT = { name: 'INBOX.Sent', messages: 0, unseen: 0, size: 0 };
      stats.DRAFTS = { name: 'INBOX.Drafts', messages: 0, unseen: 0, size: 0 };
      stats.TRASH = { name: 'INBOX.Trash', messages: 0, unseen: 0, size: 0 };
      stats.JUNK = { name: 'INBOX.Junk', messages: 0, unseen: 0, size: 0 };

      console.log('Final stats:', stats);
      emailLogger.emailOperation(userEmail, 'get_folder_stats');

      return stats;

    } catch (error) {
      console.error('Error in getFolderStats:', error);
      emailLogger.emailError(userEmail, 'get_folder_stats', error);
      throw error;
    }
  }

  /**
   * Limpiar transportadores SMTP (para shutdown graceful)
   */
  async clearAllTransports() {
    for (const [userEmail, transporter] of this.smtpTransports) {
      try {
        transporter.close();
        emailLogger.emailOperation(userEmail, 'smtp_transport_closed');
      } catch (error) {
        emailLogger.emailError(userEmail, 'close_smtp_transport', error);
      }
    }
    
    this.smtpTransports.clear();
  }
}

module.exports = new EmailService();
