# 🚀 Preparación para Git - Checklist Completo

## ✅ Estado Actual del Proyecto

El script `prepare-for-git.sh` ya ha limpiado:
- ✅ Logs de desarrollo eliminados
- ✅ Datos de usuarios limpiados
- ✅ .gitignore actualizado
- ✅ Carpetas con .gitkeep creadas

## 📝 Pasos para Subir a Git

### **1. Inicializar Git (si no lo has hecho)**
```bash
cd "/Users/richardfigueroa/Library/Mobile Documents/com~apple~CloudDocs/email_admin"
git init
```

### **2. Verificar archivos que SE SUBIRÁN**
```bash
git status
```

**✅ Deberías ver:**
- `src/` (código fuente)
- `public/` (frontend)
- `package.json`
- `server.js`
- `env.example`
- `README.md`
- `INSTALACION.md`
- `.gitignore`
- `start.sh`
- `prepare-for-git.sh`
- `data/profiles/.gitkeep`
- `data/signatures/.gitkeep`
- `logs/.gitkeep`

**❌ NO deberían aparecer:**
- `.env` (archivo de configuración local)
- `data/profiles/*.json` (perfiles de usuarios)
- `data/signatures/*.png` (firmas de usuarios)
- `logs/*.log` (logs del sistema)
- `node_modules/` (dependencias)

### **3. Agregar archivos al staging**
```bash
git add .
```

### **4. VERIFICAR de nuevo antes de commit**
```bash
# Ver EXACTAMENTE qué se va a subir
git status

# Si aparece .env, DETENTE y ejecútalo:
git rm --cached .env
```

### **5. Hacer el primer commit**
```bash
git commit -m "Initial commit: Email Admin MVP

Features:
- IMAP/SMTP integration with Hostinger
- Email management (send, receive, reply, delete)
- Attachments support with image preview
- Auto-save drafts
- User profiles with custom signatures
- Pagination for large email lists
- Fully responsive design
- Session persistence
- Complete REST API
- Comprehensive logging system"
```

### **6. Crear repositorio en GitHub/GitLab**

**En GitHub:**
1. Ve a https://github.com/new
2. Nombre: `email-admin-grupoeuromex` (o el que prefieras)
3. Descripción: "Sistema de administración de correos corporativos"
4. **NO** inicializar con README (ya lo tienes)
5. Crea el repositorio

**En GitLab:**
1. Ve a tu dashboard → New Project
2. Nombre: `email-admin-grupoeuromex`
3. Visibility: Private (recomendado)
4. **NO** inicializar con README
5. Crea el proyecto

### **7. Conectar con repositorio remoto**
```bash
# Para GitHub
git remote add origin https://github.com/TU-USUARIO/email-admin-grupoeuromex.git

# O para GitLab
git remote add origin https://gitlab.com/TU-USUARIO/email-admin-grupoeuromex.git

# Verificar
git remote -v
```

### **8. Subir código**
```bash
# Primera vez
git branch -M main
git push -u origin main

# Siguientes veces
git push
```

## 🔐 Configuración Post-Deploy

### **Cada nueva instalación debe:**

1. **Clonar el repo**
   ```bash
   git clone <tu-repo-url>
   cd email-admin-grupoeuromex
   ```

2. **Crear archivo .env**
   ```bash
   cp env.example .env
   ```

3. **Generar SESSION_SECRET único**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   # Copiar el resultado y pegarlo en .env
   ```

4. **Instalar y ejecutar**
   ```bash
   npm install
   npm start
   ```

## ⚠️ IMPORTANTE - NO SUBIR

### **Archivos que NUNCA deben estar en Git:**
- ❌ `.env` - Contiene SESSION_SECRET
- ❌ `data/profiles/*.json` - Datos personales de usuarios
- ❌ `data/signatures/*` - Firmas personales  
- ❌ `logs/*.log` - Logs con información sensible
- ❌ `node_modules/` - Dependencias (se instalan con npm)

### **Si accidentalmente subiste algo sensible:**
```bash
# Remover del historial (PELIGROSO, hacer antes del primer push)
git rm --cached archivo-sensible
git commit --amend

# Si ya hiciste push, considera:
# 1. Cambiar todas las credenciales expuestas
# 2. Hacer un nuevo repositorio limpio
# 3. O usar git-filter-repo para limpiar historial
```

## 🎨 .gitignore Actualizado

El archivo `.gitignore` ahora incluye:
```
.env
data/profiles/
data/signatures/
logs/
node_modules/
test-*.js
```

## 📊 Resumen del Proyecto

- **Líneas de código**: ~5,316
- **Archivos JavaScript**: 15
- **Dependencias**: 9 principales
- **Tamaño (sin node_modules)**: ~27MB
- **Rutas API**: 15+
- **Componentes frontend**: 8 principales

## ✨ Listo para Git!

Tu proyecto está preparado y limpio para subir a Git. Sigue los pasos de arriba y estarás listo.

**Recuerda:**
- ✅ Cada instalación genera su propio SESSION_SECRET
- ✅ Los usuarios crean sus propios perfiles localmente
- ✅ Los logs se generan en cada instalación
- ✅ El .env nunca se comparte (cada quien usa el suyo)

---

**¿Dudas? Revisa INSTALACION.md y README.md para más detalles.**
