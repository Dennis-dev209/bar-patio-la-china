// ============================================
// PRUEBA FUNCIONAL A - MULTI CUENTA (DEPLOY)
// Bar Patio La China - Entrega hoy
// ============================================

const https = require('https');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkBwYXRpb2xhY2hpbmEuY29tIiwicm9sIjoiYWRtaW4iLCJub21icmUiOiJBZG1pbmlzdHJhZG9yIiwiaWF0IjoxNzg5MTQ5NTkxLCJleHAiOjE3ODkyMzU5OTF9.gO8KIsi1-6iFuhAMOr_j9s1sry30uMRDanlmlC67bWM';

const req = (method, path, data) => new Promise((res, rej) => {
    const body = data ? JSON.stringify(data) : null;
    const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN };
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    const r = https.request({ hostname: 'bar-patio-la-china.onrender.com', port: 443, path, method, headers }, (response) => {
        let d = '';
        response.on('data', c => d += c);
        response.on('end', () => res({ status: response.statusCode, body: d }));
    });
    r.on('error', rej);
    if (body) r.write(body);
    r.end();
});

const log = (label, result) => {
    const b = result.body ? result.body.slice(0, 300) : '';
    console.log(`[${label}] status=${result.status} body=${b}`);
};

(async () => {
    console.log('=== PRUEBA FUNCIONAL A - MULTI CUENTA ===');
    console.log('Fecha:', new Date().toISOString());

    // 1. CREAR CLIENTES (2 remeseros)
    console.log('\n--- 1. CREANDO CLIENTES ---');
    const cliA = await req('POST', '/api/clientes', { nombre: 'ENTREGA-HOY-REM-A', telefono: '555-001', pais: 'Cuba' });
    log('Cliente A (USD)', cliA);
    const cliAId = cliA.status === 201 ? JSON.parse(cliA.body).cliente?.id || JSON.parse(cliA.body).id : null;

    const cliB = await req('POST', '/api/clientes', { nombre: 'ENTREGA-HOY-REM-B', telefono: '555-002', pais: 'Venezuela' });
    log('Cliente B (CUP)', cliB);
    const cliBId = cliB.status === 201 ? JSON.parse(cliB.body).cliente?.id || JSON.parse(cliB.body).id : null;

    // 2. CREAR ORDENANTES (USD + CUP)
    console.log('\n--- 2. CREANDO ORDENANTES ---');
    const ordUSD = await req('POST', '/api/ordenantes', { remesero_id: cliAId, nombre: 'ENTREGA-HOY-USD', fecha_deposito: '2026-09-11', moneda: 'USD', importe: 100, tasa_cambio: 150, referencia: 'REF-USD-001' });
    log('Ordenante USD (tasa 150)', ordUSD);
    const ordUSDId = ordUSD.status === 201 ? (JSON.parse(ordUSD.body).ordenante?.id || JSON.parse(ordUSD.body).id) : null;

    const ordCUP = await req('POST', '/api/ordenantes', { remesero_id: cliAId, nombre: 'ENTREGA-HOY-CUP', fecha_deposito: '2026-09-11', moneda: 'CUP', importe: 5000, tasa_cambio: 1, referencia: 'REF-CUP-001' });
    log('Ordenante CUP (tasa 1)', ordCUP);
    const ordCUPId = ordCUP.status === 201 ? (JSON.parse(ordCUP.body).ordenante?.id || JSON.parse(ordCUP.body).id) : null;

    // 3. CREAR DEPÓSITOS (REMESAS) DESDE ORDENANTES
    console.log('\n--- 3. CREANDO DEPÓSITOS (REMESAS) ---');
    const remUSD = await req('POST', '/api/remesas', { ordenante_id: ordUSDId, remesero_id: cliAId, moneda: 'USD', importe: 100, tasa_cambio: 150, fecha_deposito: '2026-09-11', referencia: 'REF-REM-USD' });
    log('Remesa USD 100x150', remUSD);

    const remCUP = await req('POST', '/api/remesas', { ordenante_id: ordCUPId, remesero_id: cliAId, moneda: 'CUP', importe: 5000, tasa_cambio: 1, fecha_deposito: '2026-09-11', referencia: 'REF-REM-CUP' });
    log('Remesa CUP 5000x1', remCUP);

    // 4. CONFIRMAR / DESCONFIRMAR
    console.log('\n--- 4. CONFIRMAR Y DESCONFIRMAR ---');
    const remUSDId = remUSD.status === 201 ? (JSON.parse(remUSD.body).remesa?.id || JSON.parse(remUSD.body).id) : null;
    if (remUSDId) {
        const conf = await req('PUT', `/api/remesas/${remUSDId}/confirmar`, null);
        log('Confirmar USD', conf);
        const unconf = await req('PUT', `/api/remesas/${remUSDId}/desconfirmar`, null);
        log('Desconfirmar USD', unconf);
    }

    // 5. VERIFICAR REPORTES (RESUMEN)
    console.log('\n--- 5. VERIFICANDO REPORTES ---');
    const resumen = await req('GET', '/api/reportes/resumen', null);
    log('Resumen general', resumen);

    const pendiente = await req('GET', '/api/reportes/pendientes', null);
    log('Pendientes', pendiente);

    // 6. VERIFICAR TARJETA (ORDENANTES CON MONTO EN CUP)
    console.log('\n--- 6. TARJETA ORDENANTES ---');
    const ordList = await req('GET', `/api/ordenantes/remesero/${cliAId}`, null);
    log('Ordenantes de Rem-A (monto en CUP esperado)', ordList);

    // 7. LIMPIEZA (eliminar datos de prueba)
    console.log('\n--- 7. LIMPIEZA DE DATOS DE PRUEBA ---');
    if (remUSDId) {
        const delRem = await req('DELETE', `/api/remesas/${remUSDId}`, null);
        log('Eliminar remesa USD', delRem);
    }
    const remCUPIdLocal = remCUP.status === 201 ? (JSON.parse(remCUP.body).remesa?.id || JSON.parse(remCUP.body).id) : null;
    if (remCUPIdLocal) {
        const delRemCUP = await req('DELETE', `/api/remesas/${remCUPIdLocal}`, null);
        log('Eliminar remesa CUP', delRemCUP);
    }
    if (ordUSDId) {
        const delOrdUSD = await req('DELETE', `/api/ordenantes/${ordUSDId}`, null);
        log('Eliminar ordenante USD', delOrdUSD);
    }
    if (ordCUPId) {
        const delOrdCUP = await req('DELETE', `/api/ordenantes/${ordCUPId}`, null);
        log('Eliminar ordenante CUP', delOrdCUP);
    }
    if (cliBId) {
        const delCliB = await req('DELETE', `/api/clientes/${cliBId}`, null);
        log('Eliminar cliente B', delCliB);
    }
    if (cliAId) {
        const delCliA = await req('DELETE', `/api/clientes/${cliAId}`, null);
        log('Eliminar cliente A', delCliA);
    }

    console.log('\n=== PRUEBA FUNCIONAL A COMPLETA ===');
})();
