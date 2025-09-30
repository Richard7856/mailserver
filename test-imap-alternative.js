const imap = require('imap-simple');

// Probar diferentes configuraciones IMAP para Hostinger
async function testIMAPConfigs(email, password) {
    console.log('🔍 Probando diferentes configuraciones IMAP para Hostinger...');
    console.log(`📧 Email: ${email}`);
    console.log('');

    const configs = [
        {
            name: 'Configuración 1: imap.hostinger.com:993 (SSL)',
            config: {
                host: 'imap.hostinger.com',
                port: 993,
                secure: true,
                tls: { rejectUnauthorized: false },
                authTimeout: 30000,
                connTimeout: 30000,
                user: email,
                password: password
            }
        },
        {
            name: 'Configuración 2: imap.hostinger.com:143 (STARTTLS)',
            config: {
                host: 'imap.hostinger.com',
                port: 143,
                secure: false,
                tls: { rejectUnauthorized: false },
                authTimeout: 30000,
                connTimeout: 30000,
                user: email,
                password: password
            }
        },
        {
            name: 'Configuración 3: mail.hostinger.com:993 (SSL)',
            config: {
                host: 'mail.hostinger.com',
                port: 993,
                secure: true,
                tls: { rejectUnauthorized: false },
                authTimeout: 30000,
                connTimeout: 30000,
                user: email,
                password: password
            }
        },
        {
            name: 'Configuración 4: mail.hostinger.com:143 (STARTTLS)',
            config: {
                host: 'mail.hostinger.com',
                port: 143,
                secure: false,
                tls: { rejectUnauthorized: false },
                authTimeout: 30000,
                connTimeout: 30000,
                user: email,
                password: password
            }
        }
    ];

    for (const { name, config } of configs) {
        console.log(`\n🔄 Probando: ${name}`);
        try {
            const connection = await imap.connect({ imap: config });
            console.log('✅ ¡Conexión exitosa!');
            
            // Listar carpetas
            const folders = await connection.getBoxes();
            console.log('📁 Carpetas disponibles:');
            Object.keys(folders).forEach(folder => {
                console.log(`   - ${folder}`);
            });
            
            await connection.end();
            console.log('🎉 Esta configuración funciona correctamente');
            return config;
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }
    
    console.log('\n❌ Ninguna configuración funcionó');
    return null;
}

// Probar con las credenciales
const email = 'test@grupoeuromex.com';
const password = 'Test12,,';

testIMAPConfigs(email, password).then(result => {
    if (result) {
        console.log('\n✅ Configuración que funciona:');
        console.log(JSON.stringify(result, null, 2));
    }
}).catch(console.error);
