const imap = require('imap-simple');

// Script de prueba para verificar conexión IMAP con Hostinger
async function testIMAPConnection() {
    console.log('🔍 Probando conexión IMAP con Hostinger...');
    console.log('📧 Servidor: imap.hostinger.com:993');
    console.log('🔐 SSL/TLS: true');
    console.log('');

    const config = {
        imap: {
            host: 'imap.hostinger.com',
            port: 993,
            secure: true,
            tls: {
                rejectUnauthorized: false
            },
            authTimeout: 30000,
            connTimeout: 30000,
            keepalive: true
        }
    };

    // Solicitar credenciales
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const email = await new Promise(resolve => {
        rl.question('📧 Ingresa tu email: ', resolve);
    });

    const password = await new Promise(resolve => {
        rl.question('🔒 Ingresa tu contraseña: ', resolve);
    });

    rl.close();

    config.imap.user = email;
    config.imap.password = password;

    try {
        console.log('\n🔄 Conectando a IMAP...');
        const connection = await imap.connect(config);
        
        console.log('✅ ¡Conexión IMAP exitosa!');
        console.log('📁 Carpetas disponibles:');
        
        // Listar carpetas
        const folders = await connection.getBoxes();
        Object.keys(folders).forEach(folder => {
            console.log(`   - ${folder}`);
        });

        // Probar apertura de INBOX
        console.log('\n🔄 Probando apertura de INBOX...');
        await connection.openBox('INBOX', true);
        console.log('✅ INBOX abierto correctamente');

        // Cerrar conexión
        await connection.end();
        console.log('\n🎉 ¡Todas las pruebas pasaron! El problema no es la conexión IMAP.');
        
    } catch (error) {
        console.error('\n❌ Error de conexión IMAP:');
        console.error('Mensaje:', error.message);
        console.error('Código:', error.code);
        console.error('Stack:', error.stack);
        
        // Sugerencias de solución
        console.log('\n💡 Posibles soluciones:');
        console.log('1. Verificar que IMAP esté habilitado en tu cuenta Hostinger');
        console.log('2. Usar contraseña de aplicación en lugar de contraseña normal');
        console.log('3. Verificar que la cuenta no tenga 2FA activado');
        console.log('4. Comprobar que no haya bloqueos de seguridad');
    }
}

testIMAPConnection().catch(console.error);
