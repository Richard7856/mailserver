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
    userProfile: null // Perfil del usuario
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
        // Verificar autenticación
        await checkAuthStatus();
        
        // Cargar información del usuario
        await loadUserProfile();
        
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
        
        // Solicitar credenciales solo si no están guardadas
        if (!AppState.userCredentials) {
            await requestCredentials('iniciar la aplicación');
            
            // Si el usuario cerró el modal sin ingresar credenciales
            if (!AppState.userCredentials) {
                console.log('Usuario no ingresó credenciales, cargando UI básica');
                return;
            }
        }
        
        // Ahora con credenciales, cargar todo
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
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        if (!data.success || !data.authenticated) {
            throw new Error('Usuario no autenticado');
        }
        
        AppState.currentUser = data.user;
        return true;
        
    } catch (error) {
        console.error('Error de autenticación:', error);
        throw new Error('No autorizado');
    }
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
    
    document.querySelector(`[data-folder="${folderName}"]`).classList.add('active');
    
    // Actualizar título
    const titleElement = document.getElementById('currentFolderTitle');
    if (titleElement && FOLDERS[folderName]) {
        titleElement.textContent = `${FOLDERS[folderName].icon} ${FOLDERS[folderName].name}`;
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
        AppState.isLoading = true;
        showLoading();
        
        if (!AppState.userCredentials) {
            await requestCredentials('Para cargar emails');
            return;
        }
        
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
            AppState.emails = data.emails.sort((a, b) => new Date(b.date) - new Date(a.date));
            AppState.totalEmails = data.emails.length;
            
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
    const content = document.getElementById('emailListContent');
    if (content) {
        content.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                Cargando emails...
            </div>
        `;
    }
}

/**
 * Ocultar estado de carga
 */
function hideLoading() {
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
    
    const emailsHTML = AppState.emails.map(email => `
        <div class="email-item ${!email.seen ? 'unread' : ''}" onclick="openEmail(${email.uid})">
            <div class="email-checkbox">
                <input type="checkbox" onchange="toggleEmailSelection(${email.uid}, this.checked)" 
                       onclick="event.stopPropagation()">
            </div>
            <div class="email-from">
                <div class="sender-avatar">${extractEmailName(email.from).charAt(0).toUpperCase()}</div>
                <span class="sender-name">${extractEmailName(email.from)}</span>
            </div>
            <div class="email-content-preview">
                <div class="email-subject ${!email.seen ? 'unread' : ''}">
                    ${email.subject || '(Sin asunto)'}
                    ${!email.seen ? '<span class="unread-indicator">●</span>' : ''}
                </div>
            </div>
            <div class="email-attachment">
                ${email.attachments && email.attachments.length > 0 ? 
                    `<div class="attachment-indicator" title="${email.attachments.length} adjunto${email.attachments.length > 1 ? 's' : ''}">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M10.5 1H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4.5L10.5 1zM5 0h6.5L15 3.5V13a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3z"/>
                            <path d="M6 6h4v1H6V6zm0 2h4v1H6V8z"/>
                        </svg>
                        <span class="attachment-count">${email.attachments.length}</span>
                    </div>` : ''}
            </div>
            <div class="email-date">${formatDateFull(email.date)}</div>
            <div class="email-actions" onclick="event.stopPropagation()">
                <button class="action-btn" onclick="markAsImportant(${email.uid})" title="Marcar">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="8,2 10.5,6 15,6 11.5,9.5 13,14 8,11 3,14 4.5,9.5 1,6 5.5,6"/>
                    </svg>
                </button>
                <button class="action-btn" onclick="deleteEmail(${email.uid})" title="Mover a papelera">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
    
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
            return 'Contenido no disponible';
        }
        
        // Truncar a 120 caracteres máximo
        if (content.length > 120) {
            content = content.substring(0, 117) + '...';
        }
        
        return content;
    }
    
    // Si no hay contenido, mostrar un mensaje más útil basado en el asunto
    if (email.subject) {
        return 'Email sin contenido de texto';
    }
    
    return 'Contenido no disponible';
}

/**
 * Abrir email en modal
 */
async function openEmail(uid) {
    try {
        if (!AppState.userCredentials) {
            await requestCredentials('Para abrir emails');
            return;
        }
        
        const response = await fetch(`/api/emails/${AppState.currentFolder}/${uid}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(AppState.userCredentials)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showEmailModal(data.email);
        } else {
            showNotification(data.error || 'Error al cargar email', 'error');
        }
        
    } catch (error) {
        console.error('Error al abrir email:', error);
        showNotification('Error al cargar email', 'error');
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
    
    modal.style.display = 'flex';
    
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
        if (!AppState.userCredentials) {
            await requestCredentials('Para guardar borradores');
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
        
        if (!AppState.userCredentials) {
            await requestCredentials('Para enviar emails');
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
        if (!AppState.userCredentials) {
            await requestCredentials('Para mover emails');
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
        if (!AppState.userCredentials) {
            await requestCredentials('Para eliminar emails');
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
    await loadEmails(AppState.currentFolder);
    await loadFolderStats();
    showNotification('Emails actualizados', 'success');
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
        } else {
            paginationInfo.style.display = 'none';
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
        if (!AppState.userCredentials) {
            await requestCredentials('Para descargar adjuntos');
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
document.addEventListener('DOMContentLoaded', init);

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
