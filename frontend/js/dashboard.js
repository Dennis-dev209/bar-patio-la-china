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
        updateStats(resumen.resumen, resumen.por_moneda || []);
        
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

const updateStats = (stats, porMoneda = []) => {
    document.getElementById('totalClientes').textContent = stats.total_remeseros || 0;
    document.getElementById('totalRemesas').textContent = stats.total_remesas || 0;
    document.getElementById('pendientes').textContent = stats.remesas_pendientes || 0;
    document.getElementById('pendientesMonto').innerHTML = formatMontosPorMoneda(porMoneda, 'monto_pendiente', stats.monto_pendiente);
    document.getElementById('confirmados').textContent = stats.remesas_confirmadas || 0;
    document.getElementById('confirmadosMonto').innerHTML = formatMontosPorMoneda(porMoneda, 'monto_confirmado', stats.monto_confirmado);
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
            <td>${escapeHtml(remesa.remesero_nombre)}</td>
            <td>${escapeHtml(remesa.ordenante_nombre)}</td>
            <td>${formatDate(remesa.fecha_deposito)}</td>
            <td><strong>${formatCurrency(remesa.importe, 'EUR')}</strong></td>
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
// VISITADOS RECIENTEMENTE (accesos directos al detalle)
// Valida contra el servidor para no mostrar eliminados (borrado externo u otra pestaña).
// ============================================

const renderRecientes = async () => {
    const card = document.getElementById('recientesCard');
    const list = document.getElementById('recientesList');
    if (!card || !list) return;
    
    let recientes = getRecientes();
    if (!recientes || recientes.length === 0) {
        card.style.display = 'none';
        return;
    }

    // Purga por antigüedad (30 días) y validación contra API (404 / inactivo = eliminado)
    const TREINTA_DIAS = 30 * 24 * 60 * 60 * 1000;
    const ahora = Date.now();
    recientes = recientes.filter(r => !r.ts || (ahora - r.ts) < TREINTA_DIAS);

    const checks = await Promise.allSettled(recientes.map(async (r) => {
        try {
            if (r.tipo === 'cliente') {
                const data = await clientesService.getById(r.id);
                if (!data || !data.cliente || Number(data.cliente.activo) === 0) return null;
                return r;
            } else if (r.tipo === 'ordenante') {
                const data = await ordenantesService.getById(r.id);
                if (!data || !data.ordenante || Number(data.ordenante.activo) === 0) return null;
                // Si el remesero del ordenante fue eliminado, también se va
                if (data.ordenante.remesero_id && r.remeseroId && Number(data.ordenante.remesero_id) !== Number(r.remeseroId)) {
                    // remesero cambió, mantener pero actualizar
                    r.remeseroId = data.ordenante.remesero_id;
                }
                return r;
            }
            return r;
        } catch (e) {
            const msg = (e && e.message) ? e.message : '';
            const status = e && e.status;
            // 404 o mensaje de no encontrado -> eliminado
            if (status === 404 || /no encontrado/i.test(msg)) return null;
            // Error de red / token -> conservar para no vaciar por fallo temporal
            return r;
        }
    }));

    const validos = checks.map((c, i) => c.status === 'fulfilled' ? c.value : recientes[i]).filter(Boolean);

    // Si hubo purgas, persistir
    if (validos.length !== recientes.length || validos.length !== getRecientes().length) {
        try { localStorage.setItem('recientes', JSON.stringify(validos.slice(0, 6))); } catch (e) {}
    }

    if (!validos || validos.length === 0) {
        card.style.display = 'none';
        return;
    }
    
    card.style.display = '';
    list.innerHTML = validos.map(r => {
        const esCliente = r.tipo === 'cliente';
        const url = esCliente
            ? `/clientes?detalle=${r.id}`
            : `/ordenantes/${r.remeseroId}?ordenante=${r.id}`;
        return `
            <a href="${url}" class="quick-action-btn">
                <i class="fas ${esCliente ? 'fa-users' : 'fa-user'}"></i>
                <span>${escapeHtml(r.nombre) || (esCliente ? 'Cliente' : 'Ordenante')}</span>
            </a>
        `;
    }).join('');
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

const changePassword = () => {
    if (typeof openChangeOwnPasswordModal === 'function') openChangeOwnPasswordModal();
    else if (window.openChangeOwnPasswordModal) window.openChangeOwnPasswordModal();
    else showToast('error', 'Error', 'No se pudo abrir el cambio de contraseña');
};

// ============================================
// INICIALIZAR
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    if (checkAuth()) {
        loadUser();
        await renderRecientes();
        loadDashboardData();
    }
});

// Exportar funciones
window.toggleSidebar = toggleSidebar;
window.toggleDropdown = toggleDropdown;
window.confirmarRemesa = confirmarRemesa;
window.logout = logout;
window.changePassword = changePassword;
