/**
 * Email Admin MVP - Frontend JavaScript
 * Gestión completa del dashboard de emails
 */

// Estado global de la aplicación
const AppState = {
    currentUser: null,
    currentFolder: 'INBOX',
    emails: [],
    selectedEmails: new Set(),
    isLoading: false,
    userCredentials: null,
    folderStats: null,
    emailContacts: new Set(), // Para autocompletado
    currentPage: 1,
    totalEmails: 0,
    emailsPerPage: 50,
    userProfile: null, // Perfil del usuario
    emailCache: {} // Cache de emails para evitar recargas
};

// Configuración de carpetas
const FOLDERS = {
    'INBOX': { name: 'Inbox', icon: '📥', color: '#3b82f6' },
    'INBOX.Sent': { name: 'Enviados', icon: '📤', color: '#10b981' },
    'INBOX.Drafts': { name: 'Borradores', icon: '📝', color: '#f59e0b' },
    'INBOX.Trash': { name: 'Papelera', icon: '🗑️', color: '#ef4444' },
    'INBOX.Junk': { name: 'Spam', icon: '🚫', color: '#6b7280' }
};

/**
 * Inicialización de la aplicación
 */
async function init() {
    try {
        // DESACTIVADO: Verificación de autenticación para evitar bucles
        // await checkAuthStatus();
        // await loadUserProfile();
        
        // Intentar recuperar credenciales de sessionStorage
        const savedCredentials = sessionStorage.getItem('userCredentials');
        if (savedCredentials) {
            try {
                AppState.userCredentials = JSON.parse(savedCredentials);
                console.log('✅ Credenciales recuperadas de sessionStorage');
                // Actualizar UI con el email del usuario
                updateUserInfo();
            } catch (e) {
                console.error('Error al parsear credenciales guardadas:', e);
                sessionStorage.removeItem('userCredentials');
            }
        }
        
        // Verificar si tenemos credenciales
        if (!AppState.userCredentials) {
            console.log('❌ No hay credenciales disponibles');
            console.log('🔐 Redirigiendo al login...');
            window.location.href = '/login.html';
            return;
        }
        
        console.log('✅ Credenciales encontradas, cargando aplicación...');
        
        // Cargar todo con las credenciales disponibles
        await loadFolderStats();
        await loadEmails(AppState.currentFolder);
        
        console.log('✅ Aplicación inicializada correctamente');
        
    } catch (error) {
        console.error('❌ Error al inicializar aplicación:', error);
        showNotification('Error al cargar la aplicación', 'error');
        
        // Redirigir al login si hay error de autenticación
        if (error.message.includes('No autorizado') || error.message.includes('Sesión expirada')) {
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
        }
    }
}

/**
 * Verificar estado de autenticación
 */
async function checkAuthStatus() {
    // DESACTIVADO: Evitar bucles de redirección y rate limiting
    console.log('checkAuthStatus: Desactivado para evitar bucles');
    return true;
}

/**
 * Cargar perfil del usuario
 */
async function loadUserProfile() {
    try {
        const response = await fetch('/api/auth/profile');
        const data = await response.json();
        
        if (data.success) {
            AppState.currentUser = data.user;
            updateUserInfo();
        }
        
    } catch (error) {
        console.error('Error al cargar perfil:', error);
    }
}

/**
 * Actualizar información del usuario en la UI
 */
function updateUserInfo() {
    const userEmailElement = document.getElementById('userEmail');
    const userStatusElement = document.getElementById('userStatus');
    
    // Mostrar el email del usuario desde las credenciales
    if (userEmailElement && AppState.userCredentials && AppState.userCredentials.email) {
        userEmailElement.textContent = AppState.userCredentials.email;
    }
    
    // Ocultar el status (ya no es necesario)
    if (userStatusElement) {
        userStatusElement.style.display = 'none';
    }
}

/**
 * Cargar estadísticas de carpetas
 */
async function loadFolderStats() {
    try {
        console.log('loadFolderStats called, userCredentials:', AppState.userCredentials);
        
        if (!AppState.userCredentials) {
            console.log('No credentials found, skipping stats for now...');
            // No mostrar modal de credenciales aquí, esperar a que se necesiten
            return;
        }
        
        console.log('Enviando credenciales:', AppState.userCredentials);
        
        const response = await fetch('/api/emails/stats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(AppState.userCredentials)
        });
        
        console.log('Stats response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Stats error response:', errorText);
            return;
        }
        
        const data = await response.json();
        console.log('Stats response data:', data);
        
        if (data.success) {
            AppState.folderStats = data.stats;
            updateFolderCounts();
        }
        
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

/**
 * Actualizar contadores de carpetas
 */
function updateFolderCounts() {
    if (!AppState.folderStats) {
        console.log('No folder stats available yet');
        return;
    }
    
    console.log('Updating folder counts with stats:', AppState.folderStats);
    
    const countElements = {
        'INBOX': document.getElementById('inboxCount'),
        'INBOX.Sent': document.getElementById('sentCount'),
        'INBOX.Drafts': document.getElementById('draftsCount'),
        'INBOX.Trash': document.getElementById('trashCount'),
        'INBOX.Junk': document.getElementById('junkCount')
    };
    
    Object.entries(countElements).forEach(([folder, element]) => {
        if (element && AppState.folderStats[folder]) {
            const count = AppState.folderStats[folder].messages;
            
            console.log(`Folder ${folder}: ${count} messages`);
            
            // Mostrar contador siempre
            element.style.display = 'inline-block';
            element.textContent = count;
            
            // Destacar carpetas con emails no leídos
            if (AppState.folderStats[folder].unseen > 0) {
                element.style.background = '#ef4444';
                element.style.color = 'white';
            } else {
                element.style.background = '#374151';
                element.style.color = '#9ca3af';
            }
        }
    });
}

/**
 * Cambiar carpeta activa
 */
