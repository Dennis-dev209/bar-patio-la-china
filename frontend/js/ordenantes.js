let currentRemeseroId = null;
let currentRemeseroNombre = '';
let ordenantes = [];
let landingClientes = [];

const checkAuth = () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return false;
    }
    return true;
};

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    loadUserInfo();
    checkPending();

    const pathParts = window.location.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];

    if (lastPart && !isNaN(lastPart)) {
        currentRemeseroId = parseInt(lastPart);
        document.getElementById('vistaClientesLanding').classList.add('hidden');
        document.getElementById('vistaOrdenantes').classList.remove('hidden');
        document.getElementById('backBtn').style.display = 'inline-flex';
        loadOrdenantes();
    } else {
        loadClientsLanding();
    }
});

function loadUserInfo() {
    try {
        const userData = JSON.parse(localStorage.getItem('user'));
        if (userData) {
            document.getElementById('userName').querySelector('span').textContent = `${userData.nombre} (${userData.rol})`;
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

function checkPending() {
    api.get('/reportes/resumen')
        .then(result => {
            const pendientes = result?.resumen?.remesas_pendientes || 0;
            document.getElementById('pendingBadge').textContent = pendientes;
        })
        .catch(error => {
            console.error('Error checking pending:', error);
        });
}

// ============================================
// VISTA LANDING: Lista de clientes
// ============================================
async function loadClientsLanding() {
    try {
        const result = await clientesService.getAll();
        renderClientsLanding(result.clientes);
    } catch (error) {
        console.error('Error loading clients:', error);
        showToast('error', 'Error', 'No se pudieron cargar los clientes');
    }
}

function renderClientsLanding(clientes) {
    const grid = document.getElementById('clientesLandingGrid');

    // Caché para resolver nombres por id sin interpolar strings en onclick (anti-XSS)
    landingClientes = clientes || [];

    if (!clientes || clientes.length === 0) {
        grid.innerHTML = '<div class="text-center text-muted p-xl"><i class="fas fa-info-circle"></i> No hay clientes registrados</div>';
        return;
    }

    grid.innerHTML = clientes.map(c => `
        <div class="client-card" onclick="goToOrdenantes(${c.id})">
            <div class="client-avatar">${escapeHtml(getInitials(c.nombre))}</div>
            <div class="client-name">${escapeHtml(c.nombre)}</div>
            <div class="client-stats">
                <span><i class="fas fa-exchange-alt"></i> ${c.total_remesas || 0} remesas</span>
                <span><i class="fas fa-user-friends"></i> ${c.total_ordenantes || 0} ordenantes</span>
            </div>
        </div>
    `).join('');
}

function goToOrdenantes(remeseroId) {
    currentRemeseroId = remeseroId;
    const found = landingClientes.find(c => c.id === remeseroId);
    if (found) currentRemeseroNombre = found.nombre;
    window.history.pushState({}, '', `/ordenantes/${remeseroId}`);
    document.getElementById('vistaClientesLanding').classList.add('hidden');
    document.getElementById('vistaOrdenantes').classList.remove('hidden');
    document.getElementById('backBtn').style.display = 'inline-flex';
    document.getElementById('pageTitle').textContent = `Ordenantes - ${nombre}`;
    loadOrdenantes();
}

// ============================================
// VISTA ORDENANTES
// ============================================
async function loadOrdenantes() {
    if (!currentRemeseroId) return;

    try {
        const result = await ordenantesService.getByRemesero(currentRemeseroId);

        currentRemeseroNombre = result.remesero?.nombre || currentRemeseroNombre;

        document.getElementById('remeseroNombre').textContent = currentRemeseroNombre;
        document.getElementById('remeseroAvatar').textContent = getInitials(currentRemeseroNombre);

        ordenantes = result.ordenantes || [];
        renderOrdenantes();
        updateStats();
    } catch (error) {
        console.error('Error loading ordenantes:', error);
        showToast('error', 'Error', 'No se pudieron cargar ordenantes');
    }
}

function renderOrdenantes() {
    const grid = document.getElementById('ordenantesGrid');

    if (!ordenantes || ordenantes.length === 0) {
        grid.innerHTML = '<div class="text-center text-muted p-xl"><i class="fas fa-info-circle"></i> No hay ordenantes registrados</div>';
        return;
    }

    grid.innerHTML = ordenantes.map(o => {
        const totalRemesas = o.total_remesas || 0;
        const moneda = o.ultima_moneda || 'CUP';
        const montoTotal = o.monto_total || 0;
        const montoPendiente = o.monto_pendiente || 0;

        return `
        <div class="ordenante-card">
            <div class="ordenante-menu-container">
                <button class="ordenante-menu-btn" onclick="toggleOrdenanteMenu(event, ${o.id})">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <div class="ordenante-dropdown" id="menu-${o.id}">
                    <button class="dropdown-item" onclick="showDetalles(${o.id})">
                        <i class="fas fa-eye"></i> Detalles
                    </button>
                    <button class="dropdown-item" onclick="openAddDepositoModal(${o.id})">
                        <i class="fas fa-plus-circle"></i> Agregar depósito
                    </button>
                    <button class="dropdown-item" onclick="openRenameModal(${o.id})">
                        <i class="fas fa-pen"></i> Renombrar
                    </button>
                    <button class="dropdown-divider"></button>
                    <button class="dropdown-item danger" onclick="deleteOrdenante(${o.id})">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
            <div class="ordenante-avatar">${escapeHtml(getInitials(o.nombre))}</div>
            <div class="ordenante-name">${escapeHtml(o.nombre)}</div>
            <div class="ordenante-stats">
                <span class="stat-badge blue"><i class="fas fa-receipt"></i> ${totalRemesas} depósito${totalRemesas !== 1 ? 's' : ''}</span>
                <span class="stat-badge ${moneda === 'USD' || moneda === 'EUR' ? 'green' : 'orange'}">${escapeHtml(moneda)}</span>
            </div>
            <div class="ordenante-monto ${montoPendiente > 0 ? 'pendiente' : ''}">${formatCurrency(montoTotal, moneda)}</div>
        </div>
    `;
    }).join('');
}

function updateStats() {
    const total = ordenantes.length;
    const totalRemesas = ordenantes.reduce((sum, o) => sum + (o.total_remesas || 0), 0);
    const pendiente = ordenantes.reduce((sum, o) => sum + (o.monto_pendiente || 0), 0);
    const confirmado = ordenantes.reduce((sum, o) => sum + (o.monto_confirmado || 0), 0);

    document.getElementById('totalOrdenantes').textContent = total;
    document.getElementById('totalRemesas').textContent = totalRemesas;
    document.getElementById('montoPendiente').textContent = formatCurrency(pendiente, 'CUP');
    document.getElementById('montoConfirmado').textContent = formatCurrency(confirmado, 'CUP');

    document.getElementById('remeseroStats').innerHTML = `
        <span>${total} ordenante${total !== 1 ? 's' : ''}</span> &bull;
        <span>${totalRemesas} remesa${totalRemesas !== 1 ? 's' : ''}</span> &bull;
        <span class="${pendiente > 0 ? 'text-yellow' : 'text-green'}">${formatCurrency(pendiente, 'CUP')} pendiente</span>
    `;
}

// ============================================
// MENÚ TRES PUNTOS
// ============================================
function toggleOrdenanteMenu(event, ordenanteId) {
    event.stopPropagation();

    document.querySelectorAll('.ordenante-dropdown').forEach(menu => {
        menu.classList.remove('active');
    });

    const menu = document.getElementById(`menu-${ordenanteId}`);
    if (menu) {
        menu.classList.toggle('active');
    }
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.ordenante-menu-container')) {
        document.querySelectorAll('.ordenante-dropdown').forEach(menu => {
            menu.classList.remove('active');
        });
    }
});

// ============================================
// MODAL: Nuevo Ordenante + Primer Depósito
// ============================================
function openAddOrdenanteModal() {
    document.getElementById('ordenanteModalTitle').textContent = 'Nuevo Ordenante';
    document.getElementById('ordenanteId').value = '';
    document.getElementById('ordenanteNombre').value = '';
    document.getElementById('depFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('depMoneda').value = 'USD';
    document.getElementById('depImporte').value = '';
    document.getElementById('depTasa').value = '120';
    document.getElementById('depReferencia').value = '';
    calculateImporteCUP();
    document.getElementById('ordenanteModal').classList.add('active');
}

function closeOrdenanteModal() {
    document.getElementById('ordenanteModal').classList.remove('active');
}

function calculateImporteCUP() {
    const importe = parseFloat(document.getElementById('depImporte').value) || 0;
    const tasa = parseFloat(document.getElementById('depTasa').value) || 1;
    document.getElementById('depImporteCUP').textContent = formatCurrency(importe * tasa, 'CUP');
}

async function saveOrdenante() {
    const nombre = document.getElementById('ordenanteNombre').value.trim();
    const fecha = document.getElementById('depFecha').value;
    const moneda = document.getElementById('depMoneda').value;
    const importe = document.getElementById('depImporte').value;
    const tasa = document.getElementById('depTasa').value;
    const referencia = document.getElementById('depReferencia').value.trim();

    if (!nombre) { showToast('error', 'Error', 'El nombre es requerido'); return; }
    if (!fecha || !moneda || !importe) { showToast('error', 'Error', 'Fecha, moneda e importe son requeridos'); return; }

    try {
        await ordenantesService.create({
            remesero_id: currentRemeseroId,
            nombre,
            fecha_deposito: fecha,
            moneda,
            importe: parseFloat(importe),
            tasa_cambio: parseFloat(tasa),
            referencia: referencia || null,
            cantidad_deposito: parseFloat(importe)
        });

        closeOrdenanteModal();
        showToast('success', 'Éxito', 'Ordenante creado exitosamente');
        loadOrdenantes();
    } catch (error) {
        console.error('Error creating ordenante:', error);
        showToast('error', 'Error', 'No se pudo crear el ordenante');
    }
}

// ============================================
// MODAL: Detalles del Depósito
// ============================================
async function showDetalles(ordenanteId) {
    closeAllMenus();
    try {
        const result = await ordenantesService.getDetalles(ordenanteId);
        const { ordenante, depositos, estadisticas } = result;

        let depositosHTML = '';
        if (depositos && depositos.length > 0) {
            depositosHTML = depositos.map(d => `
                <div class="detalle-deposito ${d.estado === 'confirmado' ? 'confirmado' : 'pendiente'}">
                    <div class="detalle-row">
                        <span class="detalle-label">Fecha:</span>
                        <span class="detalle-value">${escapeHtml(new Date(d.fecha_deposito).toLocaleDateString('es-ES'))}</span>
                    </div>
                    <div class="detalle-row">
                        <span class="detalle-label">Moneda:</span>
                        <span class="detalle-value">${escapeHtml(d.moneda)}</span>
                    </div>
                    <div class="detalle-row">
                        <span class="detalle-label">Importe:</span>
                        <span class="detalle-value">${formatCurrency(d.importe, d.moneda)}</span>
                    </div>
                    <div class="detalle-row">
                        <span class="detalle-label">Tasa Cambio:</span>
                        <span class="detalle-value">${escapeHtml(d.tasa_cambio)}</span>
                    </div>
                    <div class="detalle-row">
                        <span class="detalle-label">Importe CUP:</span>
                        <span class="detalle-value highlight">${formatCurrency(d.importe_cup, 'CUP')}</span>
                    </div>
                    ${d.referencia ? `
                    <div class="detalle-row">
                        <span class="detalle-label">Referencia:</span>
                        <span class="detalle-value">${escapeHtml(d.referencia)}</span>
                    </div>` : ''}
                    <div class="detalle-row">
                        <span class="detalle-label">Estado:</span>
                        <span class="detalle-value badge ${d.estado === 'confirmado' ? 'badge-green' : 'badge-yellow'}">
                            ${d.estado === 'confirmado' ? 'Confirmado' : 'Pendiente'}
                        </span>
                    </div>
                    ${d.confirmado_por_nombre ? `
                    <div class="detalle-row">
                        <span class="detalle-label">Confirmado por:</span>
                        <span class="detalle-value">${escapeHtml(d.confirmado_por_nombre)}</span>
                    </div>` : ''}
                </div>
            `).join('');
        } else {
            depositosHTML = '<div class="text-center text-muted p-md">No hay depósitos registrados</div>';
        }

        document.getElementById('detallesContent').innerHTML = `
            <div class="detalles-header">
                <div class="detalles-avatar">${escapeHtml(getInitials(ordenante.nombre))}</div>
                <h4>${escapeHtml(ordenante.nombre)}</h4>
                <p class="text-muted">${escapeHtml(ordenante.remesero_nombre)}</p>
            </div>
            <div class="detalles-stats">
                <div class="stat-mini">
                    <div class="stat-mini-label">Total Depósitos</div>
                    <div class="stat-mini-value">${estadisticas.total_depositos}</div>
                </div>
                <div class="stat-mini">
                    <div class="stat-mini-label">Pendiente</div>
                    <div class="stat-mini-value yellow">${formatCurrency(estadisticas.monto_pendiente, 'CUP')}</div>
                </div>
                <div class="stat-mini">
                    <div class="stat-mini-label">Confirmado</div>
                    <div class="stat-mini-value green">${formatCurrency(estadisticas.monto_confirmado, 'CUP')}</div>
                </div>
            </div>
            <div class="detalles-depositos">
                <h5>Depósitos</h5>
                ${depositosHTML}
            </div>
        `;

        document.getElementById('detallesModal').classList.add('active');
    } catch (error) {
        console.error('Error loading detalles:', error);
        showToast('error', 'Error', 'No se pudieron cargar los detalles');
    }
}

function closeDetallesModal() {
    document.getElementById('detallesModal').classList.remove('active');
}

// ============================================
// MODAL: Agregar Depósito
// ============================================
function openAddDepositoModal(ordenanteId) {
    closeAllMenus();
    document.getElementById('addDepOrdenanteId').value = ordenanteId;
    document.getElementById('addDepRemeseroId').value = currentRemeseroId;
    document.getElementById('addDepFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('addDepMoneda').value = 'USD';
    document.getElementById('addDepImporte').value = '';
    document.getElementById('addDepTasa').value = '120';
    document.getElementById('addDepReferencia').value = '';
    calculateAddDepCUP();
    document.getElementById('addDepositoModal').classList.add('active');
}

function closeAddDepositoModal() {
    document.getElementById('addDepositoModal').classList.remove('active');
}

function calculateAddDepCUP() {
    const importe = parseFloat(document.getElementById('addDepImporte').value) || 0;
    const tasa = parseFloat(document.getElementById('addDepTasa').value) || 1;
    document.getElementById('addDepImporteCUP').textContent = formatCurrency(importe * tasa, 'CUP');
}

async function saveAddDeposito() {
    const ordenanteId = document.getElementById('addDepOrdenanteId').value;
    const remeseroId = document.getElementById('addDepRemeseroId').value;
    const fecha = document.getElementById('addDepFecha').value;
    const moneda = document.getElementById('addDepMoneda').value;
    const importe = document.getElementById('addDepImporte').value;
    const tasa = document.getElementById('addDepTasa').value;
    const referencia = document.getElementById('addDepReferencia').value.trim();

    if (!fecha || !moneda || !importe) { showToast('error', 'Error', 'Fecha, moneda e importe son requeridos'); return; }

    try {
        await remesasService.create({
            ordenante_id: parseInt(ordenanteId),
            remesero_id: parseInt(remeseroId),
            fecha_deposito: fecha,
            moneda,
            importe: parseFloat(importe),
            tasa_cambio: parseFloat(tasa),
            referencia: referencia || null,
            cantidad_deposito: parseFloat(importe)
        });

        closeAddDepositoModal();
        showToast('success', 'Éxito', 'Depósito agregado exitosamente');
        loadOrdenantes();
    } catch (error) {
        console.error('Error adding deposito:', error);
        showToast('error', 'Error', 'No se pudo agregar el depósito');
    }
}

// ============================================
// MODAL: Renombrar Ordenante
// ============================================
function findOrdenante(id) {
    return ordenantes.find(o => o.id === id);
}

function openRenameModal(ordenanteId) {
    closeAllMenus();
    const ordenante = findOrdenante(ordenanteId);
    const nombre = ordenante ? ordenante.nombre : '';
    document.getElementById('renombrarId').value = ordenanteId;
    document.getElementById('renombrarNombreActual').textContent = nombre;
    document.getElementById('renombrarNuevoNombre').value = nombre;
    document.getElementById('renombrarModal').classList.add('active');
    setTimeout(() => document.getElementById('renombrarNuevoNombre').focus(), 100);
}

function closeRenombrarModal() {
    document.getElementById('renombrarModal').classList.remove('active');
}

async function saveRename() {
    const id = document.getElementById('renombrarId').value;
    const nombre = document.getElementById('renombrarNuevoNombre').value.trim();

    if (!nombre) { showToast('error', 'Error', 'El nombre es requerido'); return; }

    try {
        await ordenantesService.update(id, { nombre });
        closeRenombrarModal();
        showToast('success', 'Éxito', 'Ordenante renombrado exitosamente');
        loadOrdenantes();
    } catch (error) {
        console.error('Error renaming ordenante:', error);
        showToast('error', 'Error', 'No se pudo renombrar el ordenante');
    }
}

// ============================================
// ELIMINAR Ordenante
// ============================================
async function deleteOrdenante(ordenanteId) {
    closeAllMenus();

    const ordenante = findOrdenante(ordenanteId);
    const nombre = ordenante ? ordenante.nombre : '';
    const confirmed = await showConfirm(
        `¿Eliminar a "${nombre}"? Se desactivará este ordenante y no aparecerá en la lista.`
    );

    if (confirmed) {
        try {
            await ordenantesService.delete(ordenanteId);
            showToast('success', 'Éxito', 'Ordenante eliminado exitosamente');
            loadOrdenantes();
        } catch (error) {
            console.error('Error deleting ordenante:', error);
            showToast('error', 'Error', 'No se pudo eliminar el ordenante');
        }
    }
}

// ============================================
// UTILIDADES
// ============================================
function closeAllMenus() {
    document.querySelectorAll('.ordenante-dropdown').forEach(menu => {
        menu.classList.remove('active');
    });
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('mobile-open');
}

function toggleDropdown(button) {
    const dropdown = button.nextElementSibling;
    dropdown.classList.toggle('active');

    document.addEventListener('click', function closeDropdown(e) {
        if (!button.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
            document.removeEventListener('click', closeDropdown);
        }
    });
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

function changePassword() {
    showToast('info', 'Info', 'Función de cambio de contraseña en desarrollo');
}

window.toggleSidebar = toggleSidebar;
window.toggleDropdown = toggleDropdown;
window.openAddOrdenanteModal = openAddOrdenanteModal;
window.goToOrdenantes = goToOrdenantes;
window.closeOrdenanteModal = closeOrdenanteModal;
window.saveOrdenante = saveOrdenante;
window.showDetalles = showDetalles;
window.closeDetallesModal = closeDetallesModal;
window.openAddDepositoModal = openAddDepositoModal;
window.closeAddDepositoModal = closeAddDepositoModal;
window.saveAddDeposito = saveAddDeposito;
window.openRenameModal = openRenameModal;
window.closeRenombrarModal = closeRenombrarModal;
window.saveRename = saveRename;
window.deleteOrdenante = deleteOrdenante;
window.calculateImporteCUP = calculateImporteCUP;
window.calculateAddDepCUP = calculateAddDepCUP;
window.toggleOrdenanteMenu = toggleOrdenanteMenu;
window.logout = logout;
window.changePassword = changePassword;
