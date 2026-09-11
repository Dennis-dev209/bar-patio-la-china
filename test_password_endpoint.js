const https = require('https');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkBwYXRpb2xhY2hpbmEuY29tIiwicm9sIjoiYWRtaW4iLCJub21icmUiOiJBZG1pbmlzdHJhZG9yIiwiaWF0IjoxNzg5MTQ5NTkxLCJleHAiOjE3ODkyMzU5OTF9.gO8KIsi1-6iFuhAMOr_j9s1sry30uMRDanlmlC67bWM';

const req = (method, path, data) => new Promise((res, rej) => {
    const body = data ? JSON.stringify(data) : null;
    const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN };
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    https.request({ hostname: 'bar-patio-la-china.onrender.com', port: 443, path, method, headers }, (r) => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => res({ status: r.statusCode, body: d }));
    }).end(body);
});

(async () => {
    try {
        // 1. Obtener usuarios
        const users = await req('GET', '/api/auth/users', null);
        console.log('GET /users status:', users.status);
        const list = JSON.parse(users.body || '{"usuarios":[]}').usuarios || [];
        console.log('Usuarios:', list.length);
        const empleado = list.find(u => u.rol === 'empleado');
        console.log('Empleado:', empleado ? empleado.nombre + ' (id=' + empleado.id + ')' : 'No encontrado');

        if (empleado && empleado.id) {
            // 2. Cambiar contraseña
            const change = await req('PUT', '/api/auth/users/' + empleado.id + '/password', { newPassword: 'nueva1234' });
            console.log('PUT /users/' + empleado.id + '/password status:', change.status);
            console.log('Respuesta:', change.body.slice(0, 300));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
