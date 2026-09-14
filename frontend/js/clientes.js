/* ============================================
   MÓDULO DE CLIENTES (REMESEROS)
   Bar Patio La China
   ============================================ */

// ============================================
// VARIABLES GLOBALES
// ============================================

let allClientes = [];
let currentClienteId = null;
let currentDetallesCliente = null;

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
        // Defensa: aunque el backend ya filtra activo=1, filtrar aquí también
        // por si hay caché o datos viejos en memoria
        allClientes = (data.clientes || []).filter(c => Number(c.activo) === 1);
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
        pushReciente('cliente', { id, nombre: cliente.nombre });
        const stats = data.estadisticas;
        const ordenantes = [...(data.ordenantes || [])].sort((a, b) => (Number(b.monto_total) || 0) - (Number(a.monto_total) || 0));
        currentDetallesCliente = { cliente, ordenantes, estadisticas: stats };

        document.getElementById('detailsModalTitle').textContent = cliente.nombre;
        document.getElementById('detailsEditBtn').onclick = () => editCliente(id);

        const totalDepositos = ordenantes.reduce((s, o) => s + (Number(o.total_remesas) || 0), 0);
        const totalEUR = ordenantes.reduce((s, o) => s + (Number(o.monto_total_moneda ?? o.monto_total) || 0), 0);
        const totalPendEUR = ordenantes.reduce((s, o) => s + (Number(o.monto_pendiente_moneda ?? o.monto_pendiente) || 0), 0);
        const totalConfEUR = ordenantes.reduce((s, o) => s + (Number(o.monto_confirmado_moneda ?? o.monto_confirmado) || 0), 0);
        const totalCUP = ordenantes.reduce((s, o) => s + (Number(o.monto_total) || 0), 0);

        const rowsHtml = ordenantes.length > 0 ? ordenantes.map((o, idx) => {
            const mon = 'EUR';
            const tienePendiente = (Number(o.monto_pendiente_moneda ?? o.monto_pendiente) || 0) > 0;
            return `
                <tr onclick="viewOrdenanteDetails(${o.id})" style="cursor:pointer">
                    <td class="text-muted">${idx + 1}</td>
                    <td>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span class="cliente-avatar" style="width:28px;height:28px;font-size:0.7rem;flex-shrink:0;">${escapeHtml(getInitials(o.nombre))}</span>
                            <strong>${escapeHtml(o.nombre)}</strong>
                        </div>
                    </td>
                    <td><span class="badge badge-info">EUR</span></td>
                    <td>${o.total_remesas || 0}</td>
                    <td><strong>${formatCurrency(o.monto_total_moneda ?? o.monto_total, 'EUR')}</strong><br><small class="text-muted">≈ ${formatCurrency(o.monto_total, 'CUP')}</small></td>
                    <td class="text-warning">${formatCurrency(o.monto_pendiente_moneda ?? o.monto_pendiente, 'EUR')}<br><small class="text-muted">≈ ${formatCurrency(o.monto_pendiente, 'CUP')}</small></td>
                    <td class="text-success">${formatCurrency(o.monto_confirmado_moneda ?? o.monto_confirmado, 'EUR')}<br><small class="text-muted">≈ ${formatCurrency(o.monto_confirmado, 'CUP')}</small></td>
                    <td>${o.ultimo_deposito ? formatDate(o.ultimo_deposito) : '—'}</td>
                    <td>${tienePendiente ? '<span class="badge badge-warning">Pendiente</span>' : '<span class="badge badge-success">Al día</span>'}</td>
                </tr>`;
        }).join('') + `
                <tr style="font-weight:700;">
                    <td colspan="3">Total EUR</td>
                    <td>${totalDepositos}</td>
                    <td>${formatCurrency(totalEUR, 'EUR')}<br><small class="text-muted">≈ ${formatCurrency(totalCUP, 'CUP')}</small></td>
                    <td>${formatCurrency(totalPendEUR, 'EUR')}</td>
                    <td>${formatCurrency(totalConfEUR, 'EUR')}</td>
                    <td colspan="2"></td>
                </tr>` : `
                <tr><td colspan="9" class="text-center text-muted">No hay ordenantes registrados</td></tr>`;
        
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
                            <div class="stat-label">Pendiente (EUR)</div>
                            <div class="stat-value">${formatCurrency(stats.monto_pendiente_moneda ?? stats.monto_pendiente, 'EUR')}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-label">Confirmado (EUR)</div>
                            <div class="stat-value">${formatCurrency(stats.monto_confirmado_moneda ?? stats.monto_confirmado, 'EUR')}</div>
                        </div>
                    </div>
                </div>
                
                <div class="detalles-depositos">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:16px 0 12px;">
                        <h5 style="margin:0;">Ordenantes</h5>
                        <div style="display:flex;gap:8px;">
                            <button class="btn btn-sm btn-secondary" onclick="exportClienteExcel()">
                                <i class="fas fa-file-excel"></i> Excel
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="exportClientePDF()">
                                <i class="fas fa-file-pdf"></i> PDF
                            </button>
                        </div>
                    </div>
                    <div class="table-container"><table class="table"><thead><tr><th>#</th><th>Ordenante</th><th>Moneda</th><th>Depósitos</th><th>Importe total</th><th>Pendiente</th><th>Confirmado</th><th>Último depósito</th><th>Estado</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
                </div>
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
        document.querySelectorAll('.dropdown.active').forEach(d => d.classList.remove('active'));
        await viewClienteDetails(id);
        exportClienteExcel();
    } catch (error) {
        console.error('Error al generar resumen:', error);
        showToast('error', 'Error', 'No se pudo generar el resumen');
    }
};

