# 📧 Email Admin MVP

**MVP de administrador de correos empresarial multi-usuario para Hostinger**

Un sistema completo de gestión de correos electrónicos corporativos que permite a múltiples usuarios gestionar sus emails de forma independiente y segura, con autenticación directa contra los servidores IMAP/SMTP de Hostinger.

## 🚀 Características Principales

### ✅ **Autenticación Segura**
- Login directo con credenciales de Hostinger
- Verificación contra servidor IMAP en tiempo real
- Sesiones seguras con express-session
- Pool de conexiones reutilizables por usuario

### 📁 **Gestión Completa de Carpetas**
- **INBOX**: Emails recibidos (20 mensajes confirmados)
- **INBOX.Sent**: Emails enviados (4 mensajes confirmados)  
- **INBOX.Drafts**: Borradores
- **INBOX.Trash**: Papelera
- **INBOX.Junk**: Spam

### 📧 **Operaciones de Email**
- Listar emails por carpeta con paginación automática
- Leer emails individuales con formato completo
- Enviar nuevos emails con firma personalizada
- Responder a emails existentes
- Guardar borradores automáticamente
- Adjuntos: cargar, descargar, vista previa de imágenes
- Mover emails entre carpetas
- Eliminar emails (papelera/eliminación permanente)
- Paginación inteligente (más de 50 correos)

### 🎨 **Interfaz Moderna**
- Dashboard responsivo y mobile-first
- Navegación por pestañas por carpeta (sin contadores, UI limpia)
- Modal para lectura de emails con vista de adjuntos
- Composer integrado con autoguardado de borradores
- Vista previa de imágenes inline en adjuntos
- Perfil de usuario con firma de imagen personalizada
- Autocompletado de dominio en login (@grupoeuromex.com)
- Persistencia de sesión con sessionStorage
- Notificaciones en tiempo real
- Paginación automática (50 correos por página)
- Diseño optimizado para todos los dispositivos

## 🛠️ Configuración Técnica

### **Servidores Hostinger**
```
IMAP: imap.hostinger.com:993 (SSL/TLS)
SMTP: smtp.hostinger.com:465 (SSL/TLS)
Delimitador: "." (punto)
```

### **Estructura de Carpetas Confirmada**
```
INBOX          - Bandeja de entrada
INBOX.Sent     - Emails enviados  
INBOX.Drafts   - Borradores
INBOX.Trash    - Papelera
INBOX.Junk     - Spam
```

## 📋 Requisitos Previos

- **Node.js** 16.0.0 o superior
- **npm** 8.0.0 o superior
- **Cuenta de email corporativo en Hostinger**
- **Acceso IMAP/SMTP habilitado** en tu cuenta

## 🚀 Instalación Rápida

### 1. **Clonar y Configurar**
```bash
# Navegar al directorio del proyecto
cd email-admin-mvp

# Instalar dependencias
npm install

# Copiar archivo de configuración
cp env.example .env
```

### 2. **Configurar Variables de Entorno**
Edita el archivo `.env` con tus configuraciones:

```env
# Servidor
PORT=3000
NODE_ENV=development
SESSION_SECRET=tu-session-secret-super-seguro-aqui

# Email Config (Hostinger - NO CAMBIAR)
IMAP_HOST=imap.hostinger.com
IMAP_PORT=993
IMAP_SECURE=true
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true

# Logs
LOG_LEVEL=info
LOG_FILE=logs/email-admin.log

# Seguridad
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SESSION_MAX_AGE=3600000
```

### 3. **Iniciar el Servidor**
```bash
# Modo desarrollo (con auto-reload)
npm run dev

# Modo producción
npm start
```

### 4. **Acceder a la Aplicación**
```
🌐 http://localhost:3000
```

## 📖 Guía de Uso

### **Primer Acceso**
1. Abre `http://localhost:3000` en tu navegador
2. Ingresa tus credenciales de email de Hostinger
3. El sistema verificará automáticamente contra el servidor IMAP
4. ¡Acceso completo al dashboard!

### **Gestión de Emails**
- **📥 Inbox**: Ver emails recibidos, marcar como leídos
- **📤 Enviados**: Revisar emails enviados
- **📝 Borradores**: Gestionar emails en borrador
- **🗑️ Papelera**: Emails eliminados (recuperables)
- **🚫 Spam**: Filtros de spam

### **Operaciones Disponibles**
- **✉️ Nuevo Email**: Composer integrado para enviar emails
- **📧 Responder**: Respuesta rápida desde cualquier email
- **🔄 Mover**: Transferir emails entre carpetas
- **🗑️ Eliminar**: Envío a papelera o eliminación permanente
- **🔄 Actualizar**: Sincronización en tiempo real

## 🔧 API REST Endpoints

### **Autenticación**
```http
POST /api/auth/login          # Login con credenciales Hostinger
POST /api/auth/logout         # Cerrar sesión
GET  /api/auth/profile        # Información del usuario
GET  /api/auth/status         # Estado de autenticación
POST /api/auth/refresh        # Refrescar sesión
POST /api/auth/validate       # Validar credenciales
```

### **Gestión de Emails**
```http
GET    /api/emails/:folder           # Listar emails de carpeta
GET    /api/emails/:folder/:uid      # Obtener email específico
POST   /api/emails/send              # Enviar nuevo email
POST   /api/emails/reply             # Responder email
POST   /api/emails/move              # Mover entre carpetas
DELETE /api/emails/:folder/:uid      # Eliminar email
GET    /api/emails/stats             # Estadísticas de carpetas
GET    /api/emails/folders           # Lista de carpetas
```

