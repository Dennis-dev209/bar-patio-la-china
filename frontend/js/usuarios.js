/* ============================================
   MÓDULO DE USUARIOS
   Bar Patio La China
   ============================================ */

let usuarios = [];

// ============================================
// VERIFICAR AUTENTICACIÓN
// ============================================

const checkAuth = () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return false;
    }
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.rol !== 'admin') {
        window.location.href = '/inicio';
        return false;
    }
    
    return true;
};

// ============================================
// CARGAR USUARIOS
// ============================================

const loadUsuarios = async () => {
    try {
        const data = await api.get('/auth/users');
        usuarios = data.usuarios;
        renderUsuarios(usuarios);
        updateStats();
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        showToast('error', 'Error', 'No se pudieron cargar los usuarios');
    }
};

// ============================================
// ACTUALIZAR ESTADÍSTICAS
// ============================================

const updateStats = () => {
    document.getElementById('totalUsuarios').textContent = usuarios.length;
    document.getElementById('totalAdmins').textContent = usuarios.filter(u => u.rol === 'admin').length;
    document.getElementById('totalEmpleados').textContent = usuarios.filter(u => u.rol === 'empleado').length;
};

// ============================================
// RENDERIZAR LISTA DE USUARIOS
// ============================================

const renderUsuarios = (usuariosList) => {
    const container = document.getElementById('usuariosTable');
    
    if (!usuariosList || usuariosList.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted">
                    No hay usuarios registrados
                </td>
            </tr>
        `;
        return;
    }
    
    container.innerHTML = usuariosList.map(usuario => `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-avatar">${escapeHtml(getInitials(usuario.nombre))}</div>
                    <span>${escapeHtml(usuario.nombre)}</span>
                </div>
            </td>
            <td>${escapeHtml(usuario.email)}</td>
            <td>
                <span class="role-badge ${usuario.rol}">
                    ${usuario.rol === 'admin' ? 'Administrador' : 'Empleado'}
                </span>
            </td>
            <td>
                <span class="status-badge ${usuario.activo ? 'active' : 'inactive'}">
                    ${usuario.activo ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>${formatDate(usuario.created_at)}</td>
            <td>
                <div class="actions-cell">
                    ${!usuario.activo ? `
                        <button class="btn btn-sm btn-outline" onclick="activateUser(${usuario.id})" title="Restaurar acceso">
                            <i class="fas fa-undo"></i>
                        </button>
                    ` : `
                        ${usuario.rol === 'empleado' ? `
                            <button class="btn btn-sm btn-ghost" onclick="openChangeEmployeePasswordModal(${usuario.id})" title="Cambiar contraseña del empleado">
                                <i class="fas fa-key"></i>
                            </button>
                        ` : ''}
                        ${usuario.rol !== 'admin' ? `
                            <button class="btn btn-sm btn-outline" onclick="changeRole(${usuario.id}, 'empleado')" title="Empleado">
                                <i class="fas fa-user"></i>
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="changeRole(${usuario.id}, 'admin')" title="Hacer Admin">
                                <i class="fas fa-user-shield"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-danger" onclick="deleteUser(${usuario.id})" title="Desactivar">
                            <i class="fas fa-trash"></i>
                        </button>
                    `}
                </div>
            </td>
        </tr>
    `).join('');
};

// ============================================
// CREAR USUARIO
// ============================================

const openCreateModal = () => {
    document.getElementById('createModal').classList.add('active');
    document.getElementById('createForm').reset();
};

const closeCreateModal = () => {
    document.getElementById('createModal').classList.remove('active');
};

const createUser = async (e) => {
    e.preventDefault();
    
    const nombre = document.getElementById('createNombre').value;
    const email = document.getElementById('createEmail').value;
    const password = document.getElementById('createPassword').value;
    const rol = document.getElementById('createRol').value;
    
    try {
        await api.post('/auth/register', { nombre, email, password, rol });
        showToast('success', 'Éxito', 'Usuario creado correctamente');
        closeCreateModal();
        loadUsuarios();
    } catch (error) {
        showToast('error', 'Error', error.message || 'No se pudo crear el usuario');
    }
};

// ============================================
// CAMBIAR ROL
// ============================================

const changeRole = async (userId, newRole) => {
    const confirmMsg = newRole === 'admin' 
        ? '¿Convertir a este usuario en administrador?'
        : '¿Convertir a este usuario en empleado?';
    
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;
    
    try {
        await api.put(`/auth/users/${userId}/role`, { rol: newRole });
        showToast('success', 'Éxito', 'Rol actualizado correctamente');
        loadUsuarios();
    } catch (error) {
        showToast('error', 'Error', error.message || 'No se pudo cambiar el rol');
    }
};

// ============================================
// ELIMINAR USUARIO
// ============================================

const deleteUser = async (userId) => {
    const found = usuarios.find(u => u.id === userId);
    const userName = found ? found.nombre : '';
    const confirmed = await showConfirm(`¿Desactivar al usuario "${userName}"? No podrá entrar, pero su historial se conserva.`);
    if (!confirmed) return;

    try {
        await api.delete(`/auth/users/${userId}`);
        showToast('success', 'Éxito', 'Usuario desactivado correctamente');
        loadUsuarios();
    } catch (error) {
        showToast('error', 'Error', error.message || 'No se pudo eliminar el usuario');
    }
};

// ============================================
// REACTIVAR USUARIO
// ============================================

const activateUser = async (userId) => {
    try {
        await api.put(`/auth/users/${userId}/activar`, {});
        showToast('success', 'Éxito', 'Usuario reactivado correctamente');
        loadUsuarios();
    } catch (error) {
        showToast('error', 'Error', error.message || 'No se pudo reactivar el usuario');
    }
};

// ============================================
// UTILIDADES
// ============================================

const toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
};

const toggleDropdown = (button) => {
    const dropdown = button.nextElementSibling;
    dropdown.classList.toggle('active');
    
    document.addEventListener('click', function closeDropdown(e) {
        if (!button.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
        document.removeEventListener('click', closeDropdown);
    });
};

const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
};

const changePassword = () => {
    const newPassword = prompt('Ingresa tu nueva contraseña:');
    if (newPassword && newPassword.length >= 6) {
        api.put('/auth/change-password', {
            currentPassword: prompt('Confirma tu contraseña actual:'),
            newPassword
        }).then(() => {
            showToast('success', 'Éxito', 'Contraseña actualizada');
        }).catch(err => {
            showToast('error', 'Error', err.message || 'No se pudo cambiar la contraseña');
        });
    }
};

// ============================================
// CAMBIAR CONTRASEÑA DE EMPLEADO (ADMIN)
// ============================================

const openChangeEmployeePasswordModal = (userId) => {
    document.getElementById('changeEmployeePasswordUserId').value = userId;
    document.getElementById('changeEmployeePasswordInput').value = '';
    document.getElementById('changeEmployeePasswordModal').classList.add('active');
};

const closeChangeEmployeePasswordModal = () => {
    document.getElementById('changeEmployeePasswordModal').classList.remove('active');
    document.getElementById('changeEmployeePasswordForm').reset();
};

const saveEmployeePassword = async (e) => {
    e.preventDefault();
    const userId = document.getElementById('changeEmployeePasswordUserId').value;
    const newPassword = document.getElementById('changeEmployeePasswordInput').value;

    if (!newPassword || newPassword.length < 8) {
        showToast('warning', 'Atención', 'La contraseña debe tener al menos 8 caracteres');
        return;
    }

    try {
        await api.put(`/auth/users/${userId}/password`, { newPassword });
        showToast('success', 'Éxito', 'Contraseña del empleado actualizada');
        closeChangeEmployeePasswordModal();
        loadUsuarios();
    } catch (error) {
        showToast('error', 'Error', error.message || 'No se pudo cambiar la contraseña');
    }
};

// ============================================
// INICIALIZAR
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    if (checkAuth()) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        document.getElementById('userName').innerHTML = `
            <i class="fas fa-user"></i>
            <span>${escapeHtml(user.nombre) || 'Usuario'}</span>
        `;
        loadUsuarios();
    }
});

// Exportar funciones
window.changeEmployeePassword = openChangeEmployeePasswordModal;
window.closeChangeEmployeePasswordModal = closeChangeEmployeePasswordModal;
window.saveEmployeePassword = saveEmployeePassword;
window.toggleSidebar = toggleSidebar;
window.toggleDropdown = toggleDropdown;
window.logout = logout;
window.changePassword = changePassword;
window.openCreateModal = openCreateModal;
window.closeCreateModal = closeCreateModal;
window.createUser = createUser;
window.changeRole = changeRole;
window.deleteUser = deleteUser;
window.activateUser = activateUser;