// ============================================
// EXPORTAR RESUMEN DEL CLIENTE A EXCEL / PDF
// ============================================

const getClienteSafeFilename = (nombre) => {
    const base = String(nombre || 'Cliente').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').substring(0, 50) || 'Cliente';
    return base;
};

const exportClienteExcel = () => {
    try {
        if (typeof XLSX === 'undefined') {
            showToast('error', 'Error', 'No se pudo cargar la librería de Excel. Revisa tu conexión.');
            return;
        }
        if (!currentDetallesCliente || !currentDetallesCliente.cliente) {
            showToast('warning', 'Sin datos', 'Abre primero los detalles del cliente.');
            return;
        }
        const { cliente, ordenantes, estadisticas: stats } = currentDetallesCliente;
        const sorted = [...(ordenantes || [])].sort((a, b) => (Number(b.monto_total_moneda ?? b.monto_total) || 0) - (Number(a.monto_total_moneda ?? a.monto_total) || 0));
        const totalDepositos = sorted.reduce((s, o) => s + (Number(o.total_remesas) || 0), 0);
        const totalEUR = sorted.reduce((s, o) => s + (Number(o.monto_total_moneda ?? o.monto_total) || 0), 0);
        const totalPendEUR = sorted.reduce((s, o) => s + (Number(o.monto_pendiente_moneda ?? o.monto_pendiente) || 0), 0);
        const totalConfEUR = sorted.reduce((s, o) => s + (Number(o.monto_confirmado_moneda ?? o.monto_confirmado) || 0), 0);

        const wb = XLSX.utils.book_new();
        const resumenData = [
            ['RESUMEN DE CLIENTE'],
            ['Bar Patio La China'],
            [`Cliente: ${cliente.nombre || ''}`],
            [`Teléfono: ${cliente.telefono || 'Sin teléfono'}`],
            [`Fecha: ${new Date().toLocaleDateString('es-ES')}`],
            [''],
            ['Concepto', 'Valor'],
            ['Ordenantes', stats.total_ordenantes || 0],
            [`Pendiente (EUR)`, stats.monto_pendiente_moneda ?? stats.monto_pendiente],
            [`Confirmado (EUR)`, stats.monto_confirmado_moneda ?? stats.monto_confirmado],
            [''],
            ['#', 'Ordenante', 'Moneda', 'Depósitos', 'Importe total EUR', 'Ref CUP', 'Pendiente EUR', 'Confirmado EUR', 'Último depósito', 'Estado'],
            ...sorted.map((o, idx) => {
                return [
                    idx + 1,
                    o.nombre || '',
                    'EUR',
                    o.total_remesas || 0,
                    o.monto_total_moneda ?? o.monto_total,
                    o.monto_total || 0,
                    o.monto_pendiente_moneda ?? o.monto_pendiente,
                    o.monto_confirmado_moneda ?? o.monto_confirmado,
                    o.ultimo_deposito ? formatDate(o.ultimo_deposito) : '—',
                    (Number(o.monto_pendiente_moneda ?? o.monto_pendiente) || 0) > 0 ? 'Pendiente' : 'Al día'
                ];
            }),
            ['Total', '', '', totalDepositos, totalEUR, '', totalPendEUR, totalConfEUR, '', '']
        ];
        const ws = XLSX.utils.aoa_to_sheet(resumenData);
        XLSX.utils.book_append_sheet(wb, ws, 'Resumen');

        const fecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Resumen_${getClienteSafeFilename(cliente.nombre)}_${fecha}.xlsx`);

        showToast('success', 'Éxito', 'Resumen exportado a Excel');
    } catch (error) {
        console.error('Error al exportar:', error);
        showToast('error', 'Error', 'No se pudo exportar el resumen');
    }
};

const exportClientePDF = () => {
    try {
        if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
            showToast('error', 'Error', 'No se pudo cargar la librería de PDF. Revisa tu conexión.');
            return;
        }
        if (!currentDetallesCliente || !currentDetallesCliente.cliente) {
            showToast('warning', 'Sin datos', 'Abre primero los detalles del cliente.');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const { cliente, ordenantes, estadisticas: stats } = currentDetallesCliente;
        const sorted = [...(ordenantes || [])].sort((a, b) => (Number(b.monto_total) || 0) - (Number(a.monto_total) || 0));

        doc.setFontSize(20);
        doc.text('Resumen de Cliente', 105, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.text('Bar Patio La China', 105, 28, { align: 'center' });

        doc.setFontSize(10);
        doc.text(`Cliente: ${cliente.nombre || ''}`, 20, 38);
        doc.text(`Telefono: ${cliente.telefono || 'Sin telefono'}`, 20, 44);
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 20, 50);

        let y = 60;
        doc.setFontSize(14);
        doc.text('Estadisticas', 20, y);
        y += 10;

        doc.setFontSize(10);
        doc.text(`Ordenantes: ${stats.total_ordenantes || 0}`, 20, y);
        y += 7;
        doc.text(`Pendiente (EUR): ${formatCurrency(stats.monto_pendiente_moneda ?? stats.monto_pendiente, 'EUR')}`, 20, y);
        y += 7;
        doc.text(`Confirmado (EUR): ${formatCurrency(stats.monto_confirmado_moneda ?? stats.monto_confirmado, 'EUR')}`, 20, y);
        y += 15;

        doc.setFontSize(14);
        doc.text('Ordenantes', 20, y);
        y += 10;

        doc.setFontSize(9);
        sorted.forEach((o, idx) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            const estado = (Number(o.monto_pendiente_moneda ?? o.monto_pendiente) || 0) > 0 ? 'Pendiente' : 'Al dia';
            const fechaDep = o.ultimo_deposito ? formatDate(o.ultimo_deposito) : '—';
            doc.text(`${idx + 1}. ${o.nombre || ''} | EUR | Dep: ${o.total_remesas || 0} | Total: ${formatCurrency(o.monto_total_moneda ?? o.monto_total, 'EUR')} | ${estado} | ${fechaDep}`, 20, y);
            y += 7;
        });

        if (y > 270) {
            doc.addPage();
            y = 20;
        }
        const totalDepositos = sorted.reduce((s, o) => s + (Number(o.total_remesas) || 0), 0);
        const totalEUR = sorted.reduce((s, o) => s + (Number(o.monto_total_moneda ?? o.monto_total) || 0), 0);
        y += 3;
        doc.text(`Total depositos: ${totalDepositos} | Total EUR: ${formatCurrency(totalEUR, 'EUR')}`, 20, y);

        doc.setFontSize(8);
        doc.text('Generado por Sistema de Conciliación - Bar Patio La China', 105, 290, { align: 'center' });

        const fecha = new Date().toISOString().split('T')[0];
        doc.save(`Resumen_${getClienteSafeFilename(cliente.nombre)}_${fecha}.pdf`);

        showToast('success', 'Éxito', 'Resumen exportado a PDF');
    } catch (error) {
        console.error('Error al exportar PDF:', error);
        showToast('error', 'Error', 'No se pudo exportar el resumen');
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
        // Limpiar de Visitados recientemente (este cliente + sus ordenantes)
        try { if (typeof removeRecientesByRemesero === 'function') removeRecientesByRemesero(id); if (typeof removeReciente === 'function') removeReciente('cliente', id); } catch (e) {}
        // Optimista: quitar de memoria para que no parpadee el viejo
        allClientes = allClientes.filter(c => c.id !== id);
        renderClientes(allClientes);
        await loadClientes();
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

document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;
    loadUser();
    await loadClientes();
    // Apertura directa al detalle (desde Recientes o Buscador global)
    const detId = new URLSearchParams(window.location.search).get('detalle');
    if (detId) {
        window.history.replaceState({}, '', window.location.pathname);
        viewClienteDetails(parseInt(detId));
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
window.viewOrdenanteDetails = viewOrdenanteDetails;
window.viewOrdenantes = viewOrdenantes;
window.generateResumen = generateResumen;
window.exportClienteExcel = exportClienteExcel;
window.exportClientePDF = exportClientePDF;
window.deleteCliente = deleteCliente;
window.closeClienteModal = closeClienteModal;
window.closeDetailsModal = closeDetailsModal;
window.filterClientes = filterClientes;
window.logout = logout;
window.changePassword = changePassword;
