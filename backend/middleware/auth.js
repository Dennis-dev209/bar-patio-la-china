const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware para verificar JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido o expirado' });
    }
};

// Middleware para verificar rol de admin
const requireAdmin = (req, res, next) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ error: 'Acceso solo para administradores' });
    }
    next();
};

// Middleware para registrar auditoría
const logAudit = async (db, usuarioId, accion, tabla, registroId, datosAnteriores = null, datosNuevos = null, ipAddress = null) => {
    try {
        await db.query(
            `INSERT INTO auditoria (usuario_id, accion, tabla, registro_id, datos_anteriores, datos_nuevos, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [usuarioId, accion, tabla, registroId, 
             datosAnteriores ? JSON.stringify(datosAnteriores) : null,
             datosNuevos ? JSON.stringify(datosNuevos) : null,
             ipAddress]
        );
    } catch (error) {
        console.error('Error al registrar auditoría:', error);
    }
};

module.exports = {
    authenticateToken,
    requireAdmin,
    logAudit
};
