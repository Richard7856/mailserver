#!/bin/bash

# Email Admin MVP - Script de Inicio Rápido
# Configuración automática y inicio del servidor

echo "🚀 Email Admin MVP - Inicio Rápido"
echo "=================================="
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Por favor instala Node.js 16+ desde https://nodejs.org/"
    exit 1
fi

# Verificar versión de Node.js
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js versión $NODE_VERSION detectada. Se requiere versión 16 o superior."
    exit 1
fi

echo "✅ Node.js $(node -v) detectado"

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm no está instalado"
    exit 1
fi

echo "✅ npm $(npm -v) detectado"
echo ""

# Crear directorio de logs si no existe
if [ ! -d "logs" ]; then
    echo "📁 Creando directorio de logs..."
    mkdir -p logs
    echo "✅ Directorio logs/ creado"
fi

# Verificar si existe .env
if [ ! -f ".env" ]; then
    echo "⚙️  Configurando variables de entorno..."
    if [ -f "env.example" ]; then
        cp env.example .env
        echo "✅ Archivo .env creado desde env.example"
        echo "📝 Por favor edita .env con tus configuraciones antes de continuar"
        echo ""
        echo "Configuración requerida en .env:"
        echo "  - SESSION_SECRET: Cambia por una clave segura"
        echo "  - PORT: Puerto del servidor (default: 3000)"
        echo ""
        read -p "¿Deseas editar .env ahora? (y/n): " edit_env
        if [ "$edit_env" = "y" ] || [ "$edit_env" = "Y" ]; then
            ${EDITOR:-nano} .env
        fi
    else
        echo "❌ Archivo env.example no encontrado"
        exit 1
    fi
else
    echo "✅ Archivo .env encontrado"
fi

# Instalar dependencias si es necesario
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
    if [ $? -eq 0 ]; then
        echo "✅ Dependencias instaladas correctamente"
    else
        echo "❌ Error al instalar dependencias"
        exit 1
    fi
else
    echo "✅ Dependencias ya instaladas"
fi

echo ""
echo "🎯 Configuración de Hostinger:"
echo "  📧 IMAP: imap.hostinger.com:993 (SSL/TLS)"
echo "  📤 SMTP: smtp.hostinger.com:465 (SSL/TLS)"
echo "  📁 Carpetas: INBOX, INBOX.Sent, INBOX.Drafts, INBOX.Trash, INBOX.Junk"
echo "  🔗 Delimitador: '.' (punto)"
echo ""

# Verificar puerto
PORT=$(grep "^PORT=" .env 2>/dev/null | cut -d'=' -f2)
if [ -z "$PORT" ]; then
    PORT=3000
fi

# Verificar si el puerto está en uso
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Puerto $PORT está en uso. ¿Deseas continuar de todas formas? (y/n): "
    read -p "" continue_anyway
    if [ "$continue_anyway" != "y" ] && [ "$continue_anyway" != "Y" ]; then
        echo "❌ Inicio cancelado. Cambia el puerto en .env o cierra el proceso que usa el puerto $PORT"
        exit 1
    fi
fi

echo "🚀 Iniciando Email Admin MVP..."
echo "🌐 URL: http://localhost:$PORT"
echo "📧 Login: Usa tus credenciales de email de Hostinger"
echo ""
echo "Presiona Ctrl+C para detener el servidor"
echo ""

# Iniciar servidor
if [ "$1" = "dev" ]; then
    echo "🔧 Modo desarrollo (con auto-reload)"
    npm run dev
else
    echo "🏭 Modo producción"
    npm start
fi
