# 🚀 Instalación Rápida - Email Admin MVP

## ⚡ Inicio en 3 Pasos

### **1. Instalar Dependencias**
```bash
npm install
```

### **2. Configurar Variables de Entorno**
```bash
cp env.example .env
# Editar .env y cambiar SESSION_SECRET por una clave segura
```

### **3. Iniciar Servidor**
```bash
# Opción A: Script automático (recomendado)
./start.sh

# Opción B: Manual
npm start

# Opción C: Modo desarrollo
npm run dev
```

## 🌐 Acceso
```
http://localhost:3000
```

## 📧 Login
Usa tus credenciales de email de Hostinger:
- **Email**: tu@empresa.com
- **Contraseña**: tu_password_de_hostinger

## ✅ Verificación Rápida

### **Configuración Confirmada para Hostinger:**
- ✅ IMAP: imap.hostinger.com:993 (SSL/TLS)
- ✅ SMTP: smtp.hostinger.com:465 (SSL/TLS)
- ✅ Carpetas: INBOX, INBOX.Sent, INBOX.Drafts, INBOX.Trash, INBOX.Junk
- ✅ Delimitador: "." (punto)

### **Funcionalidades Disponibles:**
- ✅ Login con credenciales Hostinger
- ✅ Gestión de 5 carpetas principales
- ✅ Enviar/recibir emails
- ✅ Responder emails
- ✅ Mover entre carpetas
- ✅ Eliminar emails
- ✅ Dashboard responsivo
- ✅ API REST completa

## 🆘 Problemas Comunes

### **Error de Conexión**
- Verifica que IMAP esté habilitado en tu cuenta Hostinger
- Confirma credenciales de email

### **Puerto en Uso**
- Cambia PORT en .env
- O cierra proceso que usa el puerto 3000

### **Dependencias**
- Asegúrate de tener Node.js 16+
- Ejecuta `npm install` nuevamente

## 📞 Soporte
- Revisa logs en `logs/email-admin.log`
- Verifica configuración en `.env`
- Lee `README.md` para detalles completos

---
**¡Listo! Tu administrador de emails corporativos está funcionando 🎉**