async function switchFolder(folderName) {
    if (AppState.isLoading) return;
    
    // Actualizar UI de navegación
    document.querySelectorAll('.folder-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Buscar el tab correspondiente al folder
    const targetTab = document.querySelector(`.folder-tab[onclick*="switchFolder('${folderName}')"]`);
    if (targetTab) {
        targetTab.classList.add('active');
    } else {
        console.warn(`No se encontró el tab para la carpeta: ${folderName}`);
    }
    
    // Actualizar título
    const titleElement = document.getElementById('currentFolderTitle');
    const titleElementMobile = document.getElementById('currentFolderTitleMobile');
    if (titleElement && FOLDERS[folderName]) {
        titleElement.textContent = `${FOLDERS[folderName].icon} ${FOLDERS[folderName].name}`;
    }
    if (titleElementMobile && FOLDERS[folderName]) {
        titleElementMobile.textContent = `${FOLDERS[folderName].icon} ${FOLDERS[folderName].name}`;
    }
    
    // Cambiar carpeta actual y cargar emails
    AppState.currentFolder = folderName;
    await loadEmails(folderName);
    
    // Actualizar estadísticas después de cambiar de carpeta
    if (AppState.userCredentials) {
        await loadFolderStats();
    }
}

/**
 * Cargar emails de una carpeta específica
 */
async function loadEmails(folderName) {
    try {
        // Verificar credenciales
        if (!AppState.userCredentials) {
            console.log('❌ No hay credenciales para cargar emails');
            showNotification('Sesión expirada. Redirigiendo al login...', 'error');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
            return;
        }
        
        // Verificar cache
        const cacheKey = `${folderName}_${AppState.currentPage}`;
        if (AppState.emailCache && AppState.emailCache[cacheKey]) {
            const cacheData = AppState.emailCache[cacheKey];
            const cacheAge = Date.now() - cacheData.timestamp;
            
            // Usar cache si es menor a 5 minutos
            if (cacheAge < 5 * 60 * 1000) {
                console.log('📦 Usando cache de emails para', folderName);
                AppState.emails = cacheData.emails;
                AppState.totalEmails = cacheData.totalEmails;
                AppState.currentFolder = folderName;
                
                // Extraer contactos para autocompletado
                extractContactsFromEmails(cacheData.emails);
                
                // Actualizar paginación
                updatePaginationControls();
                
                renderEmails();
                hideLoading(); // Asegurar que se oculte el loading
                return;
            } else {
                console.log('🗑️ Cache expirado para', folderName, 'edad:', Math.round(cacheAge / 1000), 'segundos');
            }
        }
        
        AppState.isLoading = true;
        showLoading();
        
        const response = await fetch(`/api/emails/${folderName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(AppState.userCredentials)
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Ordenar emails por fecha (más recientes primero)
            const sortedEmails = data.emails.sort((a, b) => new Date(b.date) - new Date(a.date));
            AppState.emails = sortedEmails;
            AppState.totalEmails = data.emails.length;
            AppState.currentFolder = folderName;
            
            // Guardar en cache
            if (!AppState.emailCache) {
                AppState.emailCache = {};
            }
            AppState.emailCache[cacheKey] = {
                emails: sortedEmails,
                totalEmails: data.emails.length,
                timestamp: Date.now()
            };
            
            // Limpiar cache antiguo (más de 5 minutos)
            const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
            Object.keys(AppState.emailCache).forEach(key => {
                if (AppState.emailCache[key].timestamp < fiveMinutesAgo) {
                    delete AppState.emailCache[key];
                }
            });
            
            // Extraer contactos para autocompletado
            extractContactsFromEmails(data.emails);
            
            // Actualizar paginación
            updatePaginationControls();
            
            // Log para depuración
            console.log('Emails recibidos:', data.emails);
            if (data.emails.length > 0) {
                console.log('Primer email:', data.emails[0]);
                console.log('From type:', typeof data.emails[0].from);
                console.log('To type:', typeof data.emails[0].to);
            }
            
            renderEmails();
        } else {
            showNotification(data.error || 'Error al cargar emails', 'error');
        }
        
    } catch (error) {
        console.error('Error al cargar emails:', error);
        showNotification('Error de conexión al cargar emails', 'error');
    } finally {
        AppState.isLoading = false;
        hideLoading();
    }
}

/**
 * Mostrar estado de carga
 */
function showLoading() {
    console.log('⏳ showLoading() called');
    AppState.isLoading = true;
    const content = document.getElementById('emailListContent');
    if (content) {
        console.log('📝 Mostrando loading en emailListContent');
        content.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                Cargando emails...
            </div>
        `;
    } else {
        console.log('❌ emailListContent no encontrado');
    }
}

/**
 * Ocultar estado de carga
 */
function hideLoading() {
    console.log('🔄 hideLoading() called');
    AppState.isLoading = false;
    // El contenido se actualiza en renderEmails()
}

/**
 * Renderizar lista de emails
 */
function renderEmails() {
    console.log('renderEmails called with', AppState.emails.length, 'emails');
    
    const content = document.getElementById('emailListContent');
    if (!content) {
        console.error('emailListContent element not found!');
        console.log('Available elements:', document.querySelectorAll('[id*="email"]'));
        
        // Fallback: buscar el contenedor de emails
        const emailList = document.getElementById('emailList');
        if (emailList) {
            console.log('Found emailList, creating content div');
            const newContent = document.createElement('div');
            newContent.id = 'emailListContent';
            emailList.appendChild(newContent);
            return renderEmails(); // Recursión para intentar de nuevo
        }
        return;
    }
    
    console.log('Found emailListContent element:', content);
    
    if (AppState.emails.length === 0) {
        console.log('No emails to render, showing empty state');
        content.innerHTML = `
            <div class="loading">
                <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
                No hay emails en esta carpeta
            </div>
        `;
        return;
    }
    
    console.log('Rendering', AppState.emails.length, 'emails');
    
                const emailsHTML = AppState.emails.map(email => {
                    const hasAttachments = email.attachments && email.attachments.length > 0;
                    const attachmentIcon = hasAttachments ? `📎` : '';
                    const fromName = extractEmailName(email.from);
                    const fromEmail = extractEmailAddress(email.from);
                    
                    // Crear resumen del contenido del email
                    let emailPreview = extractEmailSnippet(email);
                    
                    // Detectar si es móvil o web
                    const isMobile = window.innerWidth <= 768;
                    
                    if (isMobile) {
                        // Layout móvil optimizado - Grid 2x3
                        return `
                        <div class="email-item email-item-mobile ${!email.seen ? 'unread' : ''}" onclick="openEmail(${email.uid})">
                            <!-- Fila superior: correo | fecha -->
                            <div class="email-top-row">
                                <div class="email-from-mobile">${fromEmail}</div>
                                <div class="email-date-mobile">${formatDate(email.date)}</div>
                            </div>
                            
                            <!-- Fila media: asunto | adjuntos -->
                            <div class="email-middle-row">
                                <div class="email-subject-mobile ${!email.seen ? 'unread' : ''}">
                                    ${email.subject || '(Sin asunto)'}
                                    ${!email.seen ? '<span class="unread-indicator">●</span>' : ''}
                                </div>
                                <div class="email-attachment-mobile">
                                    ${hasAttachments ? `${attachmentIcon} ${email.attachments.length}` : ''}
                                </div>
                            </div>
                            
                            <!-- Fila inferior: contenido | acciones -->
                            <div class="email-bottom-row">
                                <div class="email-preview-mobile">${emailPreview}</div>
                                <div class="email-actions-mobile" onclick="event.stopPropagation()">
                                    <button class="action-btn ai-btn" onclick="suggestAIResponse(${email.uid})" title="IA">
                                        🤖
                                    </button>
                                    <button class="action-btn star-btn" onclick="markAsImportant(${email.uid})" title="⭐">
                                        ⭐
                                    </button>
                                    <button class="action-btn delete-btn" onclick="deleteEmail(${email.uid})" title="🗑️">
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                    } else {
                        // Layout web con tabla
                        return `
                        <div class="email-item ${!email.seen ? 'unread' : ''}" onclick="openEmail(${email.uid})">
                            <div class="email-checkbox">
                                <input type="checkbox" onchange="toggleEmailSelection(${email.uid}, this.checked)">
                            </div>
                            <div class="email-from">
                                <div class="sender-avatar">${fromName.charAt(0).toUpperCase()}</div>
                                <div class="sender-name">${fromEmail}</div>
                            </div>
                            <div class="email-content-preview">
                                <div class="email-subject ${!email.seen ? 'unread' : ''}">
                                    ${email.subject || '(Sin asunto)'}
                                    ${!email.seen ? '<span class="unread-indicator">●</span>' : ''}
                                </div>
                            </div>
                            <div class="email-attachment">
                                ${attachmentIcon}
                            </div>
                            <div class="email-date">${formatDate(email.date)}</div>
                            <div class="email-actions" onclick="event.stopPropagation()">
                                <button class="action-btn ai-btn" onclick="suggestAIResponse(${email.uid})" title="Sugerir respuesta con IA">
                                    🤖
                                </button>
                                <button class="action-btn star-btn" onclick="markAsImportant(${email.uid})" title="Marcar">
                                    ⭐
                                </button>
                                <button class="action-btn delete-btn" onclick="deleteEmail(${email.uid})" title="Eliminar">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    `;
                    }
                }).join('');
    
    console.log('Generated HTML length:', emailsHTML.length);
    console.log('Setting innerHTML on content element');
    
    content.innerHTML = emailsHTML;
    
    console.log('Emails rendered successfully');
}

/**
 * Formatear dirección de email para mostrar
 */
function formatEmailAddress(address) {
    if (!address) return '';
    
    // Si ya es un string, devolverlo tal como está
    if (typeof address === 'string') {
        return address;
    }
    
    // Si es un array, tomar el primer elemento
    if (Array.isArray(address)) {
        const firstElement = address[0];
        if (typeof firstElement === 'string') {
            return firstElement;
        }
        if (typeof firstElement === 'object' && firstElement !== null) {
            const name = firstElement.name || '';
            const email = firstElement.address || firstElement.email || '';
            return name && email ? `${name} <${email}>` : (email || name || String(firstElement));
        }
        return String(firstElement);
    }
    
    // Si es un objeto, extraer propiedades
    if (typeof address === 'object' && address !== null) {
        const name = address.name || '';
        const email = address.address || address.email || '';
        return name && email ? `${name} <${email}>` : (email || name || String(address));
    }
    
    return String(address);
}

/**
 * Extraer solo el nombre del email para mostrar en la lista
 */
function extractEmailName(address) {
    if (!address) return '';
    
    const fullAddress = formatEmailAddress(address);
    
    // Si tiene formato "Nombre" <email@domain.com>, extraer solo el nombre
    const nameMatch = fullAddress.match(/^"([^"]+)"\s*<[^>]+>$/);
    if (nameMatch) {
        return nameMatch[1];
    }
    
    // Si tiene formato Nombre <email@domain.com>, extraer solo el nombre
    const nameMatch2 = fullAddress.match(/^([^<]+)\s*<[^>]+>$/);
    if (nameMatch2) {
        return nameMatch2[1].trim();
    }
    
    // Si es solo un email, extraer la parte antes del @
    const emailMatch = fullAddress.match(/^([^@]+)@/);
    if (emailMatch) {
        return emailMatch[1];
    }
    
    return fullAddress;
}

/**
 * Extraer dirección de email
 */
function extractEmailAddress(emailString) {
    if (!emailString) return 'desconocido@ejemplo.com';
    
    // Si contiene < y >, extraer el email
    const match = emailString.match(/<(.+?)>$/);
    if (match) {
        return match[1].trim();
    }
    
    // Si es solo un email, devolverlo tal como está
    if (emailString.includes('@')) {
        return emailString.trim();
    }
    
    return emailString;
}

/**
 * Sugerir respuesta con IA
 */
async function suggestAIResponse(uid) {
    try {
        console.log('🤖 Sugiriendo respuesta con IA para email:', uid);
        
        // Primero abrir el email
        const email = AppState.emails.find(e => e.uid === uid);
        if (!email) {
            showNotification('Email no encontrado', 'error');
            return;
        }
        
        // Abrir el modal del email
        await showEmailModal(email);
        
        // Mostrar modal de IA
        showAIResponseModal(email);
        
    } catch (error) {
        console.error('Error al sugerir respuesta con IA:', error);
        showNotification('Error al generar sugerencia de IA', 'error');
    }
}

/**
 * Mostrar modal de sugerencia de IA
 */
function showAIResponseModal(email) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'aiResponseModal';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
        <div class="modal ai-modal">
            <div class="modal-header">
                <div class="modal-title">🤖 Sugerir Respuesta con IA</div>
                <button class="modal-close" onclick="closeAIResponseModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="ai-email-info">
                    <h4>Respondiendo a:</h4>
                    <p><strong>De:</strong> ${email.from}</p>
                    <p><strong>Asunto:</strong> ${email.subject}</p>
                </div>
                <div class="ai-options">
                    <button class="ai-option-btn" onclick="generateAIResponse('${email.uid}', 'formal')">
                        📝 Respuesta Formal
                    </button>
                    <button class="ai-option-btn" onclick="generateAIResponse('${email.uid}', 'casual')">
                        😊 Respuesta Casual
                    </button>
                    <button class="ai-option-btn" onclick="generateAIResponse('${email.uid}', 'brief')">
                        ⚡ Respuesta Breve
                    </button>
                </div>
                <div class="ai-response" id="aiResponse" style="display: none;">
                    <h4>Respuesta sugerida:</h4>
                    <div class="ai-text" id="aiText"></div>
                    <div class="ai-actions">
                        <button class="btn btn-primary" onclick="useAIResponse()">Usar Respuesta</button>
                        <button class="btn btn-secondary" onclick="regenerateAIResponse()">Regenerar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/**
 * Generar respuesta con IA
 */
async function generateAIResponse(uid, style) {
    try {
        const email = AppState.emails.find(e => e.uid === uid);
        if (!email) {
            showNotification('Email no encontrado', 'error');
            return;
        }
        
        showNotification('🤖 Generando respuesta con IA...', 'info');
        
        // Llamar a la API de OpenAI
        const response = await fetch('/api/emails/ai-response', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                style: style
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Crear o actualizar el modal de respuesta IA
            let aiModal = document.getElementById('aiResponseModal');
            if (!aiModal) {
                aiModal = document.createElement('div');
                aiModal.id = 'aiResponseModal';
                aiModal.className = 'modal';
                aiModal.innerHTML = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>🤖 Respuesta Generada con IA</h3>
                            <button class="close-btn" onclick="closeAIResponseModal()">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div id="aiResponse" style="display: block;">
                                <div id="aiText" style="white-space: pre-wrap; padding: 16px; background: var(--bg-light); border-radius: 8px; margin: 16px 0;"></div>
                                <div class="ai-actions">
                                    <button class="btn btn-primary" onclick="useAIResponse()">Usar Respuesta</button>
                                    <button class="btn btn-secondary" onclick="regenerateAIResponse()">Regenerar</button>
                                    <button class="btn btn-secondary" onclick="closeAIResponseModal()">Cerrar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(aiModal);
            }
            
            const aiText = document.getElementById('aiText');
            const aiResponse = document.getElementById('aiResponse');
            
            if (aiText) aiText.textContent = data.response;
            if (aiResponse) aiResponse.style.display = 'block';
            
            // Guardar respuesta para usar después
            window.currentAIResponse = data.response;
            
            // Mostrar el modal
            aiModal.style.display = 'flex';
            
            showNotification('✅ Respuesta generada con IA', 'success');
            
        } else if (data.fallback) {
            // Usar respuestas predefinidas si OpenAI no está configurado
            const responses = {
                formal: `Estimado/a ${extractEmailName(email.from)},\n\nGracias por su mensaje del ${formatDate(email.date)}. He revisado su consulta y procederé a darle seguimiento en las próximas horas.\n\nQuedo atento a cualquier aclaración adicional.\n\nSaludos cordiales.`,
                casual: `¡Hola ${extractEmailName(email.from)}!\n\nGracias por tu mensaje. Te respondo para confirmar que recibí tu consulta y la estoy revisando.\n\nTe mantendré al tanto de cualquier novedad.\n\n¡Saludos!`,
                brief: `Hola ${extractEmailName(email.from)},\n\nRecibido. Te respondo pronto.\n\nSaludos.`
            };
            
            // Crear o actualizar el modal de respuesta IA
            let aiModal = document.getElementById('aiResponseModal');
            if (!aiModal) {
                aiModal = document.createElement('div');
                aiModal.id = 'aiResponseModal';
                aiModal.className = 'modal';
                aiModal.innerHTML = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>🤖 Respuesta Generada con IA</h3>
                            <button class="close-btn" onclick="closeAIResponseModal()">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div id="aiResponse" style="display: block;">
                                <div id="aiText" style="white-space: pre-wrap; padding: 16px; background: var(--bg-light); border-radius: 8px; margin: 16px 0;"></div>
                                <div class="ai-actions">
                                    <button class="btn btn-primary" onclick="useAIResponse()">Usar Respuesta</button>
                                    <button class="btn btn-secondary" onclick="regenerateAIResponse()">Regenerar</button>
                                    <button class="btn btn-secondary" onclick="closeAIResponseModal()">Cerrar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(aiModal);
            }
            
            const aiText = document.getElementById('aiText');
            const aiResponse = document.getElementById('aiResponse');
            
            if (aiText) aiText.textContent = responses[style];
            if (aiResponse) aiResponse.style.display = 'block';
            
            window.currentAIResponse = responses[style];
            
            // Mostrar el modal
            aiModal.style.display = 'flex';
            
            showNotification('⚠️ Usando respuesta predefinida (OpenAI no configurado)', 'warning');
        } else {
            throw new Error(data.error || 'Error desconocido');
        }
        
    } catch (error) {
        console.error('Error generando respuesta con IA:', error);
        showNotification('Error al generar respuesta con IA: ' + error.message, 'error');
    }
}

/**
 * Usar respuesta de IA
 */
function useAIResponse() {
    if (window.currentAIResponse) {
        // Abrir composer con la respuesta de IA
        showComposer();
        
        // Llenar el campo de mensaje con la respuesta de IA
        setTimeout(() => {
            const messageField = document.getElementById('composerMessage');
            if (messageField) {
                messageField.value = window.currentAIResponse;
            }
        }, 500);
        
        closeAIResponseModal();
        showNotification('✅ Respuesta de IA cargada en el composer', 'success');
    }
}

/**
 * Regenerar respuesta de IA
 */
function regenerateAIResponse() {
    const aiResponse = document.getElementById('aiResponse');
    aiResponse.style.display = 'none';
    showNotification('🔄 Regenerando respuesta...', 'info');
}

/**
 * Cerrar modal de IA
 */
function closeAIResponseModal() {
    const modal = document.getElementById('aiResponseModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Toggle CC/CCO fields
 */
function toggleCcBcc() {
    console.log('toggleCcBcc called');
    try {
        const ccBccGroup = document.getElementById('ccBccGroup');
        const ccBccGroup2 = document.getElementById('ccBccGroup2');
        const toggleBtn = document.getElementById('toggleCcBcc');
        
        console.log('Elements found:', { ccBccGroup, ccBccGroup2, toggleBtn });
        
        if (!ccBccGroup || !ccBccGroup2 || !toggleBtn) {
            console.error('Elements not found:', { ccBccGroup, ccBccGroup2, toggleBtn });
            return;
        }
        
        if (ccBccGroup.style.display === 'none' || ccBccGroup.style.display === '') {
            ccBccGroup.style.display = 'flex';
            ccBccGroup2.style.display = 'flex';
            toggleBtn.textContent = '- CC, CCO';
            console.log('CC/CCO fields shown');
        } else {
            ccBccGroup.style.display = 'none';
            ccBccGroup2.style.display = 'none';
            toggleBtn.textContent = '+ CC, CCO';
            console.log('CC/CCO fields hidden');
        }
    } catch (error) {
        console.error('Error in toggleCcBcc:', error);
    }
}

// Asegurar que la función esté disponible globalmente
window.toggleCcBcc = toggleCcBcc;

// También asegurar que esté disponible en el scope global
if (typeof window !== 'undefined') {
    window.toggleCcBcc = toggleCcBcc;
}

// Función alternativa para asegurar disponibilidad
function toggleCcBccAlternative() {
    console.log('toggleCcBccAlternative called');
    try {
        const ccBccGroup = document.getElementById('ccBccGroup');
        const ccBccGroup2 = document.getElementById('ccBccGroup2');
        const toggleBtn = document.getElementById('toggleCcBcc');
        
        console.log('Elements found:', { ccBccGroup, ccBccGroup2, toggleBtn });
        
        if (!ccBccGroup || !ccBccGroup2 || !toggleBtn) {
            console.error('Elements not found:', { ccBccGroup, ccBccGroup2, toggleBtn });
            return;
        }
        
        if (ccBccGroup.style.display === 'none' || ccBccGroup.style.display === '') {
            ccBccGroup.style.display = 'flex';
            ccBccGroup2.style.display = 'flex';
            toggleBtn.textContent = '- CC, CCO';
            console.log('CC/CCO fields shown');
        } else {
            ccBccGroup.style.display = 'none';
            ccBccGroup2.style.display = 'none';
            toggleBtn.textContent = '+ CC, CCO';
            console.log('CC/CCO fields hidden');
        }
    } catch (error) {
        console.error('Error in toggleCcBccAlternative:', error);
    }
}

// Asignar también la función alternativa
window.toggleCcBccAlternative = toggleCcBccAlternative;

/**
 * Extraer contactos de emails para autocompletado
 */
function extractContactsFromEmails(emails) {
    emails.forEach(email => {
        // Extraer del campo 'from'
        if (email.from) {
            const fromAddress = formatEmailAddress(email.from);
            if (fromAddress && fromAddress.includes('@')) {
                AppState.emailContacts.add(fromAddress);
            }
        }
        
        // Extraer del campo 'to'
        if (email.to) {
            const toAddress = formatEmailAddress(email.to);
            if (toAddress && toAddress.includes('@')) {
                AppState.emailContacts.add(toAddress);
            }
        }
    });
}

/**
 * Inicializar autocompletado para un campo de input
 */
function initAutocomplete(inputId, dropdownId) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    
    if (!input || !dropdown) return;
    
    let timeoutId;
    
    input.addEventListener('input', (e) => {
        clearTimeout(timeoutId);
        const query = e.target.value.toLowerCase().trim();
        
        if (query.length < 2) {
            dropdown.style.display = 'none';
            return;
        }
        
        timeoutId = setTimeout(() => {
            const matches = Array.from(AppState.emailContacts)
                .filter(contact => contact.toLowerCase().includes(query))
                .slice(0, 10); // Limitar a 10 resultados
            
            if (matches.length > 0) {
                dropdown.innerHTML = matches.map(contact => {
                    const name = extractEmailName(contact);
                    const email = contact.match(/<([^>]+)>/) ? contact.match(/<([^>]+)>/)[1] : contact;
                    return `
                        <div class="autocomplete-item" onclick="selectAutocomplete('${inputId}', '${contact}')">
                            <div class="autocomplete-email">${email}</div>
                            ${name !== email ? `<div class="autocomplete-name">${name}</div>` : ''}
                        </div>
                    `;
                }).join('');
                dropdown.style.display = 'block';
            } else {
                dropdown.style.display = 'none';
            }
        }, 200);
    });
    
    // Ocultar dropdown al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

/**
 * Seleccionar un elemento del autocompletado
 */
function selectAutocomplete(inputId, contact) {
    const input = document.getElementById(inputId);
    let dropdown;
    
    if (inputId === 'composerTo') {
        dropdown = document.getElementById('autocompleteDropdown');
    } else if (inputId === 'composerCc') {
        dropdown = document.getElementById('autocompleteDropdownCc');
    } else if (inputId === 'composerBcc') {
        dropdown = document.getElementById('autocompleteDropdownBcc');
    }
    
    if (input) {
        // Extraer solo el email si tiene formato "Nombre" <email@domain.com>
        const emailMatch = contact.match(/<([^>]+)>/);
        const email = emailMatch ? emailMatch[1] : contact;
        input.value = email;
    }
    
    if (dropdown) {
        dropdown.style.display = 'none';
    }
}

/**
 * Inicializar manejo de adjuntos
 */
function initAttachmentHandler() {
    const attachmentInput = document.getElementById('attachmentInput');
    const attachmentList = document.getElementById('attachmentList');
    
    if (!attachmentInput || !attachmentList) return;
    
    // Limpiar lista de adjuntos
    attachmentList.innerHTML = '';
    
    attachmentInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        
        files.forEach(file => {
            // Verificar tamaño (máximo 10MB)
            if (file.size > 10 * 1024 * 1024) {
                showNotification(`El archivo ${file.name} es demasiado grande (máximo 10MB)`, 'error');
                return;
            }
            
            // Crear elemento de adjunto
            const attachmentItem = document.createElement('div');
            attachmentItem.className = 'attachment-item';
            attachmentItem.innerHTML = `
                <div class="attachment-info">
                    <span>📎</span>
                    <span>${file.name}</span>
                    <span style="color: var(--text-light); font-size: 11px;">(${(file.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button type="button" class="attachment-remove" onclick="removeAttachment(this, '${file.name}')">
                    ✕
                </button>
            `;
            
            attachmentList.appendChild(attachmentItem);
        });
    });
}

/**
 * Remover adjunto
 */
function removeAttachment(button, fileName) {
    const attachmentItem = button.closest('.attachment-item');
    attachmentItem.remove();
    
    // Actualizar el input file
    const attachmentInput = document.getElementById('attachmentInput');
    if (attachmentInput) {
        attachmentInput.value = '';
    }
}

/**
 * Convertir archivo a base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Remover el prefijo "data:image/jpeg;base64," y devolver solo el base64
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

// ===== FUNCIONES DE PERFIL =====

/**
 * Mostrar modal de configuración de perfil
 */
async function showProfileSettings() {
    const modal = document.getElementById('profileModal');
    modal.style.display = 'flex';
    
    // Cargar perfil actual
    await loadUserProfile();
}

/**
 * Cerrar modal de perfil
 */
function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    modal.style.display = 'none';
}

/**
 * Cargar perfil del usuario
 */
async function loadUserProfile() {
    try {
        if (!AppState.userCredentials) {
            showNotification('Credenciales requeridas', 'error');
            return;
        }

        const response = await fetch(`/api/profile?email=${AppState.userCredentials.email}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();

        if (data.success) {
            AppState.userProfile = data.profile;
            populateProfileForm(data.profile);
        } else {
            showNotification('Error al cargar perfil', 'error');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showNotification('Error de conexión al cargar perfil', 'error');
    }
}

/**
 * Llenar formulario con datos del perfil
 */
function populateProfileForm(profile) {
    document.getElementById('profileName').value = profile.name || '';
    document.getElementById('signatureEnabled').checked = profile.signatureEnabled || false;
    
    toggleSignatureOptions();
    
    // Mostrar imagen de firma si existe
    if (profile.signatureImage) {
        const preview = document.getElementById('signaturePreview');
        const previewImg = document.getElementById('signaturePreviewImg');
        previewImg.src = `/api/profile/signature/${AppState.userCredentials.email}`;
        preview.style.display = 'block';
    }
}

/**
 * Alternar opciones de firma
 */
function toggleSignatureOptions() {
    const enabled = document.getElementById('signatureEnabled').checked;
    const options = document.getElementById('signatureOptions');
    options.style.display = enabled ? 'block' : 'none';
}

/**
 * Vista previa de imagen de firma
 */
function previewSignatureImage() {
    const fileInput = document.getElementById('signatureImage');
    const preview = document.getElementById('signaturePreview');
    const previewImg = document.getElementById('signaturePreviewImg');
    
    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(fileInput.files[0]);
    }
}

/**
 * Eliminar imagen de firma
 */
function removeSignatureImage() {
    document.getElementById('signatureImage').value = '';
    document.getElementById('signaturePreview').style.display = 'none';
}

/**
 * Guardar perfil
 */
async function saveProfile() {
    try {
        if (!AppState.userCredentials) {
            showNotification('Credenciales requeridas', 'error');
            return;
        }

        const profileData = {
            name: document.getElementById('profileName').value.trim(),
            signatureEnabled: document.getElementById('signatureEnabled').checked
        };
        
        // Validar que se ingrese el nombre
        if (!profileData.name) {
            showNotification('Por favor ingresa tu nombre', 'error');
            return;
        }

        // Subir imagen de firma si se seleccionó
        const signatureFile = document.getElementById('signatureImage').files[0];
        if (signatureFile) {
            const imageData = await fileToBase64(signatureFile);
            const signatureResponse = await fetch('/api/profile/signature', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: AppState.userCredentials.email,
                    imageData: `data:${signatureFile.type};base64,${imageData}`,
                    filename: signatureFile.name
                })
            });

            const signatureResult = await signatureResponse.json();
            if (signatureResult.success) {
                profileData.signatureImage = signatureResult.filename;
            }
        }

        // Guardar perfil
        const response = await fetch('/api/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: AppState.userCredentials.email,
                profile: profileData
            })
        });

        const data = await response.json();

        if (data.success) {
            AppState.userProfile = profileData;
            showNotification('Perfil guardado exitosamente', 'success');
            closeProfileModal();
        } else {
            showNotification(data.error || 'Error al guardar perfil', 'error');
        }
    } catch (error) {
        console.error('Error saving profile:', error);
        showNotification('Error de conexión al guardar perfil', 'error');
    }
}

/**
 * Formatear fecha para mostrar
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        return 'Hoy';
    } else if (diffDays === 2) {
        return 'Ayer';
    } else if (diffDays <= 7) {
        return `${diffDays - 1}d`;
    } else {
        return date.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: '2-digit' 
        });
    }
}

/**
 * Formatear fecha completa (dd/mm/yyyy)
 */
function formatDateFull(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        return date.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    } else if (diffDays === 2) {
        return 'Ayer';
    } else if (diffDays <= 7) {
        return date.toLocaleDateString('es-ES', { 
            weekday: 'short',
            hour: '2-digit', 
            minute: '2-digit' 
        });
    } else {
        return date.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: '2-digit',
            year: '2-digit'
        });
    }
}

