/* ============================================
   API HELPER
   Bar Patio La China
   ============================================ */

const API_BASE_URL = window.location.origin + '/api';

// ============================================
// OBTENER TOKEN
// ============================================

const getToken = () => {
    return localStorage.getItem('token');
};

// ============================================
// REQUEST GENÉRICO
// ============================================

const apiRequest = async (endpoint, options = {}) => {
    const token = getToken();
    
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };
    
    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };
    
    // Timeout: si el servidor está despertando (plan gratis) la petición
    // puede colgar. A los 30 s se aborta para mostrar Reintentar en vez
    // de un "cargando" eterno (al reintentar el servidor ya despertó).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...config, signal: controller.signal });
        clearTimeout(timeoutId);

        // Si el token expiró o es inválido
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
            return;
        }
        
        // Parseo defensivo: si el servidor responde texto plano
        // (ej. un 429 del rate limit), no romper con "Unexpected token".
        const rawText = await response.text();
        let data = {};
        try {
            data = rawText ? JSON.parse(rawText) : {};
        } catch (e) {
            data = { error: rawText || 'Error en la petición' };
        }

        if (response.status === 429) {
            throw new Error(data.error || 'Demasiadas peticiones. Espera unos minutos e intenta de nuevo.');
        }

        if (!response.ok) {
            throw new Error(data.error || 'Error en la petición');
        }

        return data;

    } catch (error) {
        clearTimeout(timeoutId);
        console.error('API Error:', error);
        if (error && error.name === 'AbortError') {
            throw new Error('El servidor tardó demasiado en responder. Pulsa Reintentar.');
        }
        throw error;
    }
};

// ============================================
// MÉTODOS HTTP
// ============================================

const api = {
    // GET
    get: (endpoint) => {
        return apiRequest(endpoint, { method: 'GET' });
    },
    
    // POST
    post: (endpoint, body) => {
        return apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },
    
    // PUT
    put: (endpoint, body) => {
        return apiRequest(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    },
    
    // DELETE
    delete: (endpoint) => {
        return apiRequest(endpoint, { method: 'DELETE' });
    }
};

// ============================================
// SERVICIOS ESPECÍFICOS
// ============================================

// Auth
const authService = {
    login: (email, password) => api.post('/auth/login', { email, password }),
    getMe: () => api.get('/auth/me'),
    changePassword: (currentPassword, newPassword) => 
        api.put('/auth/change-password', { currentPassword, newPassword }),
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    resetPassword: (token, newPassword) => 
        api.post('/auth/reset-password', { token, newPassword })
};

// Clientes (Remeseros)
const clientesService = {
    getAll: () => api.get('/clientes'),
    getById: (id) => api.get(`/clientes/${id}`),
    create: (data) => api.post('/clientes', data),
    update: (id, data) => api.put(`/clientes/${id}`, data),
    delete: (id) => api.delete(`/clientes/${id}`),
    restore: (id) => api.put(`/clientes/${id}/restaurar`, {})
};

// Ordenantes
const ordenantesService = {
    getByRemesero: (remeseroId) => api.get(`/ordenantes/remesero/${remeseroId}`),
    getById: (id) => api.get(`/ordenantes/${id}`),
    getDetalles: (id) => api.get(`/ordenantes/${id}/detalles`),
    create: (data) => api.post('/ordenantes', data),
    update: (id, data) => api.put(`/ordenantes/${id}`, data),
    delete: (id) => api.delete(`/ordenantes/${id}`),
    buscar: (q, params = {}) => {
        const queryString = new URLSearchParams({ q, ...params }).toString();
        return api.get(`/ordenantes/buscar?${queryString}`);
    }
};

// Remesas
const remesasService = {
    getAll: (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return api.get(`/remesas?${queryString}`);
    },
    getById: (id) => api.get(`/remesas/${id}`),
    create: (data) => api.post('/remesas', data),
    update: (id, data) => api.put(`/remesas/${id}`, data),
    confirm: (id) => api.put(`/remesas/${id}/confirmar`),
    unconfirm: (id) => api.put(`/remesas/${id}/desconfirmar`),
    delete: (id) => api.delete(`/remesas/${id}`),
    getPendingCount: () => api.get('/remesas/pendientes/count')
};

// Reportes
const reportesService = {
    getResumen: () => api.get('/reportes/resumen'),
    getPorPeriodo: (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return api.get(`/reportes/por-periodo?${queryString}`);
    },
    getPorRemesero: (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return api.get(`/reportes/por-remesero?${queryString}`);
    },
    getPendientes: () => api.get('/reportes/pendientes'),
    getHistorialRemesero: (id, params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return api.get(`/reportes/historial-remesero/${id}?${queryString}`);
    },
    getHistorialOrdenante: (id) => api.get(`/reportes/historial-ordenante/${id}`)
};

// ============================================
// UTILIDADES
// ============================================

// Formatear moneda (tolerante: un código inválido no rompe la página)
const formatCurrency = (amount, currency = 'CUP') => {
    const num = Number(amount);
    const safeAmount = Number.isFinite(num) ? num : 0;
    try {
        const formatter = new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        });
        return formatter.format(safeAmount);
    } catch (e) {
        return `${safeAmount.toFixed(2)} ${currency || ''}`.trim();
    }
};

// Formatear fecha
const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

// Formatear fecha y hora
const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Obtener iniciales
const getInitials = (name) => {
    if (!name) return '?';
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
};

