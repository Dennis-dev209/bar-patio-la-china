/* ============================================
   MÓDULO DE RESUMEN/REPORTES
   Bar Patio La China
   ============================================ */

// ============================================
// VARIABLES GLOBALES
// ============================================

let reportData = {
    resumen: null,
    porPeriodo: [],
    porRemesero: []
};

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
// CARGAR DATOS DEL REPORTE
// ============================================

const loadReportData = async () => {
    try {
        // Mostrar loading
        document.getElementById('periodoTableBody').innerHTML = `
            <tr><td colspan="8" class="text-center text-muted">
                <i class="fas fa-spinner fa-spin"></i> Cargando datos...
            </td></tr>
        `;
        document.getElementById('remeseroTableBody').innerHTML = `
            <tr><td colspan="8" class="text-center text-muted">
                <i class="fas fa-spinner fa-spin"></i> Cargando datos...
            </td></tr>
        `;
        
        // Obtener parámetros de filtro
        const tipo = document.getElementById('reportTipo').value;
        const fechaInicio = document.getElementById('reportFechaInicio').value;
        const fechaFin = document.getElementById('reportFechaFin').value;
        
        // Mostrar/ocultar campos de fecha según el tipo
        if (tipo === 'personalizado') {
            document.getElementById('fechaInicioGroup').style.display = 'block';
            document.getElementById('fechaFinGroup').style.display = 'block';
        } else {
            document.getElementById('fechaInicioGroup').style.display = 'none';
            document.getElementById('fechaFinGroup').style.display = 'none';
        }
        
        // Cargar datos en paralelo
        const [resumen, porPeriodo, porRemesero] = await Promise.all([
            reportesService.getResumen(),
            reportesService.getPorPeriodo({ tipo, fecha_inicio: fechaInicio, fecha_fin: fechaFin }),
            reportesService.getPorRemesero({ fecha_inicio: fechaInicio, fecha_fin: fechaFin })
        ]);
        
        reportData = {
            resumen: resumen.resumen,
            porMoneda: resumen.por_moneda || [],
            porPeriodo: porPeriodo.reporte,
            porRemesero: porRemesero.reporte
        };

        // Actualizar UI
        updateStats(reportData.resumen, reportData.porMoneda);
        renderPeriodoTable(reportData.porPeriodo);
        renderRemeseroTable(reportData.porRemesero);
        
    } catch (error) {
        console.error('Error al cargar reportes:', error);
        showToast('error', 'Error', 'No se pudieron cargar los reportes');
    }
};

// ============================================
// ACTUALIZAR ESTADÍSTICAS
// ============================================

const updateStats = (stats, porMoneda = []) => {
    // Montos en moneda extranjera (desglose por moneda; respaldo en CUP)
    document.getElementById('totalRecibido').innerHTML = formatMontosPorMoneda(porMoneda, 'monto_total', stats.monto_total);
    document.getElementById('totalConfirmado').innerHTML = formatMontosPorMoneda(porMoneda, 'monto_confirmado', stats.monto_confirmado);
    document.getElementById('totalPendiente').innerHTML = formatMontosPorMoneda(porMoneda, 'monto_pendiente', stats.monto_pendiente);

    // % confirmado: con una sola moneda se calcula por dinero (como antes);
    // con varias, por cantidad de depósitos (sumar monedas distintas no tiene sentido)
    let porcentaje = 0;
    if (porMoneda.length > 1) {
        const totalN = (stats.remesas_pendientes || 0) + (stats.remesas_confirmadas || 0);
        porcentaje = totalN > 0 ? (((stats.remesas_confirmadas || 0) / totalN) * 100).toFixed(1) : 0;
    } else {
        const total = parseFloat(stats.monto_total) || 0;
        const confirmado = parseFloat(stats.monto_confirmado) || 0;
        porcentaje = total > 0 ? ((confirmado / total) * 100).toFixed(1) : 0;
    }
    document.getElementById('porcentajeConfirmado').textContent = `${porcentaje}%`;
};

