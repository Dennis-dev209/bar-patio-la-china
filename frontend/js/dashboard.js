/* ============================================
   DASHBOARD
   Bar Patio La China
   ============================================ */

// ============================================
// VERIFICAR AUTENTICACIÓN
// ============================================

const checkAuth = () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = '/';
        return false;
    }
    
    return true;
};

// ============================================
// CARGAR DATOS DEL DASHBOARD
// ============================================

const loadDashboardData = async () => {
    try {
        // Cargar resumen
        const resumen = await reportesService.getResumen();
        updateStats(resumen.resumen);
        
        // Cargar pendientes
        const pendientes = await reportesService.getPendientes();
        updatePendientesTable(pendientes.pendientes.slice(0, 5));
        
        // Actualizar badge de pendientes
        updatePendingBadge(pendientes.totales.cantidad);
        
    } catch (error) {
        console.error('Error al cargar dashboard:', error);
        showToast('error', 'Error', 'No se pudieron cargar los datos del dashboard');
    }
};

// ============================================
// ACTUALIZAR ESTADÍSTICAS
// ============================================

const updateStats = (stats) => {
    document.getElementById('totalClientes').textContent = stats.total_remeseros || 0;
    document.getElementById('totalRemesas').textContent = stats.total_remesas || 0;
    document.getElementById('pendientes').textContent = stats.remesas_pendientes || 0;
    document.getElementById('pendientesMonto').textContent = formatCurrency(stats.monto_pendiente || 0);
    document.getElementById('confirmados').textContent = stats.remesas_confirmadas || 0;
    document.getElementById('confirmadosMonto').textContent = formatCurrency(stats.monto_confirmado || 0);
};

// ============================================
// ACTUALIZAR TABLA DE PENDIENTES
// ============================================

const updatePendientesTable = (remesas) => {
    const tbody = document.getElementById('pendientesTable');
    
    if (!remesas || remesas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted">
                    No hay remesas pendientes
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = remesas.map(remesa => `
        <tr>
            <td>${remesa.remesero_nombre}</td>
            <td>${remesa.ordenante_nombre}</td>
            <td>${formatDate(remesa.fecha_deposito)}</td>
            <td>${formatCurrency(remesa.importe_cup)}</td>
            <td>
                <span class="status-indicator pending">
                    <span class="status-dot"></span>
                    Pendiente
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-success" onclick="confirmarRemesa(${remesa.id})">
                    <i class="fas fa-check"></i> Confirmar
                </button>
            </td>
        </tr>
    `).join('');
};

// ============================================
// ACTUALIZAR BADGE DE PENDIENTES
// ============================================

const updatePendingBadge = (count) => {
    const badge = document.getElementById('pendingBadge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
    }
};

// ============================================
// CONFIRMAR REMESA
// ============================================

const confirmarRemesa = async (id) => {
    const confirmed = await showConfirm('¿Estás seguro de confirmar esta remesa?');
    
    if (!confirmed) return;
    
    try {
        await remesasService.confirm(id);
        showToast('success', 'Éxito', 'Remesa confirmada correctamente');
        loadDashboardData(); // Recargar datos
    } catch (error) {
        showToast('error', 'Error', error.message || 'No se pudo confirmar la remesa');
    }
};

// ============================================
// SIDEBAR TOGGLE
// ============================================

const toggleSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('mobile-open');
};

// ============================================
// DROPDOWN TOGGLE
// ============================================

const toggleDropdown = (button) => {
    const dropdown = button.closest('.dropdown');
    dropdown.classList.toggle('active');
};

// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown.active').forEach(d => {
            d.classList.remove('active');
        });
    }
});

// ============================================
// CARGAR USUARIO
// ============================================

const loadUser = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.getElementById('userName').querySelector('span').textContent = user.nombre;
    }
};

// ============================================
// LOGOUT
// ============================================

const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
};

// ============================================
// CAMBIAR CONTRASEÑA
// ============================================

const changePassword = async () => {
    // Por ahora, solo redirigir a una página de cambio de contraseña
    showToast('info', 'Info', 'Función de cambio de contraseña en desarrollo');
};

// ============================================
// INICIALIZAR
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    if (checkAuth()) {
        loadUser();
        loadDashboardData();
    }
});

// Exportar funciones
window.toggleSidebar = toggleSidebar;
window.toggleDropdown = toggleDropdown;
window.confirmarRemesa = confirmarRemesa;
window.logout = logout;
window.changePassword = changePassword;
