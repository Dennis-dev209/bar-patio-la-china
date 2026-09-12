/* ============================================
   MÓDULO DE REMESAS (CONCILIACIÓN)
   Bar Patio La China
   ============================================ */

// ============================================
// VARIABLES GLOBALES
// ============================================

let clientes = [];
let currentOrdenantes = [];
let currentDepositos = [];
let currentRemeseroId = null;
let currentOrdenanteId = null;
let currentVista = 'clientes';
let currentFilters = {};
let currentBusqueda = '';
let searchDepositos = [];
let searchDebounce = null;
let searchSeq = 0;

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
        clientes = data.clientes;
        renderClientesList(clientes);
    } catch (error) {
        console.error('Error al cargar clientes:', error);
        showToast('error', 'Error', 'No se pudieron cargar los clientes');
    }
};

// ============================================
// RENDERIZAR LISTA DE CLIENTES
// ============================================

const renderClientesList = (clientesList) => {
    const container = document.getElementById('clientesList');
    
    if (!clientesList || clientesList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <h3 class="empty-state-title">No hay clientes</h3>
                <p class="empty-state-text">Registra clientes para comenzar</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = clientesList.map(cliente => `
        <div class="cliente-card" onclick="selectCliente(${cliente.id})">
            <div class="cliente-avatar">
                ${escapeHtml(getInitials(cliente.nombre))}
            </div>
            <div class="cliente-info">
                <div class="cliente-nombre">${escapeHtml(cliente.nombre)}</div>
                <div class="cliente-meta">
                    <span><i class="fas fa-users"></i> ${cliente.total_ordenantes || 0} ordenantes</span>
                    <span><i class="fas fa-money-bill"></i> ${cliente.ultima_moneda ? escapeHtml(cliente.ultima_moneda) + ' ' : ''}${formatCurrency(cliente.monto_total_moneda ?? cliente.monto_total, cliente.ultima_moneda || 'CUP')}</span>
                </div>
            </div>
            <div class="cliente-status">
                <span class="status-indicator ${cliente.monto_pendiente > 0 ? 'pending' : 'confirmed'}">
                    <span class="status-dot"></span>
                    ${cliente.monto_pendiente > 0 ? 'Pendiente' : 'Al día'}
                </span>
            </div>
            <i class="fas fa-chevron-right"></i>
        </div>
    `).join('');
};

// ============================================
// SELECCIONAR CLIENTE
// ============================================

const selectCliente = async (remeseroId) => {
    currentRemeseroId = remeseroId;
    const cliente = clientes.find(c => c.id === remeseroId);
    const nombre = cliente ? cliente.nombre : '';
    document.getElementById('ordenantesTitle').textContent = `Ordenantes de ${nombre}`;
    
    try {
        const data = await ordenantesService.getByRemesero(remeseroId);
        renderOrdenantesList(data.ordenantes, remeseroId);
        showVista('ordenantes');
    } catch (error) {
        showToast('error', 'Error', 'No se pudieron cargar los ordenantes');
    }
};

// ============================================
// RENDERIZAR LISTA DE ORDENANTES
// ============================================

const renderOrdenantesList = (ordenantes, remeseroId) => {
    const container = document.getElementById('ordenantesList');
    
    if (!ordenantes || ordenantes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👤</div>
                <h3 class="empty-state-title">No hay ordenantes</h3>
                <p class="empty-state-text">Agrega ordenantes para este cliente</p>
            </div>
        `;
        return;
    }
    
    currentOrdenantes = ordenantes || [];
    container.innerHTML = ordenantes.map(ordenante => `
        <div class="ordenante-card" onclick="selectOrdenante(${ordenante.id}, ${remeseroId})">
            <div class="ordenante-info">
                <div class="ordenante-nombre">${escapeHtml(ordenante.nombre)}</div>
                <div class="ordenante-pais">
                    <i class="fas fa-globe"></i> ${escapeHtml(ordenante.pais_origen) || 'Sin país'}
                </div>
            </div>
            <div class="ordenante-stats">
                <div class="ordenante-monto">${ordenante.ultima_moneda ? escapeHtml(ordenante.ultima_moneda) + ' ' : ''}${formatCurrency(ordenante.monto_total_moneda ?? ordenante.monto_total, ordenante.ultima_moneda || 'CUP')}</div>
                <div class="ordenante-depositos">${ordenante.total_remesas || 0} depósitos</div>
            </div>
            <div class="ordenante-status">
                <span class="status-indicator ${ordenante.monto_pendiente > 0 ? 'pending' : 'confirmed'}">
                    <span class="status-dot"></span>
                    ${ordenante.monto_pendiente > 0 ? 'Pendiente' : 'Confirmado'}
                </span>
            </div>
            <i class="fas fa-chevron-right"></i>
        </div>
    `).join('');
};

// ============================================
// SELECCIONAR ORDENANTE
// ============================================

const selectOrdenante = async (ordenanteId, remeseroId) => {
    currentOrdenanteId = ordenanteId;
    const ordenante = currentOrdenantes.find(o => o.id === ordenanteId);
    const nombre = ordenante ? ordenante.nombre : '';
    document.getElementById('depositosTitle').textContent = `Depósitos de ${nombre}`;
    
    // Guardar remeseroId para nuevos depósitos
    document.getElementById('depositoRemeseroId').value = remeseroId;
    document.getElementById('depositoOrdenanteId').value = ordenanteId;
    
    try {
        const params = { ordenante_id: ordenanteId };
        if (currentFilters.estado) params.estado = currentFilters.estado;
        if (currentFilters.fecha_inicio) params.fecha_inicio = currentFilters.fecha_inicio;
        if (currentFilters.fecha_fin) params.fecha_fin = currentFilters.fecha_fin;
        const data = await remesasService.getAll(params);
        renderDepositosList(data.remesas);
        showVista('depositos');
    } catch (error) {
        showToast('error', 'Error', 'No se pudieron cargar los depósitos');
    }
};

// ============================================
// RENDERIZAR LISTA DE DEPÓSITOS
// ============================================

const renderDepositosList = (remesas) => {
    const container = document.getElementById('depositosList');
    currentDepositos = remesas || [];
    
    if (!remesas || remesas.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💸</div>
                <h3 class="empty-state-title">No hay depósitos</h3>
                <p class="empty-state-text">Registra el primer depósito para este ordenante</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = remesas.map(remesa => `
        <div class="deposito-card ${remesa.estado}">
            <div class="deposito-header">
                <div class="deposito-fecha">
                    <i class="fas fa-calendar"></i> ${formatDate(remesa.fecha_deposito)}
                </div>
                <span class="status-indicator ${remesa.estado}">
                    <span class="status-dot"></span>
                    ${remesa.estado === 'confirmado' ? 'Confirmado' : 'Pendiente'}
                </span>
            </div>
            <div class="deposito-body">
                <div class="deposito-monto">
                    <span class="monto-moneda">${escapeHtml(remesa.moneda)}</span>
                    <span class="monto-valor">${formatCurrency(remesa.importe, remesa.moneda)}</span>
                    <i class="fas fa-arrow-right"></i>
                    <span class="monto-cup">${formatCurrency(remesa.importe_cup)}</span>
                </div>
                ${remesa.referencia ? `
                    <div class="deposito-referencia">
                        <i class="fas fa-hashtag"></i> ${escapeHtml(remesa.referencia)}
                    </div>
                ` : ''}
            </div>
            <div class="deposito-footer">
                <button class="confirm-btn ${remesa.estado}" onclick="toggleConfirmacion(${remesa.id})">
                    ${remesa.estado === 'pendiente' ? 
                        '<i class="fas fa-check"></i> Confirmar' : 
                        '<i class="fas fa-undo"></i> Desconfirmar'}
                </button>
                <button class="btn btn-ghost btn-sm" onclick="deleteDeposito(${remesa.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
};

// ============================================
// TOGGLE CONFIRMACIÓN
// ============================================

const toggleConfirmacion = async (id) => {
    // El estado se resuelve desde el caché (nunca desde strings interpolados en onclick).
    // Busca primero en la vista actual (depósitos o resultados de búsqueda).
    const deposito = (currentVista === 'busqueda' ? searchDepositos : currentDepositos).find(d => d.id === id)
        || currentDepositos.find(d => d.id === id)
        || searchDepositos.find(d => d.id === id);
    const estadoActual = deposito ? deposito.estado : 'pendiente';
    const accion = estadoActual === 'pendiente' ? 'confirmar' : 'desconfirmar';
    const mensaje = estadoActual === 'pendiente' ? 
        '¿Confirmar que recibiste este pago?' : 
        '¿Marcar este pago como pendiente?';
    
    const confirmed = await showConfirm(mensaje);
    if (!confirmed) return;
    
    try {
        if (estadoActual === 'pendiente') {
            await remesasService.confirm(id);
            showToast('success', 'Éxito', 'Pago confirmado');
        } else {
            await remesasService.unconfirm(id);
            showToast('success', 'Éxito', 'Pago marcado como pendiente');
        }
        
        // Recargar la vista actual (depósitos o resultados de búsqueda)
        if (currentVista === 'busqueda') {
            searchOrdenantes(true);
        } else {
            selectOrdenante(currentOrdenanteId, currentRemeseroId, document.getElementById('depositosTitle').textContent.replace('Depósitos de ', ''));
        }
    } catch (error) {
        showToast('error', 'Error', 'No se pudo actualizar el estado');
    }
};

// ============================================
// ELIMINAR DEPÓSITO
// ============================================

const deleteDeposito = async (id) => {
    const confirmed = await showConfirm('¿Eliminar este depósito?');
    if (!confirmed) return;
    
    try {
        await remesasService.delete(id);
        showToast('success', 'Éxito', 'Depósito eliminado');
        
        // Recargar depósitos
        selectOrdenante(currentOrdenanteId, currentRemeseroId, document.getElementById('depositosTitle').textContent.replace('Depósitos de ', ''));
    } catch (error) {
        showToast('error', 'Error', 'No se pudo eliminar el depósito');
    }
};

// ============================================
// ABRIR MODAL AGREGAR DEPÓSITO
// ============================================

const openAddDepositoModal = () => {
    if (!currentOrdenanteId) {
        showToast('warning', 'Atención', 'Selecciona un ordenante primero');
        return;
    }
    
    document.getElementById('depositoModalTitle').textContent = 'Nuevo Depósito';
    document.getElementById('depositoForm').reset();
    document.getElementById('depositoOrdenanteId').value = currentOrdenanteId;
    document.getElementById('depositoRemeseroId').value = currentRemeseroId;
    
    // Establecer fecha actual
    document.getElementById('depositoFecha').valueAsDate = new Date();

    // Moneda EUR (única) y tasa limpia (el usuario la escribe)
    document.getElementById('depositoMoneda').value = 'EUR';
    document.getElementById('depositoTasa').value = '';
    syncTasaForMoneda(document.getElementById('depositoMoneda'), document.getElementById('depositoTasa'));

    calculateImporteCUP();
    openModal('depositoModal');
};

// ============================================
// CALCULAR IMPORTE CUP
// ============================================

const calculateImporteCUP = () => {
    const importe = parseFloat(document.getElementById('depositoImporte').value) || 0;
    const tasa = parseFloat(document.getElementById('depositoTasa').value) || 1;
    const moneda = document.getElementById('depositoMoneda').value;
    
    let importeCUP;
    if (moneda === 'CUP') {
        importeCUP = importe;
    } else {
        importeCUP = importe * tasa;
    }
    
    document.getElementById('depositoImporteCUP').textContent = formatCurrency(importeCUP);
};

// ============================================
// GUARDAR DEPÓSITO
// ============================================

const saveDeposito = async () => {
    const ordenanteId = document.getElementById('depositoOrdenanteId').value;
    const remeseroId = document.getElementById('depositoRemeseroId').value;
    const moneda = document.getElementById('depositoMoneda').value;
    const importe = parseFloat(document.getElementById('depositoImporte').value);
    const tasa = parseFloat(document.getElementById('depositoTasa').value);
    const fecha = document.getElementById('depositoFecha').value;
    const referencia = document.getElementById('depositoReferencia').value.trim();
    const cantidad = parseFloat(document.getElementById('depositoCantidad').value) || null;
    
    if (!ordenanteId || !remeseroId || !importe || !fecha) {
        showToast('warning', 'Campos requeridos', 'Completa todos los campos obligatorios');
        return;
    }

    if (!tasa || !(tasa > 0)) {
        showToast('warning', 'Tasa requerida', 'Escribe la tasa de cambio (mayor a 0)');
        return;
    }
    
    const depositoData = {
        ordenante_id: parseInt(ordenanteId),
        remesero_id: parseInt(remeseroId),
        moneda,
        importe,
        tasa_cambio: tasa,
        fecha_deposito: fecha,
        referencia,
        cantidad_deposito: cantidad
    };
    
    try {
        const depositoId = document.getElementById('depositoId').value;
        
        if (depositoId) {
            await remesasService.update(depositoId, depositoData);
            showToast('success', 'Éxito', 'Depósito actualizado');
        } else {
            await remesasService.create(depositoData);
            showToast('success', 'Éxito', 'Depósito registrado');
        }
        
        closeDepositoModal();
        
        // Recargar depósitos
        selectOrdenante(currentOrdenanteId, currentRemeseroId, document.getElementById('depositosTitle').textContent.replace('Depósitos de ', ''));
    } catch (error) {
        showToast('error', 'Error', error.message || 'No se pudo guardar el depósito');
    }
};

// ============================================
// FILTROS
// ============================================

const applyFilters = () => {
    currentFilters = {
        estado: document.getElementById('filterEstado').value,
        fecha_inicio: document.getElementById('filterFechaInicio').value,
        fecha_fin: document.getElementById('filterFechaFin').value
    };
    
    // Si estamos en la vista de depósitos o búsqueda, recargar
    if (currentVista === 'depositos' && currentOrdenanteId) {
        selectOrdenante(currentOrdenanteId, currentRemeseroId, document.getElementById('depositosTitle').textContent.replace('Depósitos de ', ''));
    } else if (currentVista === 'busqueda' && currentBusqueda) {
        searchOrdenantes(true);
    }
};

const clearFilters = () => {
    document.getElementById('filterEstado').value = '';
    document.getElementById('filterFechaInicio').value = '';
    document.getElementById('filterFechaFin').value = '';
    currentFilters = {};
    
    if (currentVista === 'depositos' && currentOrdenanteId) {
        selectOrdenante(currentOrdenanteId, currentRemeseroId, document.getElementById('depositosTitle').textContent.replace('Depósitos de ', ''));
    } else if (currentVista === 'busqueda' && currentBusqueda) {
        searchOrdenantes(true);
    }
};

// ============================================
// BUSCAR ORDENANTE POR NOMBRE (todas las clientes)
// ============================================

const searchOrdenantes = async (mantenerTexto = false) => {
    if (!mantenerTexto) {
        currentBusqueda = document.getElementById('searchOrdenante').value.trim();
    }
    
    if (!currentBusqueda || currentBusqueda.length < 2) {
        showToast('warning', 'Atención', 'Escribe al menos 2 letras para buscar');
        return;
    }
    
    clearTimeout(searchDebounce);
    runBusqueda();
};

// Búsqueda en vivo: filtra mientras escribes (con pausa de 400ms).
// El botón Buscar y Enter siguen funcionando igual.
const onSearchInput = () => {
    clearTimeout(searchDebounce);
    const texto = document.getElementById('searchOrdenante').value.trim();
    
    if (texto.length < 2) {
        // Sin suficientes letras no se llama a la API; si ya estaba
        // viendo resultados, se muestra el aviso en esa vista.
        if (currentVista === 'busqueda') {
            currentBusqueda = texto;
            document.getElementById('busquedaTitle').textContent = 'Buscar ordenante';
            document.getElementById('busquedaList').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <h3 class="empty-state-title">Sigue escribiendo</h3>
                    <p class="empty-state-text">Escribe al menos 2 letras para buscar</p>
                </div>
            `;
        }
        return;
    }
    
    searchDebounce = setTimeout(() => {
        // Si el texto cambió mientras esperaba, esta búsqueda ya no vale
        if (document.getElementById('searchOrdenante').value.trim() !== texto) return;
        currentBusqueda = texto;
        runBusqueda();
    }, 400);
};

const runBusqueda = async () => {
    const seq = ++searchSeq;
    
    document.getElementById('searchOrdenante').value = currentBusqueda;
    document.getElementById('busquedaTitle').textContent = `Resultados para "${currentBusqueda}"`;
    document.getElementById('busquedaList').innerHTML = `
        <div class="text-center text-muted p-xl">
            <i class="fas fa-spinner fa-spin"></i> Buscando...
        </div>
    `;
    showVista('busqueda');
    
    try {
        const params = {};
        if (currentFilters.estado) params.estado = currentFilters.estado;
        const data = await ordenantesService.buscar(currentBusqueda, params);
        // Si el usuario ya escribió más, esta respuesta es vieja: se descarta
        if (seq !== searchSeq) return;
        renderBusqueda(data.resultados || []);
    } catch (error) {
        if (seq !== searchSeq) return;
        console.error('Error al buscar ordenantes:', error);
        showToast('error', 'Error', error.message || 'No se pudo buscar');
        document.getElementById('busquedaList').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3 class="empty-state-title">No se pudo buscar</h3>
                <p class="empty-state-text">Inténtalo de nuevo</p>
            </div>
        `;
    }
};

const renderBusqueda = (resultados) => {
    const container = document.getElementById('busquedaList');
    searchDepositos = [];
    
    if (!resultados || resultados.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <h3 class="empty-state-title">Sin resultados</h3>
                <p class="empty-state-text">Ningún ordenante coincide con "${escapeHtml(currentBusqueda)}"</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = resultados.map(grupo => {
        const depositos = grupo.depositos || [];
        searchDepositos = searchDepositos.concat(depositos);
        const pendientes = depositos.filter(d => d.estado === 'pendiente').length;
        
        const depositosHTML = depositos.length === 0
            ? '<div class="text-center text-muted p-md">Este ordenante no tiene depósitos con el filtro actual</div>'
            : depositos.map(remesa => `
                <div class="deposito-card ${remesa.estado}">
                    <div class="deposito-header">
                        <div class="deposito-fecha">
                            <i class="fas fa-calendar"></i> ${formatDate(remesa.fecha_deposito)}
                        </div>
                        <span class="status-indicator ${remesa.estado}">
                            <span class="status-dot"></span>
                            ${remesa.estado === 'confirmado' ? 'Confirmado' : 'Pendiente'}
                        </span>
                    </div>
                    <div class="deposito-body">
                        <div class="deposito-monto">
                            <span class="monto-moneda">${escapeHtml(remesa.moneda)}</span>
                            <span class="monto-valor">${formatCurrency(remesa.importe, remesa.moneda)}</span>
                            <i class="fas fa-arrow-right"></i>
                            <span class="monto-cup">${formatCurrency(remesa.importe_cup)}</span>
                        </div>
                        ${remesa.referencia ? `
                            <div class="deposito-referencia">
                                <i class="fas fa-hashtag"></i> ${escapeHtml(remesa.referencia)}
                            </div>
                        ` : ''}
                    </div>
                    <div class="deposito-footer">
                        <button class="confirm-btn ${remesa.estado}" onclick="toggleConfirmacion(${remesa.id})">
                            ${remesa.estado === 'pendiente' ? 
                                '<i class="fas fa-check"></i> Confirmar' : 
                                '<i class="fas fa-undo"></i> Desconfirmar'}
                        </button>
                    </div>
                </div>
            `).join('');
        
        return `
            <div class="busqueda-grupo">
                <div class="busqueda-grupo-header">
                    <div class="busqueda-ordenante">
                        <i class="fas fa-user"></i> ${escapeHtml(grupo.nombre)}
                    </div>
                    <div class="busqueda-cliente">
                        <i class="fas fa-users"></i> Cliente: ${escapeHtml(grupo.remesero_nombre)}
                    </div>
                    <span class="status-indicator ${pendientes > 0 ? 'pendiente' : 'confirmado'}">
                        <span class="status-dot"></span>
                        ${pendientes > 0 ? `${pendientes} pendiente${pendientes !== 1 ? 's' : ''}` : 'Al día'}
                    </span>
                </div>
                <div class="depositos-list">
                    ${depositosHTML}
                </div>
            </div>
        `;
    }).join('');
};

// ============================================
// NAVEGACIÓN ENTRE VISTAS
// ============================================

const showVista = (vista) => {
    document.querySelectorAll('.vista-actual').forEach(v => v.classList.add('hidden'));
    document.getElementById(`vista${vista.charAt(0).toUpperCase() + vista.slice(1)}`).classList.remove('hidden');
    currentVista = vista;
};

// ============================================
// MODALES
// ============================================

const openModal = (modalId) => {
    document.getElementById(modalId).classList.add('active');
    document.body.style.overflow = 'hidden';
};

const closeDepositoModal = () => {
    document.getElementById('depositoModal').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('depositoForm').reset();
    document.getElementById('depositoId').value = '';
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
window.toggleSidebar = toggleSidebar;
window.toggleDropdown = toggleDropdown;
window.selectCliente = selectCliente;
window.selectOrdenante = selectOrdenante;
window.toggleConfirmacion = toggleConfirmacion;
window.deleteDeposito = deleteDeposito;
window.openAddDepositoModal = openAddDepositoModal;
window.saveDeposito = saveDeposito;
window.closeDepositoModal = closeDepositoModal;
window.showVista = showVista;
window.searchOrdenantes = searchOrdenantes;
window.onSearchInput = onSearchInput;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.logout = logout;
window.changePassword = changePassword;
