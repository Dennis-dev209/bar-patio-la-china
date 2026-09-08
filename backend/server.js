const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDatabase, db } = require('./config/database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Confiar solo en el primer proxy (Render/Cloudflare).
// Necesario para que req.ip y el rate limiting vean la IP real del cliente.
// Se usa el valor 1 (un solo salto) y NO true, para que un atacante
// no pueda falsificar X-Forwarded-For y evadir los límites.
app.set('trust proxy', 1);

// ============================================
// MIDDLEWARE DE SEGURIDAD
// ============================================

// Helmet para headers de seguridad.
// CSP parcial: el frontend usa manejadores inline (onclick), por lo que
// script-src debe permitir 'unsafe-inline' (el escapeHtml es la defensa
// real contra XSS). Este CSP aporta defensa en profundidad: bloquea
// <object>/<embed>, impide que otras páginas nos embeban y fija base-uri.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            // Helmet añade script-src-attr 'none' por defecto y eso mataría
            // todos los onclick de la app: se alinea con script-src.
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? (origin, callback) => {
            const allowed = ['https://bar-patio-la-china.onrender.com'];
            if (!origin || allowed.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('No permitido por CORS'));
            }
        }
        : (process.env.FRONTEND_URL || 'http://localhost:3000'),
    credentials: true
}));

// Handler común: el límite responde JSON (no texto plano) para que el
// frontend pueda leerlo sin romperse con "Unexpected token ... is not valid JSON".
const rateLimitHandler = (message) => (req, res) => {
    res.status(429).json({ error: message });
};

// Rate limiting general (prevenir abuso)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requests por ventana
    handler: rateLimitHandler('Demasiadas peticiones, intenta de nuevo más tarde')
});
app.use('/api/', limiter);

// Rate limiting específico para login (más estricto)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 intentos de login
    handler: rateLimitHandler('Demasiados intentos de login. Espera 15 minutos e intenta de nuevo.')
});
app.use('/api/auth/login', loginLimiter);

// ============================================
// MIDDLEWARE DE PARSEO
// ============================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// INICIALIZAR BASE DE DATOS
// ============================================

const startServer = async () => {
    try {
        console.log('🔧 Inicializando base de datos...');
        await initDatabase();
        console.log('✅ Base de datos inicializada');
        
        // Ejecutar schema
        const fs = require('fs');
        const schemaPath = path.join(__dirname, 'db/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        await db.query(schema);
        console.log('✅ Tablas creadas/verificadas');
        
        // Verificar si hay usuarios, si no crear admin
        const userCheck = await db.query("SELECT COUNT(*) as count FROM usuarios");
        if (Number(userCheck.rows[0].count) === 0) {
            console.log('📝 Creando usuario admin por defecto...');
            const bcrypt = require('bcryptjs');
            const salt = bcrypt.genSaltSync(10);
            const passwordHash = bcrypt.hashSync('admin123', salt);
            
            await db.query(
                `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)`,
                ['Administrador', 'admin@patiolachina.com', passwordHash, 'admin']
            );
            console.log('✅ Usuario admin creado: admin@patiolachina.com / admin123');
        }
        
        // ============================================
        // ARCHIVOS ESTÁTICOS (FRONTEND)
        // ============================================
        
        app.use(express.static(path.join(__dirname, '../frontend')));
        
        // ============================================
        // RUTAS DE LA API
        // ============================================
        
        // Rutas de autenticación
        const authRoutes = require('./routes/auth');
        app.use('/api/auth', authRoutes);
        
        // Rutas de clientes (remeseros)
        const clientesRoutes = require('./routes/clientes');
        app.use('/api/clientes', clientesRoutes);
        
        // Rutas de ordenantes
        const ordenantesRoutes = require('./routes/ordenantes');
        app.use('/api/ordenantes', ordenantesRoutes);
        
        // Rutas de remesas
        const remesasRoutes = require('./routes/remesas');
        app.use('/api/remesas', remesasRoutes);
        
        // Rutas de reportes
        const reportesRoutes = require('./routes/reportes');
        app.use('/api/reportes', reportesRoutes);
        
        // ============================================
        // RUTAS DEL FRONTEND (SPA)
        // ============================================
        
        // Login
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../frontend/index.html'));
        });
        
        // Inicio
        app.get('/inicio', (req, res) => {
            res.sendFile(path.join(__dirname, '../frontend/dashboard.html'));
        });
        
        // Clientes
        app.get('/clientes', (req, res) => {
            res.sendFile(path.join(__dirname, '../frontend/clientes.html'));
        });
        
        // Ordenantes (landing page - lista de clientes)
        app.get('/ordenantes', (req, res) => {
            res.sendFile(path.join(__dirname, '../frontend/ordenantes.html'));
        });
        
        // Ordenantes por remesero
        app.get('/ordenantes/:remeseroId', (req, res) => {
            res.sendFile(path.join(__dirname, '../frontend/ordenantes.html'));
        });
        
        // Conciliación
        app.get('/conciliacion', (req, res) => {
            res.sendFile(path.join(__dirname, '../frontend/remesas.html'));
        });
        
        // Remesas (compatibilidad)
        app.get('/remesas', (req, res) => {
            res.sendFile(path.join(__dirname, '../frontend/remesas.html'));
        });
        
        // Resumen/Reportes
        app.get('/resumen', (req, res) => {
            res.sendFile(path.join(__dirname, '../frontend/resumen.html'));
        });
        
        // Usuarios (solo admin)
        app.get('/usuarios', (req, res) => {
            res.sendFile(path.join(__dirname, '../frontend/usuarios.html'));
        });
        
        // ============================================
        // MANEJO DE ERRORES
        // ============================================
        
        // 404 - Ruta no encontrada
        app.use((req, res) => {
            res.status(404).json({ error: 'Ruta no encontrada' });
        });
        
        // Error general del servidor
        app.use((err, req, res, next) => {
            console.error('Error del servidor:', err);
            res.status(500).json({ error: 'Error interno del servidor' });
        });
        
        // ============================================
        // INICIAR SERVIDOR
        // ============================================
        
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
            console.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
            console.log(`👤 Usuario: admin@patiolachina.com / admin123`);
        });
        
    } catch (error) {
        console.error('❌ Error al iniciar servidor:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