### **Ejemplos de Uso**

#### **Login**
```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'tu@empresa.com',
    password: 'tu_password'
  })
});
```

#### **Enviar Email**
```javascript
const response = await fetch('/api/emails/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'tu@empresa.com',
    password: 'tu_password',
    to: 'destino@empresa.com',
    subject: 'Asunto del email',
    text: 'Contenido del mensaje'
  })
});
```

## 🏗️ Arquitectura del Sistema

```
email-admin-mvp/
├── server.js                    # Servidor principal Express
├── package.json                 # Dependencias y scripts
├── env.example                  # Variables de entorno
├── src/
│   ├── config/
│   │   └── email.js            # Configuración IMAP/SMTP
│   ├── services/
│   │   ├── authService.js      # Autenticación IMAP
│   │   └── emailService.js     # Operaciones de email
│   ├── routes/
│   │   ├── auth.js             # Rutas de autenticación
│   │   └── emails.js           # Rutas de email
│   ├── middleware/
│   │   └── auth.js             # Middleware de seguridad
│   └── utils/
│       └── logger.js           # Sistema de logs
└── public/
    ├── index.html              # Dashboard principal
    ├── login.html              # Página de login
    ├── style.css               # Estilos CSS
    └── app.js                  # Frontend JavaScript
```

## 🔒 Seguridad

### **Medidas Implementadas**
- ✅ Autenticación directa contra servidor IMAP
- ✅ Sesiones seguras con express-session
- ✅ Rate limiting para prevenir abuso
- ✅ Validación de entrada en todos los endpoints
- ✅ Logs detallados de todas las operaciones
- ✅ Manejo seguro de errores
- ✅ CORS configurado apropiadamente
- ✅ Headers de seguridad con Helmet

### **Recomendaciones de Producción**
- Cambiar `SESSION_SECRET` por una clave segura
- Usar HTTPS en producción
- Configurar proxy reverso (nginx/Apache)
- Implementar backup de logs
- Monitoreo de conexiones IMAP

## 📊 Monitoreo y Logs

### **Sistema de Logs**
- **Archivo**: `logs/email-admin.log`
- **Errores**: `logs/error.log`
- **Excepciones**: `logs/exceptions.log`
- **Nivel**: Configurable via `LOG_LEVEL`

### **Información Registrada**
- Conexiones IMAP/SMTP por usuario
- Operaciones de email (enviar, recibir, mover)
- Intentos de autenticación
- Errores y excepciones
- Requests HTTP con duración

## 🐛 Solución de Problemas

### **Error de Conexión IMAP**
```
Error: ECONNREFUSED
Solución: Verificar que IMAP esté habilitado en Hostinger
```

### **Credenciales Inválidas**
```
Error: Authentication failed
Solución: Verificar email/contraseña y estado de la cuenta
```

### **Puerto en Uso**
```
Error: EADDRINUSE
Solución: Cambiar PORT en .env o cerrar proceso existente
```

### **Logs para Debug**
```bash
# Ver logs en tiempo real
tail -f logs/email-admin.log

# Ver solo errores
tail -f logs/error.log
```

## 🚀 Despliegue en Producción

### **1. Preparación**
```bash
# Instalar dependencias de producción
npm install --production

# Configurar variables de entorno
cp env.example .env
# Editar .env con configuraciones de producción
```

### **2. Proceso Manager (PM2)**
```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicación
pm2 start server.js --name email-admin

# Configurar auto-restart
pm2 startup
pm2 save
```

### **3. Proxy Reverso (Nginx)**
```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🤝 Contribución

### **Estructura de Desarrollo**
1. Fork del repositorio
2. Crear rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit cambios: `git commit -m 'Agregar nueva funcionalidad'`
4. Push a rama: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

### **Estándares de Código**
- ESLint configurado para JavaScript
- Comentarios JSDoc para funciones
- Logs detallados para debugging
- Manejo de errores consistente

## 📄 Licencia

MIT License - Ver archivo `LICENSE` para detalles.

## 🆘 Soporte

### **Documentación Adicional**
- [Documentación de IMAP-Simple](https://github.com/chadxz/imap-simple)
- [Guía de Nodemailer](https://nodemailer.com/about/)
- [Express.js Documentation](https://expressjs.com/)

### **Contacto**
Para soporte técnico o preguntas sobre el sistema:
- Crear issue en el repositorio
- Revisar logs en `logs/email-admin.log`
- Verificar configuración de Hostinger

---

## 🎯 Funcionalidades Completadas

- [x] **Adjuntos**: Descarga, vista previa de imágenes, carga múltiple
- [x] **Borradores**: Guardado automático al cerrar composer
- [x] **Firma Personalizada**: Firma con imagen por usuario
- [x] **Paginación**: Control automático para listas grandes
- [x] **Responsive Design**: Optimizado para móvil, tablet y desktop
- [x] **Persistencia de Sesión**: No pedir credenciales constantemente
- [x] **Autocompletado**: Dominio corporativo pre-llenado

## 🚧 Próximas Funcionalidades

- [ ] **Búsqueda Avanzada**: Filtros por fecha, remitente, asunto
- [ ] **Filtros Automáticos**: Reglas de organización
- [ ] **Temas**: Modo oscuro/claro
- [ ] **Multi-idioma**: Soporte para inglés/español
- [ ] **Webhooks**: Notificaciones de nuevos emails vía WhatsApp/Telegram
- [ ] **Respuestas vía Webhook**: Responder desde WhatsApp/Telegram

---

**¡Email Admin MVP está listo para gestionar tus correos corporativos de Hostinger de forma profesional y segura! 🚀📧**
