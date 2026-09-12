/* ============================================
   MÓDULO DE CLIENTES (REMESEROS)
   Bar Patio La China
   ============================================ */

// ============================================
// VARIABLES GLOBALES
// ============================================

let allClientes = [];
let currentClienteId = null;

// ============================================
// VERIFICAR AUTENTICACIÓN
// ============================================

const checkAuth = () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return false;
    }
    return true;
};

// ============================================
// CARGAR CLIENTES
// ============================================

const loadClientes = async () => {
    try {
        const data = await clientesService.getAll();
        allClientes = data.clientes;
        renderClientes(allClientes);
    } catch (error) {
        console.error('Error al cargar clientes:', error);
        document.getElementById('clientesGrid').innerHTML = `
            <div class="text-center text-muted p-xl">
                <i class="fas fa-exclamation-triangle"></i> No se pudo cargar. Revisa tu conexión.
                <br><br>
                <button class="btn btn-primary" onclick="loadClientes()">Reintentar</button>
            </div>`;
        showToast('error', 'Error', 'No se pudieron cargar los clientes');
    }
};

// ============================================
// RENDERIZAR CLIENTES
// ============================================

const renderClientes = (clientes) => {
    const grid = document.getElementById('clientesGrid');
    
    if (!clientes || clientes.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <h3 class="empty-state-title">No hay clientes</h3>
                <p class="empty-state-text">Comienza agregando tu primer cliente</p>
                <button class="btn btn-primary" onclick="openAddClienteModal()">
                    <i class="fas fa-plus"></i> Agregar Cliente
                </button>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = clientes.map(cliente => {
        try {
            return `
        <div class="cliente-card" onclick="viewClienteDetails(${cliente.id})">
            <div class="cliente-avatar">
                ${escapeHtml(getInitials(cliente.nombre))}
            </div>
            <div class="cliente-info">
                <div class="cliente-nombre">${escapeHtml(cliente.nombre)}</div>
                <div class="cliente-meta">
                    <span class="cliente-telefono">
                        <i class="fas fa-phone"></i> ${escapeHtml(cliente.telefono) || 'Sin teléfono'}
                    </span>
                    <span class="cliente-ordenantes">
                        <i class="fas fa-users"></i> ${cliente.total_ordenantes || 0} ordenantes
                    </span>
                </div>
            </div>
            <div class="cliente-montos">
                <div class="monto-total">${formatCurrency(cliente.monto_total_moneda ?? cliente.monto_total, cliente.ultima_moneda || 'CUP')}</div>
                <div class="monto-label">Total${cliente.ultima_moneda ? ' ' + escapeHtml(cliente.ultima_moneda) : ''}</div>
                <div class="status-indicator ${cliente.activo ? 'confirmed' : 'pending'}">
                    <span class="status-dot"></span>
                    ${cliente.activo ? 'Activo' : 'Inactivo'}
                </div>
            </div>
            <div class="dropdown" onclick="event.stopPropagation()">
                <button class="btn btn-ghost btn-icon sm" onclick="toggleDropdown(this)">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <div class="dropdown-menu">
                    <button class="dropdown-item" onclick="viewClienteDetails(${cliente.id})">
                        <i class="fas fa-eye"></i> Ver Detalles
                    </button>
                    <button class="dropdown-item" onclick="editCliente(${cliente.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="dropdown-item" onclick="viewOrdenantes(${cliente.id})">
                        <i class="fas fa-users"></i> Ver Ordenantes
                    </button>
                    <button class="dropdown-item" onclick="generateResumen(${cliente.id})">
                        <i class="fas fa-file-alt"></i> Generar Resumen
                    </button>
                    <div class="dropdown-divider"></div>
                    <button class="dropdown-item danger" onclick="deleteCliente(${cliente.id})">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        </div>
            `;
        } catch (e) {
            console.error('Error renderizando cliente', cliente && cliente.id, e);
            return '';
        }
    }).join('');
};

// ============================================
// FILTRAR CLIENTES
// ============================================

const filterClientes = () => {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    const filtered = allClientes.filter(cliente => 
        cliente.nombre.toLowerCase().includes(searchTerm) ||
        (cliente.telefono && cliente.telefono.includes(searchTerm))
    );
    
    renderClientes(filtered);
};

// ============================================
// ABRIR MODAL AGREGAR
// ============================================

const openAddClienteModal = () => {
    currentClienteId = null;
    document.getElementById('clienteModalTitle').textContent = 'Agregar Cliente';
    document.getElementById('clienteForm').reset();
    openModal('clienteModal');
};

// ============================================
// EDITAR CLIENTE
// ============================================

const editCliente = async (id) => {
    try {
        const data = await clientesService.getById(id);
        const cliente = data.cliente;
        
        currentClienteId = id;
        document.getElementById('clienteModalTitle').textContent = 'Editar Cliente';
        document.getElementById('clienteId').value = id;
        document.getElementById('clienteNombre').value = cliente.nombre;
        document.getElementById('clienteTelefono').value = cliente.telefono || '';
        document.getElementById('clienteDescripcion').value = cliente.descripcion || '';
        
        openModal('clienteModal');
    } catch (error) {
        showToast('error', 'Error', 'No se pudo cargar el cliente');
    }
};

// ============================================
// GUARDAR CLIENTE
// ============================================

const saveCliente = async () => {
    const nombre = document.getElementById('clienteNombre').value.trim();
    const telefono = document.getElementById('clienteTelefono').value.trim();
    const descripcion = document.getElementById('clienteDescripcion').value.trim();
    
    if (!nombre) {
        showToast('warning', 'Campo requerido', 'El nombre es obligatorio');
        return;
    }
    
    const clienteData = { nombre, telefono, descripcion };
    
    try {
        if (currentClienteId) {
            await clientesService.update(currentClienteId, clienteData);
            showToast('success', 'Éxito', 'Cliente actualizado correctamente');
        } else {
            await clientesService.create(clienteData);
            showToast('success', 'Éxito', 'Cliente creado correctamente');
        }
        
        closeClienteModal();
        loadClientes();
    } catch (error) {
        showToast('error', 'Error', error.message || 'No se pudo guardar el cliente');
    }
};

// ============================================
// VER DETALLES DEL CLIENTE
// ============================================

const viewClienteDetails = async (id) => {
    try {
        const data = await clientesService.getById(id);
        const cliente = data.cliente;
        const stats = data.estadisticas;
        const ordenantes = data.ordenantes;
        
        document.getElementById('detailsModalTitle').textContent = cliente.nombre;
        document.getElementById('detailsEditBtn').onclick = () => editCliente(id);
        
        const body = document.getElementById('detailsModalBody');
        body.innerHTML = `
            <div class="cliente-details">
                <div class="details-header">
                    <div class="cliente-avatar lg">
                        ${escapeHtml(getInitials(cliente.nombre))}
                    </div>
                    <div class="details-info">
                        <h4>${escapeHtml(cliente.nombre)}</h4>
                        <p>${escapeHtml(cliente.telefono) || 'Sin teléfono'}</p>
                        <p>${escapeHtml(cliente.descripcion) || 'Sin descripción'}</p>
                    </div>
                </div>
                
                <div class="stats-grid mt-lg">
                    <div class="stat-card">
                        <div class="stat-icon blue">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-label">Ordenantes</div>
                            <div class="stat-value">${stats.total_ordenantes || 0}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon yellow">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-label">Pendiente (${escapeHtml(stats.ultima_moneda || 'CUP')})</div>
                            <div class="stat-value">${formatCurrency(stats.monto_pendiente_moneda ?? stats.monto_pendiente, stats.ultima_moneda || 'CUP')}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-label">Confirmado (${escapeHtml(stats.ultima_moneda || 'CUP')})</div>
                            <div class="stat-value">${formatCurrency(stats.monto_confirmado_moneda ?? stats.monto_confirmado, stats.ultima_moneda || 'CUP')}</div>
                        </div>
                    </div>
                </div>
                
                <h5 class="mt-lg mb-md">Ordenantes</h5>
                ${ordenantes.length > 0 ? `
                    <div class="ordenantes-list">
                        ${ordenantes.map(o => `
                            <div class="ordenante-item" onclick="viewOrdenanteDetails(${o.id})">
                                <div class="ordenante-info">
                                    <strong>${escapeHtml(o.nombre)}</strong>
                                    <span>${escapeHtml(o.pais_origen) || 'Sin país'}</span>
                                </div>
                                <div class="ordenante-monto">
                                    ${o.ultima_moneda ? escapeHtml(o.ultima_moneda) + ' ' : ''}${formatCurrency(o.monto_total_moneda ?? o.monto_total, o.ultima_moneda || 'CUP')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="text-muted">No hay ordenantes registrados</p>'}
            </div>
        `;
        
        openModal('clienteDetailsModal');
    } catch (error) {
        showToast('error', 'Error', 'No se pudieron cargar los detalles');
    }
};

// ============================================
// VER ORDENANTES
// ============================================

const viewOrdenantes = (remeseroId) => {
    window.location.href = `/ordenantes/${remeseroId}`;
};

// ============================================
// GENERAR RESUMEN
// ============================================

const generateResumen = async (id) => {
    try {
        const data = await reportesService.getHistorialRemesero(id);
        // Aquí podrías generar un PDF o mostrar un resumen
        showToast('info', 'Info', 'Función de generar resumen en desarrollo');
    } catch (error) {
        showToast('error', 'Error', 'No se pudo generar el resumen');
    }
};

// ============================================
// ELIMINAR CLIENTE
// ============================================

const deleteCliente = async (id) => {
    const found = (typeof allClientes !== 'undefined' ? allClientes : []).find(c => c.id === id);
    const nombre = found ? found.nombre : '';
    const confirmed = await showConfirm(
        `¿Estás seguro de eliminar a "${nombre}"?\n\nEsta acción desactivará al cliente y todos sus ordenantes.`
    );
    
    if (!confirmed) return;
    
    try {
        await clientesService.delete(id);
        showToast('success', 'Éxito', 'Cliente eliminado correctamente');
        loadClientes();
    } catch (error) {
        showToast('error', 'Error', 'No se pudo eliminar el cliente');
    }
};

// ============================================
// VER DETALLES DEL ORDENANTE
// ============================================

const viewOrdenanteDetails = async (id) => {
    try {
        const data = await ordenantesService.getById(id);
        // Navegar a la página de ordenantes con este ordenante seleccionado
        window.location.href = `/ordenantes/${data.ordenante.remesero_id}?ordenante=${id}`;
    } catch (error) {
        showToast('error', 'Error', 'No se pudieron cargar los detalles del ordenante');
    }
};

// ============================================
// MODALES
// ============================================

const openModal = (modalId) => {
    document.getElementById(modalId).classList.add('active');
    document.body.style.overflow = 'hidden';
};

const closeClienteModal = () => {
    document.getElementById('clienteModal').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('clienteForm').reset();
    currentClienteId = null;
};

const closeDetailsModal = () => {
    document.getElementById('clienteDetailsModal').classList.remove('active');
    document.body.style.overflow = '';
};

// ============================================
// SIDEBAR & DROPDOWN
// ============================================

const toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
};

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

const changePassword = () => {
    showToast('info', 'Info', 'Función de cambio de contraseña en desarrollo');
};

// ============================================
// INICIALIZAR
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    if (checkAuth()) {
        loadUser();
        loadClientes();
    }
});

// Exportar funciones
window.loadClientes = loadClientes;
window.toggleSidebar = toggleSidebar;
window.toggleDropdown = toggleDropdown;
window.openAddClienteModal = openAddClienteModal;
window.editCliente = editCliente;
window.saveCliente = saveCliente;
window.viewClienteDetails = viewClienteDetails;
window.viewOrdenantes = viewOrdenantes;
window.generateResumen = generateResumen;
window.deleteCliente = deleteCliente;
window.closeClienteModal = closeClienteModal;
window.closeDetailsModal = closeDetailsModal;
window.filterClientes = filterClientes;
window.logout = logout;
window.changePassword = changePassword;