// Escapar HTML para prevenir XSS al interpolar datos de la BD.
// Convierte & < > " ' en entidades. Usar SIEMPRE al mostrar
// nombre, email, teléfono, descripción, referencia, etc.
const escapeHtml = (value) => {
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// Toast notification
const showToast = (type, title, message) => {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="${icons[type]} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(title)}</div>
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
};

// Sincronizar tasa con la moneda: si es CUP la tasa siempre es 1
// (se bloquea el campo); en otro caso se libera y se limpia para
// que el usuario escriba la tasa que quiera.
const syncTasaForMoneda = (monedaSelect, tasaInput) => {
    if (!monedaSelect || !tasaInput) return;
    if (monedaSelect.value === 'CUP') {
        tasaInput.value = '1';
        tasaInput.disabled = true;
    } else {
        tasaInput.disabled = false;
        if (tasaInput.value === '1') tasaInput.value = '';
    }
};

// Formatear montos del desglose por moneda (por_moneda del resumen).
// Una sola moneda: "USD 1,250.00". Varias: una línea por moneda.
// Si está vacío, usa el monto CUP de respaldo.
const formatMontosPorMoneda = (porMoneda, campo, respaldoCUP) => {
    if (porMoneda && porMoneda.length > 0) {
        return porMoneda
            .map(m => `${escapeHtml(m.moneda)} ${formatCurrency(m[campo] || 0, m.moneda)}`)
            .join('<br>');
    }
    return formatCurrency(respaldoCUP || 0, 'CUP');
};

// ============================================
// CIERRE DE SESIÓN POR INACTIVIDAD (20 min)
// Puesto compartido: si nadie toca la página en 20 minutos se cierra
// sola. Un minuto antes muestra un aviso con opción de seguir.
// La actividad se comparte entre pestañas vía localStorage.
// ============================================

const IDLE_LIMIT_MS = 20 * 60 * 1000; // 20 minutos
const IDLE_WARNING_MS = 60 * 1000; // avisar 1 minuto antes
const IDLE_CHECK_MS = 15 * 1000; // revisar cada 15 segundos
const IDLE_KEY = 'lastActivity';
let idleWarningShown = false;

const touchActivity = () => {
    try {
        localStorage.setItem(IDLE_KEY, String(Date.now()));
    } catch (e) { /* almacenamiento no disponible: no bloquear */ }
    idleWarningShown = false;
    dismissIdleWarning();
};

const getIdleMs = () => {
    const last = parseInt(localStorage.getItem(IDLE_KEY) || '0', 10);
    if (!last) {
        touchActivity();
        return 0;
    }
    return Date.now() - last;
};

const showIdleWarning = (remainingSec) => {
    if (document.getElementById('idleWarning')) return;
    const bar = document.createElement('div');
    bar.id = 'idleWarning';
    bar.setAttribute('style', 'position:fixed;top:0;left:0;right:0;z-index:3000;background:#7f1d1d;color:#fff;' +
        'padding:10px 16px;display:flex;align-items:center;justify-content:center;gap:12px;' +
        'font-size:14px;font-weight:600;box-shadow:0 2px 10px rgba(0,0,0,.4);');
    const msg = document.createElement('span');
    msg.id = 'idleWarningText';
    msg.textContent = `Tu sesión se cierra en ${remainingSec} s por inactividad.`;
    const btn = document.createElement('button');
    btn.textContent = 'Seguir trabajando';
    btn.setAttribute('style', 'background:#fff;color:#7f1d1d;border:none;border-radius:8px;' +
        'padding:6px 14px;font-weight:700;cursor:pointer;');
    btn.onclick = () => touchActivity();
    bar.appendChild(msg);
    bar.appendChild(btn);
    document.body.appendChild(bar);
};

const dismissIdleWarning = () => {
    const bar = document.getElementById('idleWarning');
    if (bar) bar.remove();
};

const forceIdleLogout = () => {
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem(IDLE_KEY);
        sessionStorage.setItem('sessionExpired', '1');
    } catch (e) { /* noop */ }
    window.location.href = '/';
};

const checkIdle = () => {
    // Sin sesión no hay nada que cerrar (ej. página de login)
    if (!localStorage.getItem('token')) return;

    const idle = getIdleMs();

    if (idle >= IDLE_LIMIT_MS) {
        forceIdleLogout();
        return;
    }

    if (idle >= IDLE_LIMIT_MS - IDLE_WARNING_MS) {
        const remaining = Math.max(1, Math.ceil((IDLE_LIMIT_MS - idle) / 1000));
        showIdleWarning(remaining);
        const txt = document.getElementById('idleWarningText');
        if (txt) txt.textContent = `Tu sesión se cierra en ${remaining} s por inactividad.`;
        idleWarningShown = true;
    } else if (idleWarningShown) {
        idleWarningShown = false;
        dismissIdleWarning();
    }
};

const initIdleWatcher = () => {
    ['click', 'keydown', 'scroll', 'touchstart', 'mousemove'].forEach(evt => {
        document.addEventListener(evt, touchActivity, { passive: true });
    });
    // Primera marca al cargar (cubre el caso de pestaña recién abierta)
    if (localStorage.getItem('token') && !localStorage.getItem(IDLE_KEY)) {
        touchActivity();
    }
    setInterval(checkIdle, IDLE_CHECK_MS);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIdleWatcher);
} else {
    initIdleWatcher();
}

// Confirm dialog
const showConfirm = (message) => {
    return new Promise((resolve) => {
        const confirmed = confirm(message);
        resolve(confirmed);
    });
};

// ============================================
// EXPORTAR
// ============================================

window.api = api;
window.authService = authService;
window.clientesService = clientesService;
window.ordenantesService = ordenantesService;
window.remesasService = remesasService;
window.reportesService = reportesService;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.getInitials = getInitials;
window.escapeHtml = escapeHtml;
window.formatMontosPorMoneda = formatMontosPorMoneda;
window.syncTasaForMoneda = syncTasaForMoneda;
window.showToast = showToast;
window.showConfirm = showConfirm;
