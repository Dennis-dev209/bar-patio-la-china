/* ============================================
   GESTIÓN DE TEMA (CLARO/OSCURO)
   Bar Patio La China
   ============================================ */

// Obtener tema guardado o usar oscuro por defecto
const getSavedTheme = () => {
    return localStorage.getItem('theme') || 'dark';
};

// Aplicar tema
const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Actualizar icono del toggle
    const toggleBtns = document.querySelectorAll('[onclick*="toggleTheme"]');
    toggleBtns.forEach(btn => {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        }
    });
};

// Alternar tema
const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
};

// Aplicar tema al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getSavedTheme());
    renderDbBadge();
});

// ============================================
// INSIGNIA DE BASE DE DATOS
// Muestra a qué BD estás conectado (nube o local) y conteos.
// Si la insignia dice "Local" en producción o los conteos son 0
// inesperadamente, NO sigas cargando datos: avisa.
// ============================================
const renderDbBadge = async () => {
    // Solo en páginas autenticadas (con token)
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const base = window.location.origin + '/api';
        const res = await fetch(base + '/health', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) return; // sin permiso o sin sesión: no mostrar nada
        const health = await res.json();

        const badge = document.createElement('div');
        badge.id = 'dbBadge';
        badge.className = 'db-badge ' + (health.db.mode === 'turso' ? 'db-cloud' : 'db-local');
        const dot = health.db.mode === 'turso' ? '●' : '○';
        badge.textContent = `${dot} ${health.db.label} · ${health.counts.remeseros} clientes · ${health.counts.remesas} remesas`;
        badge.title = `Conectado a: ${health.db.detail}`;
        document.body.appendChild(badge);
    } catch (e) {
        // Sin conexión al health: no bloquear la página
    }
};

// Exportar funciones
window.toggleTheme = toggleTheme;