/**
 * Extraer snippet del contenido del email
 */
function extractEmailSnippet(email) {
    let content = '';
    
    // Priorizar contenido de texto plano
    if (email.text && email.text.trim()) {
        content = email.text.trim();
    } else if (email.html && email.html.trim()) {
        // Remover tags HTML para obtener texto plano
        content = email.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    } else if (email.body && email.body.trim()) {
        content = email.body.trim();
    } else if (email.content && email.content.trim()) {
        content = email.content.trim();
    }
    
    // Limpiar y truncar contenido
    if (content && content.length > 0) {
        // Remover saltos de línea y espacios múltiples
        content = content.replace(/\s+/g, ' ').trim();
        
        // Limpiar caracteres especiales pero mantener acentos y puntuación
        content = content.replace(/[^\w\s\.,!?áéíóúñüÁÉÍÓÚÑÜ@\-]/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Si después de limpiar no queda nada, usar mensaje alternativo
        if (content.length === 0) {
            return '📄 Email sin contenido de texto';
        }
        
        // Truncar a 100 caracteres máximo para móvil
        if (content.length > 100) {
            content = content.substring(0, 97) + '...';
        }
        
        return content;
    }
    
    // Si no hay contenido, mostrar información útil
    if (email.attachments && email.attachments.length > 0) {
        return `📎 ${email.attachments.length} adjunto${email.attachments.length > 1 ? 's' : ''}`;
    }
    
    if (email.subject && email.subject.toLowerCase().includes('adjunto')) {
        return '📎 Email con adjuntos';
    }
    
    return '📄 Email sin contenido de texto';
}

/**
 * Abrir email en modal
 */
async function openEmail(uid) {
    try {
        console.log('📧 openEmail() called with uid:', uid);
        console.log('📊 AppState.isLoading:', AppState.isLoading);
        console.log('📊 AppState.emails.length:', AppState.emails ? AppState.emails.length : 'null');
        
        // Verificar credenciales
        if (!AppState.userCredentials) {
            console.log('❌ No hay credenciales para cargar emails');
            showNotification('Sesión expirada. Redirigiendo al login...', 'error');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
            return;
        }
        
        // Optimización: usar cache si el email ya está cargado
        const email = AppState.emails.find(e => e.uid === uid);
        if (email && email.fullContent) {
            console.log('📦 Email encontrado en cache, mostrando modal');
            showEmailModal(email.fullContent);
            // Asegurar que no esté en estado de loading
            if (AppState.isLoading) {
                console.log('🔄 Email desde cache: quitando estado de loading');
                hideLoading();
                // Re-renderizar emails para quitar el loading visualmente
                console.log('🔄 Llamando a renderEmails() desde cache');
                renderEmails();
            }
            return;
        }
        
        console.log('🔄 Email no está en cache, cargando desde servidor...');
        showLoading();
        
        const response = await fetch(`/api/emails/${AppState.currentFolder}/${uid}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(AppState.userCredentials)
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Email cargado exitosamente desde servidor');
            // Guardar contenido completo en cache
            if (email) {
                email.fullContent = data.email;
                console.log('💾 Email guardado en cache local');
            }
            showEmailModal(data.email);
        } else {
            console.log('❌ Error al cargar email:', data.error);
            showNotification(data.error || 'Error al cargar email', 'error');
        }
        
        console.log('🔄 hideLoading() llamado al final de openEmail');
        hideLoading();
        // Re-renderizar emails para quitar el loading visualmente
        console.log('🔄 Llamando a renderEmails() para quitar loading visual');
        renderEmails();
        
    } catch (error) {
        console.error('❌ Error al abrir email:', error);
        showNotification('Error al cargar email', 'error');
        console.log('🔄 hideLoading() llamado en catch de openEmail');
        hideLoading();
        // Re-renderizar emails para quitar el loading visualmente
        console.log('🔄 Llamando a renderEmails() desde catch');
        renderEmails();
    }
}

/**
 * Mostrar modal de email
 */
function showEmailModal(email) {
    const modal = document.getElementById('emailModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    
    // Log para depuración del modal
    console.log('Email en modal:', email);
    console.log('From en modal:', email.from, 'Type:', typeof email.from);
    console.log('To en modal:', email.to, 'Type:', typeof email.to);
    console.log('formatEmailAddress(from):', formatEmailAddress(email.from));
    console.log('formatEmailAddress(to):', formatEmailAddress(email.to));
    
    if (title) {
        title.textContent = email.subject || '(Sin asunto)';
    }
    
    if (body) {
        const fromFormatted = formatEmailAddress(email.from);
        const toFormatted = formatEmailAddress(email.to);
        
        // Log para depuración del HTML generado
        console.log('From formateado:', fromFormatted);
        console.log('To formateado:', toFormatted);
        
        body.innerHTML = `
            <div class="email-details">
                <!-- Encabezados del Email -->
                <div class="email-meta">
                    <div class="meta-row">
                        <span class="meta-label">De:</span>
                        <span class="meta-value">${fromFormatted}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-label">Para:</span>
                        <span class="meta-value">${toFormatted}</span>
                    </div>
                    ${email.cc ? `
                    <div class="meta-row">
                        <span class="meta-label">CC:</span>
                        <span class="meta-value">${formatEmailAddress(email.cc)}</span>
                    </div>
                    ` : ''}
                    <div class="meta-row">
                        <span class="meta-label">Fecha:</span>
                        <span class="meta-value">${new Date(email.date).toLocaleString('es-ES')}</span>
                    </div>
                </div>
                
                <!-- Contenido del Email + Adjuntos -->
                <div class="email-content-wrapper">
                    <div class="email-content">
                        ${email.html ? 
                            `<div class="email-html-content">${email.html}</div>` : 
                            (email.text ? 
                                `<div class="email-text-content">${email.text.replace(/\n/g, '<br>')}</div>` : 
                                '<div class="no-content">Sin contenido disponible</div>'
                            )
                        }
                    </div>
                    
                    ${email.attachments && email.attachments.length > 0 ? `
                    <div class="email-attachments-section">
                        <div class="attachments-header">
                            <h3>📎 Adjuntos (${email.attachments.length})</h3>
                        </div>
                        <div class="attachments-grid">
                            ${email.attachments.map((att, index) => `
                                <div class="attachment-card">
                                    ${isImageAttachment(att.contentType) ? `
                                        <div class="attachment-preview">
                                            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ctext x='50%25' y='50%25' font-size='40' text-anchor='middle' dy='.3em'%3E⏳%3C/text%3E%3C/svg%3E" 
                                                 alt="${att.filename}"
                                                 onclick="viewAttachmentFullscreen(${email.uid}, ${index}, '${att.filename}')"
                                                 style="cursor: pointer;"
                                                 loading="lazy">
                                        </div>
                                    ` : `
                                        <div class="attachment-icon">
                                            ${getFileIcon(att.filename)}
                                        </div>
                                    `}
                                    <div class="attachment-info">
                                        <div class="attachment-name" title="${att.filename}">${att.filename}</div>
                                        <div class="attachment-size">${formatFileSize(att.size)}</div>
                                    </div>
                                    <button onclick="downloadAttachment(${email.uid}, ${index}, '${att.filename}')" 
                                            class="attachment-download-btn-card" 
                                            title="Descargar ${att.filename}">
                                        ⬇️ Descargar
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    // Guardar email actual para respuesta
    AppState.currentEmail = email;
    
    console.log('📱 Mostrando modal de email');
    modal.style.display = 'flex';
    console.log('✅ Modal mostrado, display:', modal.style.display);
    
    // Pre-cargar vistas previas de imágenes adjuntas
    if (email.attachments && email.attachments.length > 0) {
        email.attachments.forEach(async (att, index) => {
            if (isImageAttachment(att.contentType)) {
                try {
                    const response = await fetch(`/api/emails/${AppState.currentFolder}/${email.uid}/attachment/${index}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(AppState.userCredentials)
                    });
                    
                    if (response.ok) {
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        
                        // Actualizar la imagen en el modal
                        const imgElement = modal.querySelector(`img[alt="${att.filename}"]`);
                        if (imgElement) {
                            imgElement.src = url;
                            imgElement.dataset.blobUrl = url; // Guardar para limpiar después
                        }
                    }
                } catch (error) {
                    console.error('Error loading image preview:', error);
                }
            }
        });
    }
}

/**
 * Cerrar modal de email
 */
function closeEmailModal() {
    console.log('🚪 closeEmailModal() called');
    console.log('🔍 Stack trace:', new Error().stack);
    const modal = document.getElementById('emailModal');
    
    // Limpiar URLs de blob de imágenes para liberar memoria
    const images = modal.querySelectorAll('img[data-blob-url]');
    images.forEach(img => {
        if (img.dataset.blobUrl) {
            window.URL.revokeObjectURL(img.dataset.blobUrl);
        }
    });
    
    modal.style.display = 'none';
    AppState.currentEmail = null;
}

/**
 * Responder a email
 */
function replyToEmail() {
    if (!AppState.currentEmail) return;
    
    const composerModal = document.getElementById('composerModal');
    const toInput = document.getElementById('composerTo');
    const subjectInput = document.getElementById('composerSubject');
    
    // Pre-llenar campos de respuesta
    if (toInput) {
        // Extraer solo la dirección de email del string formateado
        let fromAddress = '';
        if (typeof AppState.currentEmail.from === 'string') {
            // Si tiene formato "Nombre" <email@domain.com>, extraer solo el email
            const emailMatch = AppState.currentEmail.from.match(/<([^>]+)>/);
            if (emailMatch) {
                fromAddress = emailMatch[1]; // Extraer solo el email
            } else {
                fromAddress = AppState.currentEmail.from; // Usar tal como está
            }
        } else if (AppState.currentEmail.from && AppState.currentEmail.from.address) {
            fromAddress = AppState.currentEmail.from.address;
        } else if (AppState.currentEmail.from) {
            fromAddress = String(AppState.currentEmail.from);
        }
        toInput.value = fromAddress;
    }
    
    if (subjectInput) {
        const originalSubject = AppState.currentEmail.subject || '';
        subjectInput.value = originalSubject.startsWith('Re: ') 
            ? originalSubject 
            : `Re: ${originalSubject}`;
    }
    
    // Cerrar modal de email y abrir composer
    closeEmailModal();
    composerModal.style.display = 'flex';
}

/**
 * Mostrar composer de email
 */
function showComposer() {
    const modal = document.getElementById('composerModal');
    modal.style.display = 'flex';
    
    // Limpiar formulario
    document.getElementById('composerForm').reset();
    
    // Inicializar autocompletado
    initAutocomplete('composerTo', 'autocompleteDropdown');
    initAutocomplete('composerCc', 'autocompleteDropdownCc');
    initAutocomplete('composerBcc', 'autocompleteDropdownBcc');
    
    // Inicializar manejo de adjuntos
    initAttachmentHandler();
}

/**
 * Cerrar composer
 */
async function closeComposer() {
    const to = document.getElementById('composerTo').value.trim();
    const subject = document.getElementById('composerSubject').value.trim();
    const message = document.getElementById('composerMessage').value.trim();
    
    // Si hay contenido, preguntar si guardar como borrador
    if (to || subject || message) {
        const save = confirm('¿Deseas guardar este correo como borrador?');
        if (save) {
            await saveDraft();
            return;
        }
    }
    
    // Limpiar y cerrar
    document.getElementById('composerForm').reset();
    const modal = document.getElementById('composerModal');
    modal.style.display = 'none';
}

/**
 * Guardar email como borrador
 */
async function saveDraft() {
    try {
        // Verificar credenciales
        if (!AppState.userCredentials) {
            console.log('❌ No hay credenciales para cargar emails');
            showNotification('Sesión expirada. Redirigiendo al login...', 'error');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
            return;
        }
        
        const to = document.getElementById('composerTo').value.trim();
        const cc = document.getElementById('composerCc').value.trim();
        const bcc = document.getElementById('composerBcc').value.trim();
        const subject = document.getElementById('composerSubject').value.trim() || '(Sin asunto)';
        const message = document.getElementById('composerMessage').value.trim();
        
        showNotification('Guardando borrador...', 'info');
        
        const response = await fetch('/api/emails/save-draft', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...AppState.userCredentials,
                to,
                cc,
                bcc,
                subject,
                text: message,
                html: `<p>${message.replace(/\n/g, '<br>')}</p>`
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Borrador guardado exitosamente', 'success');
            
            // Limpiar y cerrar
            document.getElementById('composerForm').reset();
            const modal = document.getElementById('composerModal');
            modal.style.display = 'none';
            
            // Si estamos en Borradores, recargar
            if (AppState.currentFolder === 'INBOX.Drafts') {
                await loadEmails(AppState.currentFolder);
            }
        } else {
            showNotification(data.error || 'Error al guardar borrador', 'error');
        }
    } catch (error) {
        console.error('Error guardando borrador:', error);
        showNotification('Error al guardar borrador', 'error');
    }
}

/**
 * Enviar email
 */
async function sendEmail() {
    try {
        const to = document.getElementById('composerTo').value.trim();
        const cc = document.getElementById('composerCc').value.trim();
        const bcc = document.getElementById('composerBcc').value.trim();
        const subject = document.getElementById('composerSubject').value.trim();
        const message = document.getElementById('composerMessage').value.trim();
        const attachmentInput = document.getElementById('attachmentInput');
        
        // Validaciones básicas
        if (!to || !subject || !message) {
            showNotification('Por favor completa todos los campos requeridos', 'error');
            return;
        }
        
        // Verificar credenciales
        if (!AppState.userCredentials) {
            console.log('❌ No hay credenciales para cargar emails');
            showNotification('Sesión expirada. Redirigiendo al login...', 'error');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
            return;
        }
        
        // Procesar adjuntos
        const attachments = [];
        if (attachmentInput && attachmentInput.files.length > 0) {
            for (let i = 0; i < attachmentInput.files.length; i++) {
                const file = attachmentInput.files[i];
                const base64 = await fileToBase64(file);
                attachments.push({
                    filename: file.name,
                    content: base64,
                    contentType: file.type
                });
            }
        }

        const emailData = {
            to: to,
            cc: cc,
            bcc: bcc,
            subject: subject,
            text: message,
            html: message.replace(/\n/g, '<br>'),
            attachments: attachments
        };
        
        const response = await fetch('/api/emails/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...AppState.userCredentials,
                ...emailData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Email enviado exitosamente', 'success');
            closeComposer();
            await loadFolderStats(); // Actualizar contadores
        } else {
            showNotification(data.error || 'Error al enviar email', 'error');
        }
        
    } catch (error) {
        console.error('Error al enviar email:', error);
        showNotification('Error al enviar email', 'error');
    }
}

/**
 * Solicitar credenciales del usuario
 */
async function requestCredentials(reason) {
    return new Promise((resolve) => {
        const modal = document.getElementById('credentialsModal');
        const reasonElement = modal.querySelector('p');
        
        if (reasonElement) {
            reasonElement.textContent = `Para ${reason.toLowerCase()}, necesitamos verificar tus credenciales:`;
        }
        
        // Pre-llenar email si está disponible
        const emailInput = document.getElementById('credentialsEmail');
        if (emailInput && AppState.currentUser) {
            emailInput.value = AppState.currentUser.email;
        }
        
        modal.style.display = 'flex';
        
        // Guardar función de resolución para usar en confirmCredentials
        AppState.credentialsResolver = resolve;
    });
}

/**
 * Confirmar credenciales
 */
async function confirmCredentials() {
    try {
        let email = document.getElementById('credentialsEmail').value.trim();
        const password = document.getElementById('credentialsPassword').value.trim();
        
        if (!email || !password) {
            showNotification('Por favor completa todos los campos', 'error');
            return;
        }
        
        // Autocompletar dominio si no lo tiene
        if (!email.includes('@')) {
            email = email + '@grupoeuromex.com';
        }
        
        // Mostrar estado de carga
        const confirmButton = document.querySelector('#credentialsModal .btn-primary');
        const originalText = confirmButton.innerHTML;
        
        confirmButton.disabled = true;
        confirmButton.innerHTML = `
            <div class="button-loader">
                <div class="spinner"></div>
            </div>
            Verificando...
        `;
        
        // Validar credenciales
        const response = await fetch('/api/auth/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success && data.valid) {
            AppState.userCredentials = { email, password };
            
            // Guardar credenciales en sessionStorage para persistencia
            sessionStorage.setItem('userCredentials', JSON.stringify({ email, password }));
            
            // Actualizar UI con el email del usuario
            updateUserInfo();
            
            // Actualizar botón para mostrar éxito
            confirmButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
                Verificado
            `;
            
            // Esperar un momento antes de cerrar
            setTimeout(async () => {
                closeCredentialsModal();
                
                // Resolver promesa pendiente
                if (AppState.credentialsResolver) {
                    AppState.credentialsResolver(true);
                    AppState.credentialsResolver = null;
                }
                
                showNotification('Credenciales verificadas', 'success');
                
                // Cargar estadísticas y emails después de verificar credenciales
                await loadFolderStats();
                await loadEmails(AppState.currentFolder);
            }, 1000);
            
        } else {
            // Restaurar botón en caso de error
            confirmButton.disabled = false;
            confirmButton.innerHTML = originalText;
            showNotification(data.error || 'Credenciales inválidas', 'error');
        }
        
    } catch (error) {
        console.error('Error al verificar credenciales:', error);
        
        // Restaurar botón en caso de error
        const confirmButton = document.querySelector('#credentialsModal .btn-primary');
        confirmButton.disabled = false;
        confirmButton.innerHTML = originalText;
        
        showNotification('Error al verificar credenciales', 'error');
    }
}

/**
 * Cerrar modal de credenciales
 */
function closeCredentialsModal() {
    const modal = document.getElementById('credentialsModal');
    modal.style.display = 'none';
    
    // Limpiar formulario
    document.getElementById('credentialsForm').reset();
    
    // Resolver promesa si está pendiente
    if (AppState.credentialsResolver) {
        AppState.credentialsResolver(false);
        AppState.credentialsResolver = null;
    }
}

/**
 * Mover email entre carpetas
 */
async function moveEmail(uid, targetFolder) {
    try {
        // Verificar credenciales
        if (!AppState.userCredentials) {
            console.log('❌ No hay credenciales para cargar emails');
            showNotification('Sesión expirada. Redirigiendo al login...', 'error');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
            return;
        }
        
        const response = await fetch('/api/emails/move', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...AppState.userCredentials,
                sourceFolder: AppState.currentFolder,
                targetFolder: targetFolder,
                uid: uid
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Email movido exitosamente', 'success');
            await loadEmails(AppState.currentFolder);
            await loadFolderStats();
        } else {
            showNotification(data.error || 'Error al mover email', 'error');
        }
        
    } catch (error) {
        console.error('Error al mover email:', error);
        showNotification('Error al mover email', 'error');
    }
}

/**
 * Marcar email como importante
 */
async function markAsImportant(uid) {
    try {
        // Por ahora solo mostrar notificación
        // En una implementación completa, esto se enviaría al servidor
        showNotification('Funcionalidad de importancia próximamente', 'info');
        
    } catch (error) {
        console.error('Error al marcar email como importante:', error);
        showNotification('Error al marcar email como importante', 'error');
    }
}

/**
 * Eliminar email
 */
async function deleteEmail(uid) {
    if (!confirm('¿Estás seguro de que quieres eliminar este email?')) {
        return;
    }
    
    try {
        // Verificar credenciales
        if (!AppState.userCredentials) {
            console.log('❌ No hay credenciales para cargar emails');
            showNotification('Sesión expirada. Redirigiendo al login...', 'error');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
            return;
        }
        
        const response = await fetch(`/api/emails/${AppState.currentFolder}/${uid}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(AppState.userCredentials)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Email eliminado exitosamente', 'success');
            await loadEmails(AppState.currentFolder);
            await loadFolderStats();
        } else {
            showNotification(data.error || 'Error al eliminar email', 'error');
        }
        
    } catch (error) {
        console.error('Error al eliminar email:', error);
        showNotification('Error al eliminar email', 'error');
    }
}

/**
 * Refrescar emails
 */
async function refreshEmails() {
    // Limpiar caché antes de refrescar para obtener datos actualizados
    await clearEmailCache();
    await loadEmails(AppState.currentFolder);
    await loadFolderStats();
    updateLastUpdateTime();
    showNotification('Emails actualizados', 'success');
}

/**
 * Actualizar la hora de última actualización
 */
function updateLastUpdateTime() {
    const lastUpdateTimeElement = document.getElementById('lastUpdateTime');
    const lastUpdateTimeElementMobile = document.getElementById('lastUpdateTimeMobile');
    if (lastUpdateTimeElement) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
        lastUpdateTimeElement.textContent = timeString;
    }
    if (lastUpdateTimeElementMobile) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
        lastUpdateTimeElementMobile.textContent = timeString;
    }
}

/**
 * Limpiar caché del servidor
 */
async function clearEmailCache() {
    try {
        const response = await fetch('/api/emails/clear-cache', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Caché limpiado exitosamente');
            // Opcional: mostrar notificación al usuario
            showNotification('Caché limpiado', 'success');
        } else {
            console.error('❌ Error al limpiar caché:', result.error);
            showNotification('Error al limpiar caché', 'error');
        }
    } catch (error) {
        console.error('❌ Error al limpiar caché:', error);
        showNotification('Error al limpiar caché', 'error');
    }
}

/**
 * Ir a página anterior
 */
async function previousPage() {
    if (AppState.currentPage > 1) {
        AppState.currentPage--;
        await loadEmails(AppState.currentFolder);
        updatePaginationControls();
    }
}

/**
 * Ir a página siguiente
 */
async function nextPage() {
    const totalPages = Math.ceil(AppState.totalEmails / AppState.emailsPerPage);
    if (AppState.currentPage < totalPages) {
        AppState.currentPage++;
        await loadEmails(AppState.currentFolder);
        updatePaginationControls();
    }
}

/**
 * Actualizar controles de paginación
 */
function updatePaginationControls() {
    const totalPages = Math.ceil(AppState.totalEmails / AppState.emailsPerPage);
    const paginationControls = document.getElementById('paginationControls');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageIndicator = document.getElementById('pageIndicator');
    const paginationInfo = document.getElementById('paginationInfo');
    const emailCount = document.getElementById('emailCount');
    const emailCountMobile = document.getElementById('emailCountMobile');
    const paginationInfoMobile = document.getElementById('paginationInfoMobile');
    
    // Verificar que todos los elementos existen antes de usarlos
    if (!paginationControls || !prevBtn || !nextBtn || !pageIndicator || !paginationInfo || !emailCount) {
        console.warn('Algunos elementos de paginación no existen en el DOM');
        return;
    }
    
    // Mostrar controles solo si hay más de 50 emails
    if (AppState.totalEmails > AppState.emailsPerPage) {
        paginationControls.style.display = 'flex';
        paginationInfo.style.display = 'block';
        
        prevBtn.disabled = AppState.currentPage === 1;
        nextBtn.disabled = AppState.currentPage >= totalPages;
        pageIndicator.textContent = `Pág. ${AppState.currentPage} de ${totalPages}`;
        emailCount.textContent = AppState.totalEmails;
    } else {
        paginationControls.style.display = 'none';
        if (AppState.totalEmails > 0) {
        paginationInfo.style.display = 'block';
        emailCount.textContent = AppState.totalEmails;
        if (paginationInfoMobile) paginationInfoMobile.style.display = 'block';
        if (emailCountMobile) emailCountMobile.textContent = AppState.totalEmails;
        } else {
            paginationInfo.style.display = 'none';
            if (paginationInfoMobile) paginationInfoMobile.style.display = 'none';
        }
    }
}

/**
 * Verificar si un adjunto es una imagen
 */
function isImageAttachment(contentType) {
    if (!contentType) return false;
    return contentType.toLowerCase().startsWith('image/');
}

/**
 * Obtener icono según el tipo de archivo
 */
function getFileIcon(filename) {
    if (!filename) return '📄';
    
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        'pdf': '📕',
        'doc': '📘',
        'docx': '📘',
        'xls': '📗',
        'xlsx': '📗',
        'ppt': '📙',
        'pptx': '📙',
        'zip': '🗜️',
        'rar': '🗜️',
        '7z': '🗜️',
        'txt': '📝',
        'csv': '📊',
        'mp3': '🎵',
        'mp4': '🎬',
        'avi': '🎬',
        'mov': '🎬',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'png': '🖼️',
        'gif': '🖼️',
        'svg': '🖼️',
    };
    
    return icons[ext] || '📄';
}

/**
 * Formatear tamaño de archivo
 */
function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Ver adjunto en pantalla completa
 */
async function viewAttachmentFullscreen(uid, index, filename) {
    const modal = document.createElement('div');
    modal.className = 'fullscreen-attachment-modal';
    modal.innerHTML = `
        <div class="fullscreen-overlay" onclick="this.parentElement.remove()">
            <div class="fullscreen-content" onclick="event.stopPropagation()">
                <div class="fullscreen-header">
                    <h3>${filename}</h3>
                    <button class="fullscreen-close" onclick="this.closest('.fullscreen-attachment-modal').remove()">✕</button>
                </div>
                <div class="fullscreen-body">
                    <div style="text-align: center; color: var(--text-light);">
                        <div style="font-size: 48px;">⏳</div>
                        <div>Cargando...</div>
                    </div>
                </div>
                <div class="fullscreen-footer">
                    <button onclick="downloadAttachment(${uid}, ${index}, '${filename}')" class="btn btn-primary">
                        ⬇️ Descargar
                    </button>
                    <button onclick="this.closest('.fullscreen-attachment-modal').remove()" class="btn btn-secondary">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Cargar la imagen
    try {
        const response = await fetch(`/api/emails/${AppState.currentFolder}/${uid}/attachment/${index}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(AppState.userCredentials)
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            const bodyElement = modal.querySelector('.fullscreen-body');
            bodyElement.innerHTML = `
                <img src="${url}" 
                     alt="${filename}"
                     style="max-width: 100%; max-height: 80vh; object-fit: contain;">
            `;
            
            // Limpiar URL cuando se cierre el modal
            modal.addEventListener('remove', () => {
                window.URL.revokeObjectURL(url);
            });
        } else {
            throw new Error('Error al cargar la imagen');
        }
    } catch (error) {
        const bodyElement = modal.querySelector('.fullscreen-body');
        bodyElement.innerHTML = `
            <div style="text-align: center; color: var(--error-color);">
                <div style="font-size: 48px;">❌</div>
                <div>Error al cargar la imagen</div>
            </div>
        `;
    }
}

/**
 * Descargar adjunto de un email
 */
async function downloadAttachment(uid, attachmentIndex, filename) {
    try {
        // Verificar credenciales
        if (!AppState.userCredentials) {
            console.log('❌ No hay credenciales para cargar emails');
            showNotification('Sesión expirada. Redirigiendo al login...', 'error');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
            return;
        }
        
        console.log('Downloading attachment:', { uid, attachmentIndex, filename });
        
        // Mostrar notificación de inicio de descarga
        showNotification('Descargando adjunto...', 'info');
        
        const response = await fetch(`/api/emails/${AppState.currentFolder}/${uid}/attachment/${attachmentIndex}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(AppState.userCredentials)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al descargar adjunto');
        }
        
        // Obtener el blob del adjunto
        const blob = await response.blob();
        
        // Crear URL temporal para el blob
        const url = window.URL.createObjectURL(blob);
        
        // Crear elemento <a> temporal para iniciar la descarga
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        
        // Agregar al DOM, hacer clic y remover
        document.body.appendChild(a);
        a.click();
        
        // Limpiar
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
        
        showNotification(`Adjunto descargado: ${filename}`, 'success');
        
    } catch (error) {
        console.error('Error downloading attachment:', error);
        showNotification(error.message || 'Error al descargar adjunto', 'error');
    }
}

/**
 * Mostrar menú de perfil
 */
function showProfileMenu() {
    const profileMenu = document.getElementById('profileMenu');
    const profileEmail = document.getElementById('profileEmail');
    const userEmail = document.getElementById('userEmail');
    
    if (profileEmail && userEmail) {
        profileEmail.textContent = userEmail.textContent;
    }
    
    profileMenu.style.display = 'block';
}

/**
 * Ocultar menú de perfil
 */
function hideProfileMenu() {
    const profileMenu = document.getElementById('profileMenu');
    profileMenu.style.display = 'none';
}

/**
 * Cerrar sesión
 */
async function logout() {
    try {
        // Limpiar credenciales guardadas
        sessionStorage.removeItem('userCredentials');
        AppState.userCredentials = null;
        
        const response = await fetch('/api/auth/logout', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Sesión cerrada exitosamente', 'success');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 1000);
        } else {
            showNotification('Error al cerrar sesión', 'error');
        }
        
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        // Forzar redirección aunque haya error
        window.location.href = '/login.html';
    }
}

/**
 * Funciones auxiliares para UI
 */
function getOppositeFolder() {
    const opposites = {
        'INBOX': 'INBOX.Trash',
        'INBOX.Sent': 'INBOX.Trash',
        'INBOX.Drafts': 'INBOX.Trash',
        'INBOX.Trash': 'INBOX',
        'INBOX.Junk': 'INBOX.Trash'
    };
    return opposites[AppState.currentFolder] || 'INBOX.Trash';
}

function getOppositeFolderName() {
    const opposites = {
        'INBOX': 'Papelera',
        'INBOX.Sent': 'Papelera',
        'INBOX.Drafts': 'Papelera',
        'INBOX.Trash': 'Inbox',
        'INBOX.Junk': 'Papelera'
    };
    return opposites[AppState.currentFolder] || 'Papelera';
}

function getOppositeFolderIcon() {
    const opposites = {
        'INBOX': '🗑️',
        'INBOX.Sent': '🗑️',
        'INBOX.Drafts': '🗑️',
        'INBOX.Trash': '📥',
        'INBOX.Junk': '🗑️'
    };
    return opposites[AppState.currentFolder] || '🗑️';
}

function toggleEmailSelection(uid, checked) {
    if (checked) {
        AppState.selectedEmails.add(uid);
    } else {
        AppState.selectedEmails.delete(uid);
    }
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.email-item input[type="checkbox"]');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
        toggleEmailSelection(parseInt(checkbox.closest('.email-item').onclick.toString().match(/\d+/)[0]), selectAll.checked);
    });
}

/**
 * Mostrar notificaciones
 */
function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <span class="notification-message">${message}</span>
        </div>
    `;
    
    // Estilos para notificación
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        max-width: 400px;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remover después de 4 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Inicializar aplicación cuando el DOM esté listo
/**
 * Limpiar cache de emails
 */
function clearEmailCache() {
    AppState.emailCache = {};
    console.log('🗑️ Cache de emails limpiado');
}

/**
 * Forzar recarga de emails (limpiar cache y recargar)
 */
async function forceReloadEmails() {
    clearEmailCache();
    await loadEmails(AppState.currentFolder);
}

document.addEventListener('DOMContentLoaded', init);

// Inicializar la hora de última actualización cuando se carga la página
setTimeout(() => {
    updateLastUpdateTime();
}, 1000);

// Agregar estilos CSS para animaciones de notificaciones
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .notification-icon {
        font-size: 18px;
    }
    
    .notification-message {
        font-size: 14px;
        font-weight: 500;
    }
`;
document.head.appendChild(style);
