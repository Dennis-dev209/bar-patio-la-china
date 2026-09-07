/* ============================================
   AUTENTICACIÓN
   Bar Patio La China
   ============================================ */

const API_URL = window.location.origin + '/api';

// ============================================
// ELEMENTOS DEL DOM
// ============================================

const loginForm = document.getElementById('loginForm');
const forgotForm = document.getElementById('forgotForm');
const loginBtn = document.getElementById('loginBtn');
const forgotBtn = document.getElementById('forgotBtn');
const loginError = document.getElementById('loginError');
const forgotError = document.getElementById('forgotError');
const forgotSuccess = document.getElementById('forgotSuccess');

// ============================================
// UTILIDADES
// ============================================

// Mostrar/ocultar elementos
const showElement = (element) => element.classList.remove('hidden');
const hideElement = (element) => element.classList.add('hidden');

// Mostrar error
const showError = (element, message) => {
    element.querySelector('span').textContent = message;
    showElement(element);
};

// Ocultar error
const hideError = (element) => {
    hideElement(element);
};

// Toggle loading button
const setLoading = (btn, loading) => {
    const text = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.btn-loading');
    
    if (loading) {
        btn.disabled = true;
        hideElement(text);
        showElement(spinner);
    } else {
        btn.disabled = false;
        showElement(text);
        hideElement(spinner);
    }
};

// Escapar HTML (anti-XSS). En login no se carga api.js, por eso se duplica aquí.
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
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
};

// ============================================
// LOGIN
// ============================================

const handleLogin = async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Validar campos
    if (!email || !password) {
        showError(loginError, 'Por favor ingresa email y contraseña');
        return;
    }
    
    // Ocultar error anterior
    hideError(loginError);
    
    // Mostrar loading
    setLoading(loginBtn, true);
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Error al iniciar sesión');
        }
        
        // Guardar token y usuario
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.usuario));
        
        // Redirigir al dashboard
        window.location.href = '/inicio';
        
    } catch (error) {
        showError(loginError, error.message);
    } finally {
        setLoading(loginBtn, false);
    }
};

// ============================================
// RECUPERAR CONTRASEÑA
// ============================================

const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('forgotEmail').value;
    
    // Validar campo
    if (!email) {
        showError(forgotError, 'Por favor ingresa tu email');
        return;
    }
    
    // Ocultar mensajes anteriores
    hideError(forgotError);
    hideElement(forgotSuccess);
    
    // Mostrar loading
    setLoading(forgotBtn, true);
    
    try {
        const response = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Error al procesar solicitud');
        }
        
        // Mostrar mensaje de éxito
        showElement(forgotSuccess);
        
    } catch (error) {
        showError(forgotError, error.message);
    } finally {
        setLoading(forgotBtn, false);
    }
};

// ============================================
// NAVEGACIÓN ENTRE FORMULARIOS
// ============================================

const showLogin = () => {
    hideElement(forgotForm);
    showElement(loginForm);
    hideError(loginError);
    hideError(forgotError);
    hideElement(forgotSuccess);
};

const showForgotPassword = () => {
    hideElement(loginForm);
    showElement(forgotForm);
    hideError(loginError);
    hideError(forgotError);
    hideElement(forgotSuccess);
};

// ============================================
// TOGGLE PASSWORD VISIBILITY
// ============================================

const togglePassword = () => {
    const passwordInput = document.getElementById('password');
    const icon = document.querySelector('.toggle-password i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        icon.className = 'fas fa-eye';
    }
};

// ============================================
// VERIFICAR SESIÓN
// ============================================

const checkSession = () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        // Ya hay sesión activa, redirigir al dashboard
        window.location.href = '/inicio';
    }
};

// ============================================
// EVENT LISTENERS
// ============================================

if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
}

if (forgotForm) {
    forgotForm.addEventListener('submit', handleForgotPassword);
}

// Verificar sesión al cargar
document.addEventListener('DOMContentLoaded', () => {
    // Solo verificar si estamos en la página de login
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        checkSession();
    }
});

// Exportar funciones
window.togglePassword = togglePassword;
window.showLogin = showLogin;
window.showForgotPassword = showForgotPassword;
