#!/bin/bash

# Script de preparación para subir a Git
# Ejecutar este script ANTES de hacer el primer commit

echo "🧹 Preparando proyecto para Git..."
echo ""

# 1. Verificar que .env NO se suba
echo "📝 Verificando archivos sensibles..."
if [ -f .env ]; then
    echo "⚠️  ADVERTENCIA: Archivo .env detectado"
    echo "   Este archivo NO se subirá a Git (está en .gitignore)"
    echo "   ✅ Asegúrate de que .gitignore esté actualizado"
else
    echo "✅ No se encontró archivo .env (correcto para Git)"
fi

# 2. Limpiar logs
echo ""
echo "🗑️  Limpiando logs de desarrollo..."
rm -rf logs/*.log 2>/dev/null
mkdir -p logs
touch logs/.gitkeep
echo "✅ Logs limpiados"

# 3. Limpiar datos de usuarios
echo ""
echo "🔒 Limpiando datos de usuarios..."
rm -rf data/profiles/*.json 2>/dev/null
rm -rf data/signatures/*.png data/signatures/*.jpg 2>/dev/null
mkdir -p data/profiles data/signatures
touch data/profiles/.gitkeep
touch data/signatures/.gitkeep
echo "✅ Datos de usuarios limpiados"

# 4. Verificar archivos críticos
echo ""
echo "📋 Verificando archivos críticos..."
required_files=("env.example" "package.json" "server.js" "INSTALACION.md" "README.md" ".gitignore")
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file (FALTA)"
    fi
done

# 5. Generar SESSION_SECRET de ejemplo
echo ""
echo "🔐 Verificando SESSION_SECRET en env.example..."
if grep -q "tu-session-secret-super-seguro-aqui-cambiar-en-produccion" env.example; then
    echo "   ⚠️  SESSION_SECRET es el de ejemplo (CORRECTO para Git)"
    echo "   ⚠️  RECUERDA: Cada instalación debe generar su propio SECRET"
else
    echo "   ✅ SESSION_SECRET personalizado en env.example"
fi

# 6. Verificar .gitignore
echo ""
echo "🛡️  Verificando .gitignore..."
critical_ignores=(".env" "node_modules/" "logs/" "data/profiles/" "data/signatures/")
for item in "${critical_ignores[@]}"; do
    if grep -q "$item" .gitignore; then
        echo "   ✅ $item está ignorado"
    else
        echo "   ❌ $item NO está en .gitignore (AGREGAR)"
    fi
done

# 7. Estadísticas del proyecto
echo ""
echo "📊 Estadísticas del proyecto:"
echo "   Total archivos JS: $(find . -name "*.js" ! -path "./node_modules/*" ! -path "./logs/*" | wc -l | tr -d ' ')"
echo "   Total líneas de código: $(find . -name "*.js" ! -path "./node_modules/*" ! -path "./logs/*" -exec cat {} \; | wc -l | tr -d ' ')"
echo "   Tamaño (sin node_modules): $(du -sh . --exclude=node_modules 2>/dev/null | cut -f1 || echo "N/A")"

# 8. Resumen final
echo ""
echo "✅ ¡Proyecto listo para Git!"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Revisar que .env NO esté en el staging:"
echo "      git status"
echo ""
echo "   2. Agregar archivos al staging:"
echo "      git add ."
echo ""
echo "   3. Verificar archivos que se subirán:"
echo "      git status"
echo ""
echo "   4. Hacer el primer commit:"
echo "      git commit -m 'Initial commit: Email Admin MVP'"
echo ""
echo "   5. Subir a repositorio remoto:"
echo "      git remote add origin <tu-repo-url>"
echo "      git push -u origin main"
echo ""
echo "⚠️  IMPORTANTE: Verifica que .env NO aparezca en 'git status'"
echo ""
