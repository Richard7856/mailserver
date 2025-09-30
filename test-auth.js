const imap = require('imap-simple');
const emailConfig = require('./src/config/email');

// Script de prueba que replica exactamente la autenticación del servidor
async function testServerAuth(email, password) {
    console.log('🔍 Probando autenticación del servidor...');
    console.log(`📧 Email: ${email}`);
    console.log('');

    try {
        // Configuración IMAP específica para este usuario (igual que en authService.js)
        const imapConfig = {
            ...emailConfig.imap,
            user: email,
            password: password
        };

        console.log('📋 Configuración IMAP:');
        console.log('   Host:', imapConfig.host);
        console.log('   Port:', imapConfig.port);
        console.log('   Secure:', imapConfig.secure);
        console.log('   User:', imapConfig.user);
        console.log('   TLS rejectUnauthorized:', imapConfig.tls.rejectUnauthorized);
        console.log('');

        // Intentar conexión IMAP para verificar credenciales (igual que en authService.js)
        console.log('🔄 Conectando a IMAP...');
        const connection = await imap.connect(imapConfig);
        
        console.log('✅ Conexión IMAP exitosa');
        
        // Si la conexión es exitosa, las credenciales son válidas
        console.log('🔄 Cerrando conexión...');
        await connection.end();
        
        console.log('✅ Conexión cerrada correctamente');
        console.log('🎉 ¡Autenticación exitosa!');
        
        return {
            success: true,
            user: {
                email: email,
                authenticatedAt: new Date().toISOString()
            }
        };

    } catch (error) {
        console.error('❌ Error de autenticación:');
        console.error('   Mensaje:', error.message);
        console.error('   Código:', error.code);
        console.error('   Stack:', error.stack);
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Probar con las credenciales que mencionaste
const email = 'test@grupoeuromex.com';
const password = 'Test12,,';

testServerAuth(email, password).then(result => {
    console.log('\n📊 Resultado final:');
    console.log(JSON.stringify(result, null, 2));
}).catch(console.error);