// Formateo legible de período: semanal "2026-W36" → "01–07 sep 2026 (Sem. 36)"
const formatPeriodo = (periodo) => {
    const m = String(periodo || '').match(/^(\d{4})-W(\d{2})$/);
    if (!m) return escapeHtml(periodo);
    const year = parseInt(m[1], 10), week = parseInt(m[2], 10);
    // Coincide con SQLite %W (lunes primer día, semana 00 = días antes del primer lunes)
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const jan1Day = jan1.getUTCDay() || 7; // 1=lun
    const firstMon = new Date(jan1); firstMon.setUTCDate(1 + (jan1Day === 1 ? 0 : 8 - jan1Day));
    const mon = new Date(firstMon); mon.setUTCDate(firstMon.getUTCDate() + (week - 1) * 7);
    if (week === 0) { mon.setUTCDate(firstMon.getUTCDate() - 7); }
    const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
    const fmt = (d) => d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
    const monStr = fmt(mon), sunStr = fmt(sun);
    const rango = mon.getUTCMonth() === sun.getUTCMonth()
        ? `${String(mon.getUTCDate()).padStart(2,'0')}–${String(sun.getUTCDate()).padStart(2,'0')} ${sun.toLocaleDateString('es-ES',{month:'short',year:'numeric'}).replace('.','')}`
        : `${monStr} – ${sunStr}`;
    return `${rango} <small class="text-muted">(Sem. ${week})</small>`;
};

const formatPeriodoExcel = (periodo) => {
    const m = String(periodo || '').match(/^(\d{4})-W(\d{2})$/);
    if (!m) return periodo;
    const year = parseInt(m[1], 10), week = parseInt(m[2], 10);
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const jan1Day = jan1.getUTCDay() || 7;
    const firstMon = new Date(jan1); firstMon.setUTCDate(1 + (jan1Day === 1 ? 0 : 8 - jan1Day));
    const mon = new Date(firstMon); mon.setUTCDate(firstMon.getUTCDate() + (week - 1) * 7);
    if (week === 0) { mon.setUTCDate(firstMon.getUTCDate() - 7); }
    const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
    const fmt = (d) => `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
    return `${fmt(mon)} – ${fmt(sun)} (Sem. ${week})`;
};

// ============================================
// RENDERIZAR TABLA POR PERÍODO
// ============================================

const renderPeriodoTable = (data) => {
    const tbody = document.getElementById('periodoTableBody');
    
    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted">
                    No hay datos para mostrar
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = data.map(row => `
        <tr>
            <td><strong>${formatPeriodo(row.periodo)}</strong></td>
            <td>EUR</td>
            <td>${row.total_remesas}</td>
            <td>${row.confirmadas}</td>
            <td>${row.pendientes}</td>
            <td><strong>${formatCurrency(row.monto_total, 'EUR')}</strong></td>
            <td class="text-success">${formatCurrency(row.monto_confirmado, 'EUR')}</td>
            <td class="text-warning">${formatCurrency(row.monto_pendiente, 'EUR')}</td>
        </tr>
    `).join('');
};

// ============================================
// RENDERIZAR TABLA POR REMESERO
// ============================================

const renderRemeseroTable = (data) => {
    const tbody = document.getElementById('remeseroTableBody');
    
    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted">
                    No hay datos para mostrar
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = data.map(row => `
        <tr>
            <td><strong>${escapeHtml(row.nombre)}</strong></td>
            <td>EUR</td>
            <td>${row.total_remesas}</td>
            <td>${row.confirmadas}</td>
            <td>${row.pendientes}</td>
            <td><strong>${formatCurrency(row.monto_total, 'EUR')}</strong></td>
            <td class="text-success">${formatCurrency(row.monto_confirmado, 'EUR')}</td>
            <td class="text-warning">${formatCurrency(row.monto_pendiente, 'EUR')}</td>
        </tr>
    `).join('');
};

// ============================================
// EXPORTAR A EXCEL
// ============================================

const exportToExcel = () => {
    try {
        const wb = XLSX.utils.book_new();
        const tipo = document.getElementById('reportTipo')?.value || 'mensual';
        const fIni = document.getElementById('reportFechaInicio')?.value || '';
        const fFin = document.getElementById('reportFechaFin')?.value || '';
        const filtroInfo = `Filtros: tipo=${tipo}${fIni ? ` desde=${fIni}` : ''}${fFin ? ` hasta=${fFin}` : ''}`;
        
        // Hoja de resumen EUR (sin CUP)
        const resumenData = [
            ['RESUMEN DE REMESAS'],
            ['Bar Patio La China'],
            [filtroInfo],
            [''],
            ['Concepto', 'Moneda', 'Monto EUR'],
            ...(reportData.porMoneda.length > 0
                ? reportData.porMoneda.filter(m => m.moneda === 'EUR').flatMap(m => [
                    [`Total Recibido`, 'EUR', m.monto_total],
                    [`Confirmado`, 'EUR', m.monto_confirmado],
                    [`Pendiente`, 'EUR', m.monto_pendiente]
                ])
                : [['Total Recibido', 'EUR', reportData.resumen.monto_total],
                   ['Confirmado', 'EUR', reportData.resumen.monto_confirmado],
                   ['Pendiente', 'EUR', reportData.resumen.monto_pendiente]]),
            ['Total Remesas', '', reportData.resumen.total_remesas],
            ['Remesas Confirmadas', '', reportData.resumen.remesas_confirmadas],
            ['Remesas Pendientes', '', reportData.resumen.remesas_pendientes]
        ];
        const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
        
        // Hoja por período EUR
        {
            const periodoHeaders = ['Período', 'Moneda', 'Total Remesas', 'Confirmadas', 'Pendientes', 'Monto Total EUR', 'Monto Confirmado EUR', 'Monto Pendiente EUR'];
            const rows = reportData.porPeriodo.length > 0
                ? reportData.porPeriodo.map(row => [
                    formatPeriodoExcel(row.periodo), 'EUR', row.total_remesas, row.confirmadas, row.pendientes,
                    row.monto_total, row.monto_confirmado, row.monto_pendiente
                  ])
                : [['Sin datos para los filtros actuales', 'EUR', 0, 0, 0, 0, 0, 0]];
            const periodoData = [periodoHeaders, ...rows];
            const wsPeriodo = XLSX.utils.aoa_to_sheet(periodoData);
            XLSX.utils.book_append_sheet(wb, wsPeriodo, 'Por Período');
        }
        
        // Hoja por cliente EUR
        {
            const remeseroHeaders = ['Cliente', 'Moneda', 'Total Remesas', 'Confirmadas', 'Pendientes', 'Monto Total EUR', 'Monto Confirmado EUR', 'Monto Pendiente EUR'];
            const rows = reportData.porRemesero.length > 0
                ? reportData.porRemesero.map(row => [
                    row.nombre, 'EUR', row.total_remesas, row.confirmadas, row.pendientes,
                    row.monto_total, row.monto_confirmado, row.monto_pendiente
                  ])
                : [['Sin datos para los filtros actuales', 'EUR', 0, 0, 0, 0, 0, 0]];
            const remeseroData = [remeseroHeaders, ...rows];
            const wsRemesero = XLSX.utils.aoa_to_sheet(remeseroData);
            XLSX.utils.book_append_sheet(wb, wsRemesero, 'Por Cliente');
        }
        
        // Descargar archivo
        const fecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Reporte_Remesas_${fecha}.xlsx`);
        
        showToast('success', 'Éxito', 'Reporte exportado a Excel');
    } catch (error) {
        console.error('Error al exportar:', error);
        showToast('error', 'Error', 'No se pudo exportar el reporte');
    }
};

