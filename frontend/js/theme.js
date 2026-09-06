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
});

// Exportar funciones
window.toggleTheme = toggleTheme;
