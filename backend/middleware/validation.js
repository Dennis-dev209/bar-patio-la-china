// ============================================
// VALIDACIONES DE ENTRADA
// Bar Patio La China
// Centraliza las validaciones numéricas y de formato
// para que ningún dato basura llegue a la base de datos.
// ============================================

// Número finito (rechaza NaN, Infinity, strings no numéricos)
const toFiniteNumber = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (!Number.isFinite(num)) return null;
    return num;
};

// Importe: debe ser número finito mayor a 0
const parseImporte = (value) => {
    const num = toFiniteNumber(value);
    if (num === null || num <= 0) return null;
    return num;
};

// Tasa de cambio: número finito mayor a 0 (null = no proporcionada)
const parseTasa = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const num = toFiniteNumber(value);
    if (num === null || num <= 0) return null;
    return num;
};

// Cantidad de depósito: número finito mayor o igual a 0 (null = no proporcionada)
const parseCantidad = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const num = toFiniteNumber(value);
    if (num === null || num < 0) return null;
    return num;
};

// Fecha YYYY-MM-DD real (rechaza 2026-13-99, "abc", etc.)
const isValidDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y &&
        (date.getUTCMonth() + 1) === m &&
        date.getUTCDate() === d;
};

// Código de moneda ISO de 3 letras (se normaliza a mayúsculas).
// Validación por formato (no por lista cerrada) para no rechazar
// monedas legítimas futuras.
const parseMoneda = (value) => {
    if (typeof value !== 'string') return null;
    const code = value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return null;
    return code;
};

// ID entero positivo
const parseId = (value) => {
    const num = typeof value === 'number' ? value : parseInt(value, 10);
    if (!Number.isInteger(num) || num <= 0) return null;
    return num;
};

// Paginación segura: page >= 1, 1 <= limit <= maxLimit
const parsePagination = (page, limit, maxLimit = 100) => {
    let p = parseInt(page, 10);
    let l = parseInt(limit, 10);
    if (!Number.isInteger(p) || p < 1) p = 1;
    if (!Number.isInteger(l) || l < 1) l = 50;
    if (l > maxLimit) l = maxLimit;
    return { page: p, limit: l, offset: (p - 1) * l };
};

// Estados válidos de remesa
const ESTADOS_VALIDOS = ['pendiente', 'confirmado'];

module.exports = {
    toFiniteNumber,
    parseImporte,
    parseTasa,
    parseCantidad,
    isValidDate,
    parseMoneda,
    parseId,
    parsePagination,
    ESTADOS_VALIDOS
};