// ============================================
// EXPORTAR A PDF
// ============================================

const exportToPDF = () => {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Título
        doc.setFontSize(20);
        doc.text('Reporte de Remesas', 105, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text('Bar Patio La China', 105, 28, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 105, 35, { align: 'center' });
        const tipo = document.getElementById('reportTipo')?.value || 'mensual';
        const fIni = document.getElementById('reportFechaInicio')?.value || '';
        const fFin = document.getElementById('reportFechaFin')?.value || '';
        doc.setFontSize(8);
        doc.text(`Filtros: tipo=${tipo}${fIni ? ` desde=${fIni}` : ''}${fFin ? ` hasta=${fFin}` : ''}`, 105, 40, { align: 'center' });
        
        // Resumen
        let y = 50;
        doc.setFontSize(14);
        doc.text('Resumen General', 20, y);
        y += 10;
        
        doc.setFontSize(10);
        const eur = (reportData.porMoneda || []).find(m => m.moneda === 'EUR') || reportData.porMoneda[0];
        const lineasResumen = eur
            ? [`Total Recibido (EUR): ${formatCurrency(eur.monto_total || 0, 'EUR')}`,
               `Confirmado (EUR): ${formatCurrency(eur.monto_confirmado || 0, 'EUR')}`,
               `Pendiente (EUR): ${formatCurrency(eur.monto_pendiente || 0, 'EUR')}`]
            : [`Total Recibido: ${formatCurrency(reportData.resumen.monto_total || 0, 'EUR')}`,
               `Confirmado: ${formatCurrency(reportData.resumen.monto_confirmado || 0, 'EUR')}`,
               `Pendiente: ${formatCurrency(reportData.resumen.monto_pendiente || 0, 'EUR')}`];
        lineasResumen.forEach(linea => { doc.text(linea, 20, y); y += 7; });
        doc.text(`Total Remesas: ${reportData.resumen.total_remesas || 0}`, 20, y);
        y += 7;
        doc.text(`Confirmadas: ${reportData.resumen.remesas_confirmadas || 0}`, 20, y);
        y += 7;
        doc.text(`Pendientes: ${reportData.resumen.remesas_pendientes || 0}`, 20, y);
        y += 15;
        
        // Movimientos por Período
        {
            if (y > 240) { doc.addPage(); y = 20; }
            doc.setFontSize(14);
            doc.text('Movimientos por Período', 20, y);
            y += 10;
            doc.setFontSize(8);
            doc.text('Período', 20, y); doc.text('Moneda', 50, y); doc.text('Remesas', 70, y);
            doc.text('Conf.', 88, y); doc.text('Pend.', 104, y); doc.text('Monto Total', 122, y);
            doc.text('Confirmado', 150, y); doc.text('Pendiente', 178, y);
            y += 6;
            const filasPer = reportData.porPeriodo.length > 0 ? reportData.porPeriodo : [{ periodo: 'Sin datos', total_remesas: 0, confirmadas: 0, pendientes: 0, monto_total: 0, monto_confirmado: 0, monto_pendiente: 0 }];
            filasPer.forEach(row => {
                if (y > 270) { doc.addPage(); y = 20; }
                const periodo = doc.splitTextToSize(formatPeriodoExcel(row.periodo) || '', 42)[0];
                doc.text(periodo, 20, y);
                doc.text('EUR', 50, y);
                doc.text(String(row.total_remesas || 0), 70, y);
                doc.text(String(row.confirmadas || 0), 88, y);
                doc.text(String(row.pendientes || 0), 104, y);
                doc.text(formatCurrency(row.monto_total || 0, 'EUR'), 122, y);
                doc.text(formatCurrency(row.monto_confirmado || 0, 'EUR'), 150, y);
                doc.text(formatCurrency(row.monto_pendiente || 0, 'EUR'), 178, y);
                y += 6;
            });
            y += 8;
        }

        // Por Cliente
        if (reportData.porRemesero.length > 0 || reportData.porPeriodo.length > 0) {
            if (y > 240) { doc.addPage(); y = 20; }
            doc.setFontSize(14);
            doc.text('Movimientos por Cliente', 20, y);
            y += 10;
            
            doc.setFontSize(9);
            // Encabezados
            doc.text('Cliente', 20, y);
            doc.text('Remesas', 80, y);
            doc.text('Confirmadas', 105, y);
            doc.text('Pendientes', 135, y);
            doc.text('Monto Total', 165, y);
            y += 7;
            
            // Datos
            const filasCli = reportData.porRemesero.length > 0 ? reportData.porRemesero : [{ nombre: 'Sin datos para los filtros actuales', total_remesas: 0, confirmadas: 0, pendientes: 0, monto_total: 0 }];
            filasCli.forEach(row => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
                const nombre = doc.splitTextToSize(row.nombre || '', 50)[0];
                doc.text(nombre, 20, y);
                doc.text(String(row.total_remesas || 0), 75, y);
                doc.text(String(row.confirmadas || 0), 95, y);
                doc.text(String(row.pendientes || 0), 120, y);
                doc.text(`EUR ${formatCurrency(row.monto_total || 0, 'EUR')}`, 145, y);
                y += 7;
            });
        }
        
        // Pie de página
        doc.setFontSize(8);
        doc.text('Generado por Sistema de Conciliación - Bar Patio La China', 105, 290, { align: 'center' });
        
        // Descargar
        const fecha = new Date().toISOString().split('T')[0];
        doc.save(`Reporte_Remesas_${fecha}.pdf`);
        
        showToast('success', 'Éxito', 'Reporte exportado a PDF');
    } catch (error) {
        console.error('Error al exportar PDF:', error);
        showToast('error', 'Error', 'No se pudo exportar el reporte');
    }
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
        loadReportData();
    }
});

// Exportar funciones
window.toggleSidebar = toggleSidebar;
window.toggleDropdown = toggleDropdown;
window.loadReportData = loadReportData;
window.exportToExcel = exportToExcel;
window.exportToPDF = exportToPDF;
window.logout = logout;
window.changePassword = changePassword;
