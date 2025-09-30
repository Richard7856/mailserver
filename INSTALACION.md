# 🚀 Instalación Rápida - Email Admin MVP

## ⚡ Inicio en 4 Pasos

### **1. Clonar o Descargar el Proyecto**
```bash
git clone <tu-repositorio>
cd email_admin
```

### **2. Instalar Dependencias**
```bash
npm install
```

### **3. Configurar Variables de Entorno**
```bash
# Copiar el archivo de ejemplo
cp env.example .env

# IMPORTANTE: Editar .env y cambiar estos valores:
# - SESSION_SECRET: Genera una clave aleatoria segura (mín. 32 caracteres)
# - PORT: Puerto donde correrá el servidor (default: 3000)
```

**Generar SESSION_SECRET seguro:**
```bash
# En Linux/Mac:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# O usa un generador online (pero cámbialo en producción)
```

### **4. Iniciar Servidor**
```bash
# Opción A: Script automático (recomendado)
chmod +x start.sh
./start.sh

# Opción B: Manual
npm start

# Opción C: Modo desarrollo con auto-reload
npm run dev
```

## 🌐 Acceso
```
http://localhost:3000
```

## 📧 Primer Login
Usa tus credenciales corporativas de Hostinger:
- **Email**: Solo escribe tu nombre de usuario (ej: `test`)
- **Dominio**: Se autocompleta a `@grupoeuromex.com`
- **Contraseña**: Tu contraseña de correo de Hostinger

**Ejemplo:**
- Escribe: `test`
- Se convierte en: `test@grupoeuromex.com`

## ✅ Configuración del Servidor

### **Hostinger IMAP/SMTP (Pre-configurado):**
- ✅ IMAP: `imap.hostinger.com:993` (SSL/TLS)
- ✅ SMTP: `smtp.hostinger.com:465` (SSL/TLS)
- ✅ Carpetas: INBOX, Sent, Drafts, Trash, Junk
- ✅ Delimitador de carpetas: "." (punto)

### **Funcionalidades Implementadas:**
- ✅ Login con autocompletado de dominio
- ✅ Gestión de 5 carpetas principales
- ✅ Enviar/recibir emails con firma personalizada
- ✅ Responder emails
- ✅ Adjuntos: visualización, descarga y carga
- ✅ Vista previa de imágenes inline
- ✅ Guardar borradores automáticamente
- ✅ Mover emails entre carpetas
- ✅ Eliminar emails (mover a papelera)
- ✅ Perfil con firma de imagen
- ✅ Paginación (más de 50 correos)
- ✅ Dashboard totalmente responsivo
- ✅ Persistencia de sesión
- ✅ API REST completa
- ✅ Sistema de logs completo

## 🔐 Seguridad Antes de Subir a Producción

### **1. Variables de Entorno**
```bash
# Genera nuevo SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Actualiza en .env:
SESSION_SECRET=<tu-clave-generada>
NODE_ENV=production
```

### **2. Archivos Sensibles**
Asegúrate de que `.gitignore` incluya:
- ✅ `.env` (NUNCA subir credenciales)
- ✅ `data/profiles/` (datos de usuarios)
- ✅ `data/signatures/` (firmas personales)
- ✅ `logs/` (logs del sistema)
- ✅ `node_modules/`

### **3. Limpieza Pre-Git**
```bash
# Eliminar logs de desarrollo
rm -rf logs/*.log

# Verificar que no hay archivos .env
ls -la | grep .env

# Solo debería aparecer: env.example
```

## 🆘 Problemas Comunes

### **Error de Conexión IMAP**
```bash
# Verifica en tu panel de Hostinger:
1. IMAP está habilitado
2. Acceso desde aplicaciones externas permitido
3. Credenciales correctas
```

### **Puerto 3000 en Uso**
```bash
# Opción 1: Cambiar puerto en .env
PORT=3001

# Opción 2: Matar proceso
lsof -ti:3000 | xargs kill -9
```

### **Permisos de start.sh**
```bash
chmod +x start.sh
```

### **Módulos faltantes**
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📦 Estructura del Proyecto
```
email_admin/
├── data/                    # Datos de usuarios (NO SUBIR)
│   ├── profiles/           # Perfiles de usuario
│   └── signatures/         # Firmas de imagen
├── logs/                    # Logs del sistema (NO SUBIR)
├── public/                  # Frontend
│   ├── index.html          # Dashboard principal
│   ├── login.html          # Página de login
│   ├── app.js              # Lógica del frontend
│   └── style.css           # Estilos
├── src/
│   ├── config/             # Configuración
│   ├── middleware/         # Middlewares de autenticación
│   ├── routes/             # Rutas de la API
│   ├── services/           # Lógica de negocio
│   └── utils/              # Utilidades
├── .env                     # Variables de entorno (NO SUBIR)
├── env.example             # Plantilla de .env (SÍ SUBIR)
├── package.json            # Dependencias
└── server.js               # Punto de entrada
```

## 🔧 Comandos Útiles

```bash
# Ver logs en tiempo real
tail -f logs/email-admin.log

# Detener servidor
pkill -f "node.*server.js"

# Verificar que el servidor está corriendo
ps aux | grep "node.*server"

# Limpiar todo y reiniciar
rm -rf node_modules logs/*.log
npm install
npm start
```

## 📝 Notas Importantes

1. **NUNCA subas el archivo `.env`** a Git
2. **Los datos de `data/profiles/` y `data/signatures/`** son sensibles
3. **Genera un SESSION_SECRET único** para cada instalación
4. **En producción**, usa variables de entorno del servidor (no archivo .env)
5. **Logs** se rotan automáticamente para evitar archivos grandes

---
**¡Listo! Tu administrador de emails corporativos está funcionando 🎉**
