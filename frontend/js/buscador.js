/* ============================================
   BUSCADOR GLOBAL (clientes y ordenantes por nombre)
   Bar Patio La China
   Se auto-inicia en cada página que tenga #globalSearch.
   Atajo "/" enfoca la caja. Enter salta al primer resultado.
   ============================================ */

let buscadorTimer = null;
let buscadorSeq = 0;

const initBuscador = (inputId = 'globalSearch', resultsId = 'globalSearchResults') => {
    const input = document.getElementById(inputId);
    const box = document.getElementById(resultsId);
    if (!input || !box) return;

    input.addEventListener('input', () => {
        clearTimeout(buscadorTimer);
        const q = input.value.trim();
        if (q.length < 2) {
            box.classList.remove('active');
            box.innerHTML = '';
            return;
        }
        buscadorTimer = setTimeout(() => {
            if (input.value.trim() !== q) return;
            runBuscador(q, box);
        }, 300);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const first = box.querySelector('[data-url]');
            if (first) window.location.href = first.dataset.url;
        }
        if (e.key === 'Escape') {
            box.classList.remove('active');
            input.blur();
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target !== input && !e.target.closest('#' + resultsId)) {
            box.classList.remove('active');
        }
    });
};

const runBuscador = async (q, box) => {
    const seq = ++buscadorSeq;
    try {
        const data = await api.get(`/reportes/buscar?q=${encodeURIComponent(q)}`);
        if (seq !== buscadorSeq) return;
        renderBuscador(data.clientes || [], data.ordenantes || [], box);
    } catch (error) {
        if (seq !== buscadorSeq) return;
        console.error('Error en buscador global:', error);
    }
};

const renderBuscador = (clientes, ordenantes, box) => {
    if (clientes.length === 0 && ordenantes.length === 0) {
        box.innerHTML = '<div class="dropdown-item text-muted">Sin resultados</div>';
        box.classList.add('active');
        return;
    }

    let html = '';
    if (clientes.length > 0) {
        html += '<div class="global-search-group">Clientes</div>';
        html += clientes.map(c => `
            <a class="dropdown-item" href="/clientes?detalle=${c.id}" data-url="/clientes?detalle=${c.id}">
                <i class="fas fa-users"></i>
                <span>${escapeHtml(c.nombre)}</span>
            </a>
        `).join('');
    }
    if (ordenantes.length > 0) {
        html += '<div class="global-search-group">Ordenantes</div>';
        html += ordenantes.map(o => `
            <a class="dropdown-item" href="/ordenantes/${o.remesero_id}?ordenante=${o.id}" data-url="/ordenantes/${o.remesero_id}?ordenante=${o.id}">
                <i class="fas fa-user"></i>
                <span>${escapeHtml(o.nombre)} <small class="text-muted">· ${escapeHtml(o.remesero_nombre)}</small></span>
            </a>
        `).join('');
    }
    box.innerHTML = html;
    box.classList.add('active');
};

document.addEventListener('DOMContentLoaded', () => {
    initBuscador();
});

document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement && document.activeElement.tagName) || '')) {
        const input = document.getElementById('globalSearch');
        if (input) {
            e.preventDefault();
            input.focus();
        }
    }
});

window.initBuscador = initBuscador;
