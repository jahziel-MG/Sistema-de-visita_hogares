'use strict';

// One shared application keeps the original routes and CRUD workflow consistent.

const $ = (s, root = document) => root.querySelector(s);

const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[c]));

const names = {
    estudiantes: 'Estudiantes',
    profesores: 'Profesores',
    apoderados: 'Apoderados',
    visitas: 'Visitas a hogares'
};

const singular = {
    estudiantes: 'estudiante',
    profesores: 'profesor',
    apoderados: 'apoderado',
    visitas: 'visita'
};

const paths = {
    home: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',

    students: '<path d="m2 8 10-5 10 5-10 5Z"/><path d="M6 10v7q6 5 12 0v-7M22 8v8"/>',

    teachers: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 3h5v13h-4M17 7h2"/>',

    family: '<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 4 5v2"/>',

    visit: '<path d="m3 11 9-8 9 8M5 9v12h14V9M9 21v-7h6v7"/>',

    plus: '<path d="M12 5v14M5 12h14"/>',

    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',

    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M7 15h3"/>',

    logout: '<path d="M9 4H4v16h5M9 12h12m-4-4 4 4-4 4"/>',

    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',

    file: '<path d="M14 2H5v20h14V7ZM14 2v6h5M8 12h8M8 16h8"/>',

    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>'
};

const icon = n => `
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
    >
        ${paths[n] || paths.file}
    </svg>
`;

let csrf = '';
let user = null;
let schema = {};
let dirty = false;
let visitDraft = null;
let currentStep = 0;
let routeSerial = 0;

let toastTimer;

function toast(message, error = false) {
    clearTimeout(toastTimer);

    $('#toast').textContent = message;
    $('#toast').className = error ? 'error' : '';

    toastTimer = setTimeout(() => {
        $('#toast').textContent = '';
    }, 6000);
}

async function api(resource, {
    method = 'GET',
    data,
    params = {}
} = {}) {

    const url = new URL(
        '../backend/api.php',
        new URL('index.html', location.href)
    );

    url.searchParams.set('resource', resource);

    for (const [k, v] of Object.entries(params)) {
        if (v !== '' && v != null) {
            url.searchParams.set(k, v);
        }
    }

    const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: method === 'GET'
            ? {}
            : {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrf
            },
        body: method === 'GET'
            ? undefined
            : JSON.stringify(data ?? {})
    });

    let body;

    try {
        body = await response.json();
    } catch {
        throw new Error(
            'No se pudo leer la respuesta. Abre el proyecto mediante Apache en XAMPP y verifica PHP.'
        );
    }

    if (!response.ok) {
        const e = new Error(
            body.error || 'No se pudo completar la operación.'
        );

        e.fields = body.fields || {};
        e.status = response.status;

        throw e;
    }

    return body.data;
}

async function all(resource, params = {}) {
    let result = [];
    let page = 1;
    let r;

    do {
        r = await api(resource, {
            params: {
                ...params,
                page,
                limit: 200
            }
        });

        result.push(...r.items);
        page++;
    } while (result.length < r.total);

    return result;
}

function fmtDate(d) {
    return d
        ? String(d).split('-').reverse().join('/')
        : '—';
}

function fullName(r) {
    return [r.apellidos, r.nombres]
        .filter(Boolean)
        .join(', ');
}

function badge(s) {
    return `
        <span class="badge ${esc(String(s).toLowerCase())}">
            ${esc(s)}
        </span>
    `;
}

function heading(title, description = '', action = '') {
    return `
        <div class="page-heading">
            <div>
                <span class="eyebrow">Acompañamiento escolar</span>
                <h1 tabindex="-1">${title}</h1>

                ${description
                    ? `<p>${description}</p>`
                    : ''
                }
            </div>

            ${action}
        </div>
    `;
}

function newVisitButton() {
    return `
        <a class="button primary" href="#registrar-visita">
            ${icon('plus')}
            Registrar visita
        </a>
    `;
}

function empty(title, body, action = '') {
    return `
        <div class="empty">
            ${icon('file')}
            <h3>${esc(title)}</h3>
            <p>${esc(body)}</p>
            ${action}
        </div>
    `;
}

function errorBox(e) {
    return `
        <div class="error-banner" role="alert">
            ${esc(e.message)}
        </div>
    `;
}

function field(table, name, value, prefix = '') {

    const f = schema[table].fields[name];
    const id = prefix + name;

    const v = value === undefined
        ? (f.default ?? '')
        : (value ?? '');

    let attrs = `
        id="${esc(id)}"
        name="${esc(name)}"
        ${f.required ? 'required' : ''}
        aria-describedby="${esc(id)}-error"
    `;

    if (f.max && f.type !== 'number') {
        attrs += ` maxlength="${f.max}"`;
    }

    if (f.pattern) {
        attrs += `
            pattern="${f.pattern}"
            inputmode="numeric"
            title="Ingresa 8 dígitos"
        `;
    }

    let control;

    if (f.type === 'boolean' || f.type === 'select') {

        const opts = f.type === 'boolean'
            ? [[1, 'Sí'], [0, 'No']]
            : f.options.map(o => [
                o,
                o
                    .replaceAll('_', ' ')
                    .toLowerCase()
                    .replace(/^./, c => c.toUpperCase())
            ]);

        control = `
            <select ${attrs}>
                <option value="">Sin especificar</option>

                ${opts.map(([val, label]) => `
                    <option
                        value="${esc(val)}"
                        ${String(v) === String(val) ? 'selected' : ''}
                    >
                        ${esc(label)}
                    </option>
                `).join('')}
            </select>
        `;

    } else if (f.type === 'textarea') {

        control = `
            <textarea ${attrs}>${esc(v)}</textarea>
        `;

    } else {

        if (f.type === 'number') {
            attrs += `
                min="${f.min}"
                max="${f.max}"
                step="${f.step}"
            `;
        }

        if (f.type === 'date') {
            attrs += ' min="1900-01-01"';
        }

        control = `
            <input
                type="${f.type}"
                ${attrs}
                value="${esc(v)}"
                ${name === 'total_ingresos' ? 'readonly' : ''}
            >
        `;
    }

    return `
        <label
            class="field ${f.type === 'textarea' ? 'wide' : ''}"
            for="${esc(id)}"
        >
            <span>
                ${esc(f.label)}
                ${f.required
                    ? '<span aria-label="obligatorio">*</span>'
                    : ''
                }
            </span>

            ${control}

            <span
                id="${esc(id)}-error"
                class="field-error"
            ></span>
        </label>
    `;
}

function fields(table, data = {}, exclude = [], prefix = '') {
    return Object.keys(schema[table].fields)
        .filter(n => !exclude.includes(n))
        .map(n => field(table, n, data[n], prefix))
        .join('');
}

function collect(root) {
    return Object.fromEntries(
        $$('input[name],select[name],textarea[name]', root)
            .map(el => [el.name, el.value])
    );
}

function showErrors(root, e) {

    $$('[aria-invalid]', root)
        .forEach(el => el.removeAttribute('aria-invalid'));

    $$('.field-error', root)
        .forEach(el => el.textContent = '');

    for (const [name, msg] of Object.entries(e.fields || {})) {

        const el = $(`[name="${name}"]`, root);

        if (el) {

            el.setAttribute('aria-invalid', 'true');

            const hint = document.getElementById(
                el.id + '-error'
            );

            if (hint) {
                hint.textContent = msg;
            }
        }
    }

    $('[aria-invalid=true]', root)?.focus();

    toast(e.message, true);
}


/* =========================================
   MARCA DEL COLEGIO
   ========================================= */

function brand() {
    return `
        <div
            class="brand"
            aria-label="Visitas a Hogares · IEP Johannes Gutenberg"
        >
            <img
                class="brand-logo"
                src="assets/logo-colegio.png"
                alt="Escudo de la IEP Johannes Gutenberg"
                width="48"
                height="48"
            >

            <div class="brand-text">
                <strong>Visitas a Hogares</strong>
                <small>IEP Johannes Gutenberg</small>
            </div>
        </div>
    `;
}


function shell() {

    const route =
        location.hash.slice(1).split('?')[0] || 'inicio';

    const activeRoute =
        route === 'detalle'
            ? 'visitas'
            : route;

    const pageTitle =
        route === 'inicio'
            ? 'Inicio'
            : route === 'registrar-visita'
                ? 'Registrar visita'
                : route === 'detalle'
                    ? 'Ficha de visita'
                    : names[route] || 'Intranet';

    document.title =
        `${pageTitle} · Visitas a Hogares`;

    $('#app').innerHTML = `
        <aside class="sidebar">

            ${brand()}

            <div class="nav-label">
                INTRANET ESCOLAR
            </div>

            <nav aria-label="Navegación principal">

                ${[
                    ['inicio', 'home', 'Inicio'],
                    ['estudiantes', 'students', 'Estudiantes'],
                    ['profesores', 'teachers', 'Profesores'],
                    ['apoderados', 'family', 'Apoderados'],
                    ['visitas', 'visit', 'Visitas a hogares'],
                    ['registrar-visita', 'plus', 'Registrar visita']
                ].map(([r, i, l]) => `
                    <a
                        href="#${r}"
                        class="${activeRoute === r ? 'active' : ''}"
                        data-nav-route="${r}"
                        ${
                            activeRoute === r
                                ? 'aria-current="page"'
                                : ''
                        }
                    >
                        ${icon(i)}
                        ${l}
                    </a>
                `).join('')}

            </nav>

            <div class="sidebar-bottom">
                <strong>Programa de visitas</strong>
                Familia y escuela, en contacto.
                <br>
                Versión de prueba · 2026
            </div>

        </aside>

        <div class="workspace">

            <header class="topbar">

                <div class="topbar-left">

                    <button
                        class="menu-toggle"
                        aria-label="Abrir menú"
                        aria-expanded="false"
                    >
                        ${icon('menu')}
                    </button>

                    <span>
                        Gestión escolar /
                        <strong>
                            ${esc(pageTitle)}
                        </strong>
                    </span>

                </div>

                <div class="identity">

                    <span class="avatar">
                        ${esc(
                            user.usuario
                                .slice(0, 2)
                                .toUpperCase()
                        )}
                    </span>

                    <div>
                        <strong>${esc(user.usuario)}</strong>
                        <small>${esc(user.rol.toLowerCase())}</small>
                    </div>

                    <button
                        class="logout"
                        title="Cerrar sesión"
                        aria-label="Cerrar sesión"
                    >
                        ${icon('logout')}
                    </button>

                </div>

            </header>

            <main id="content">
                <p class="loading">Cargando…</p>
            </main>

        </div>
    `;

    $('.menu-toggle').onclick = () => {

        const open =
            $('.sidebar').classList.toggle('open');

        $('.menu-toggle').setAttribute(
            'aria-expanded',
            String(open)
        );

        $('.menu-toggle').setAttribute(
            'aria-label',
            open
                ? 'Cerrar menú'
                : 'Abrir menú'
        );
    };

    $$('[data-nav-route]').forEach(link => {

        link.addEventListener('click', () => {

            $('.sidebar').classList.remove('open');

            $('.menu-toggle').setAttribute(
                'aria-expanded',
                'false'
            );

            $('.menu-toggle').setAttribute(
                'aria-label',
                'Abrir menú'
            );
        });

    });

    $('.logout').onclick = async () => {

        if (
            dirty &&
            !confirm(
                'Hay cambios sin guardar. ¿Cerrar sesión?'
            )
        ) {
            return;
        }

        try {

            await api('logout', {
                method: 'POST'
            });

            dirty = false;
            user = null;
            visitDraft = null;

            await login();

        } catch (e) {

            toast(e.message, true);

        }
    };
}

async function login() {

    const session = await api('session');

    csrf = session.csrf;

    $('#app').innerHTML = `
        <div class="login">

            <aside class="login-aside">

                ${brand()}

                <div>

                    <span class="eyebrow">
                        Intranet escolar
                    </span>

                    <h1>
                        Más cerca de
                        <br>
                        cada estudiante.
                    </h1>

                    <p>
                        Un espacio para conocer a nuestras familias
                        y acompañar su desarrollo.
                    </p>

                </div>

                <footer>
                    Sistema de Visitas a Hogares · 2026
                </footer>

            </aside>

            <main class="login-main" id="content">

                <div class="login-box">

                    <span class="eyebrow">
                        Acceso al personal
                    </span>

                    <h2>
                        Bienvenido de nuevo
                    </h2>

                    <p>
                        Ingresa tus datos para acceder a la intranet.
                    </p>

                    <div id="login-error"></div>

                    <form id="login-form">

                        <label class="field">
                            Usuario

                            <input
                                name="usuario"
                                required
                                maxlength="50"
                                autocomplete="username"
                                placeholder="Tu usuario"
                            >
                        </label>

                        <label class="field">
                            Contraseña

                            <input
                                type="password"
                                name="password"
                                required
                                maxlength="72"
                                autocomplete="current-password"
                                placeholder="Tu contraseña"
                            >
                        </label>

                        <button
                            class="primary"
                            type="submit"
                        >
                            Iniciar sesión
                            ${icon('arrow')}
                        </button>

                    </form>

                    <div class="login-help">
                        ¿Es tu primera vez?
                        El administrador debe crear tu cuenta.
                        Consulta el README para configurar
                        el acceso de prueba.
                    </div>

                </div>

            </main>

        </div>
    `;

    $('#login-form').onsubmit = async e => {

        e.preventDefault();

        const b = $('button', e.target);

        b.disabled = true;

        try {

            const r = await api('login', {
                method: 'POST',
                data: collect(e.target)
            });

            csrf = r.csrf;

            await boot();

        } catch (err) {

            $('#login-error').innerHTML =
                errorBox(err);

        } finally {

            b.disabled = false;

        }
    };
}


function visitTable(items, compact = false) {

    if (!items.length) {
        return empty(
            'Todavía no hay visitas',
            'Registra la primera visita para comenzar el seguimiento.',
            newVisitButton()
        );
    }

    return `
        <div class="table-scroll">

            <table>

                <thead>

                    <tr>
                        <th>Estudiante</th>

                        ${compact
                            ? ''
                            : '<th>Profesor</th>'
                        }

                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>
                            <span class="muted">
                                Acciones
                            </span>
                        </th>
                    </tr>

                </thead>

                <tbody>

                    ${items.map(r => `
                        <tr>

                            <td>
                                <strong>
                                    ${esc(r.estudiante)}
                                </strong>

                                <span class="row-sub">
                                    ${esc(
                                        r.motivo ||
                                        'Visita al hogar'
                                    )}
                                </span>
                            </td>

                            ${compact
                                ? ''
                                : `
                                    <td>
                                        ${esc(r.profesor)}
                                    </td>
                                `
                            }

                            <td>
                                ${fmtDate(r.fecha_visita)}
                            </td>

                            <td>
                                ${badge(r.estado)}
                            </td>

                            <td>

                                <div class="table-actions">

                                    <a
                                        class="button"
                                        href="#detalle?id=${r.id_visita}"
                                    >
                                        Ver ficha
                                    </a>

                                    ${compact
                                        ? ''
                                        : `
                                            <a
                                                class="button"
                                                href="#registrar-visita?id=${r.id_visita}"
                                            >
                                                Editar
                                            </a>

                                            ${user.rol === 'ADMINISTRADOR'
                                                ? `
                                                    <button
                                                        class="danger"
                                                        data-delete="${r.id_visita}"
                                                    >
                                                        Eliminar
                                                    </button>
                                                `
                                                : ''
                                            }
                                        `
                                    }

                                </div>

                            </td>

                        </tr>
                    `).join('')}

                </tbody>

            </table>

        </div>
    `;
}


async function dashboard() {

    const serial = routeSerial;

    const r = await api('dashboard');

    if (serial !== routeSerial) return;

    $('#content').innerHTML =
        heading(
            'Inicio',
            'Consulta el seguimiento y organiza las próximas visitas.',
            newVisitButton()
        )
        +
        `
        <div class="stats">

            ${[
                [
                    'estudiantes',
                    'Estudiantes',
                    'students',
                    'Estudiantes registrados'
                ],
                [
                    'profesores',
                    'Profesores',
                    'teachers',
                    'Equipo docente registrado'
                ],
                [
                    'visitas',
                    'Visitas',
                    'visit',
                    'Total de fichas registradas'
                ],
                [
                    'pendientes',
                    'Por realizar',
                    'calendar',
                    'Pendientes y programadas'
                ]
            ].map(([k, t, i, s]) => `
                <div class="stat">

                    <div class="stat-top">
                        ${t}
                        <span class="stat-icon">
                            ${icon(i)}
                        </span>
                    </div>

                    <div class="number">
                        ${r.counts[k]}
                    </div>

                    <small>
                        ${s}
                    </small>

                </div>
            `).join('')}

        </div>

        <div class="dashboard-grid">

            <section class="panel">

                <div class="panel-head">

                    <div>
                        <h2>Visitas recientes</h2>
                        <p>Últimas fichas por fecha de visita</p>
                    </div>

                    <a
                        href="#visitas"
                        class="button"
                    >
                        Ver todas
                        ${icon('arrow')}
                    </a>

                </div>

                ${visitTable(r.recent, true)}

            </section>

            <aside class="dashboard-aside">

                <section class="panel">

                    <div class="panel-head">
                        <h2>Accesos rápidos</h2>
                    </div>

                    <div class="panel-body">

                        ${[
                            [
                                'estudiantes',
                                'students',
                                'Registrar estudiante'
                            ],
                            [
                                'profesores',
                                'teachers',
                                'Registrar profesor'
                            ],
                            [
                                'apoderados',
                                'family',
                                'Gestionar apoderados'
                            ]
                        ].map(([r, i, l]) => `
                            <a
                                class="quick-link"
                                href="#${r}?nuevo=1"
                            >
                                ${icon(i)}
                                ${l}
                            </a>
                        `).join('')}

                    </div>

                </section>

                <div class="note">

                    ${icon('file')}

                    <h3>
                        Una ficha, toda la información
                    </h3>

                    <p>
                        Registra los datos familiares,
                        la salud, la vivienda y el área
                        espiritual durante la visita al hogar.
                    </p>

                </div>

            </aside>

        </div>

        <footer class="footer">
            <span>
                IEP Johannes Gutenberg · Acompañamiento escolar
            </span>

            <span>
                Información de uso interno
            </span>
        </footer>
        `;
}


async function listPage(table, params) {

    let page = 1;
    let request = 0;

    $('#content').innerHTML =
        heading(
            names[table],
            table === 'visitas'
                ? 'Consulta las fichas y el historial de acompañamiento.'
                : 'Administra los datos y mantén el directorio actualizado.',

            table === 'visitas'
                ? newVisitButton()
                : `
                    <button class="primary" id="new-record">
                        ${icon('plus')}
                        Registrar ${singular[table]}
                    </button>
                `
        )
        +
        `
        <section class="panel">

            <form class="filters" id="filters">

                <label>
                    <span>Buscar</span>

                    <input
                        name="q"
                        type="search"
                        placeholder="${
                            table === 'visitas'
                                ? 'Estudiante, profesor o motivo'
                                : 'Nombres, apellidos o DNI'
                        }"
                    >
                </label>

                ${
                    table === 'estudiantes'
                        ? `
                            <label>
                                <span>Grado</span>
                                <input
                                    name="grado"
                                    placeholder="Todos los grados"
                                >
                            </label>

                            <label>
                                <span>Sección</span>
                                <input
                                    name="seccion"
                                    placeholder="Todas"
                                >
                            </label>
                        `
                        : ''
                }

                ${
                    table === 'visitas'
                        ? `
                            <label>
                                <span>Estado</span>

                                <select name="estado">
                                    <option value="">Todos</option>
                                    <option>Pendiente</option>
                                    <option>Programada</option>
                                    <option>Realizada</option>
                                    <option>Cancelada</option>
                                </select>
                            </label>

                            <label>
                                <span>Desde</span>
                                <input name="desde" type="date">
                            </label>

                            <label>
                                <span>Hasta</span>
                                <input name="hasta" type="date">
                            </label>
                        `
                        : ''
                }

                <button type="submit">
                    Filtrar
                </button>

                <button type="reset">
                    Limpiar
                </button>

            </form>

            <div id="list-body"></div>

        </section>
        `;

    const render = async () => {

        const serial = ++request;

        const holder = $('#list-body');

        holder.innerHTML =
            '<p class="loading">Cargando registros…</p>';

        try {

            const r = await api(table, {
                params: {
                    ...collect($('#filters')),
                    page
                }
            });

            if (
                serial !== request ||
                !holder.isConnected
            ) {
                return;
            }

            let content;

            if (table === 'visitas') {

                content = visitTable(r.items);

            } else if (!r.items.length) {

                content = empty(
                    'No hay registros para mostrar',
                    'Registra uno nuevo o cambia los filtros de búsqueda.'
                );

            } else {

                const cols =
                    table === 'estudiantes'
                        ? [
                            ['codigo', 'Código'],
                            ['nombre', 'Estudiante'],
                            ['dni', 'DNI'],
                            ['grado', 'Grado'],
                            ['seccion', 'Sección']
                        ]
                        : table === 'profesores'
                            ? [
                                ['nombre', 'Profesor'],
                                ['cargo', 'Cargo'],
                                ['curso', 'Curso'],
                                ['telefono', 'Teléfono'],
                                ['estado', 'Estado']
                            ]
                            : [
                                [
                                    'nombres_apellidos',
                                    'Apoderado'
                                ],
                                [
                                    'tipo_apoderado',
                                    'Parentesco'
                                ],
                                [
                                    'id_estudiante',
                                    'ID estudiante'
                                ],
                                ['celular', 'Celular'],
                                ['email', 'Correo']
                            ];

                content = `
                    <div class="table-scroll">

                        <table>

                            <thead>

                                <tr>

                                    ${cols.map(([, l]) => `
                                        <th>${l}</th>
                                    `).join('')}

                                    <th>
                                        Acciones
                                    </th>

                                </tr>

                            </thead>

                            <tbody>

                                ${r.items.map(row => `
                                    <tr>

                                        ${cols.map(([k]) => `
                                            <td>
                                                ${
                                                    k === 'nombre'
                                                        ? `
                                                            <strong>
                                                                ${esc(fullName(row))}
                                                            </strong>

                                                            <span class="row-sub">
                                                                ${esc(row.email || '')}
                                                            </span>
                                                        `
                                                        : k === 'estado'
                                                            ? badge(
                                                                Number(row[k])
                                                                    ? 'Activo'
                                                                    : 'Inactivo'
                                                            )
                                                            : esc(
                                                                row[k] ?? '—'
                                                            )
                                                }
                                            </td>
                                        `).join('')}

                                        <td>

                                            <div class="table-actions">

                                                <button
                                                    data-edit="${row[schema[table].pk]}"
                                                >
                                                    Editar
                                                </button>

                                                ${
                                                    user.rol === 'ADMINISTRADOR'
                                                        ? `
                                                            <button
                                                                class="danger"
                                                                data-delete="${row[schema[table].pk]}"
                                                            >
                                                                Eliminar
                                                            </button>
                                                        `
                                                        : ''
                                                }

                                            </div>

                                        </td>

                                    </tr>
                                `).join('')}

                            </tbody>

                        </table>

                    </div>
                `;
            }

            holder.innerHTML =
                content
                +
                `
                <div class="pagination">

                    <span>
                        ${r.total}
                        registro${r.total === 1 ? '' : 's'}
                        · Página ${page} de
                        ${Math.max(
                            1,
                            Math.ceil(r.total / 20)
                        )}
                    </span>

                    <div>

                        <button
                            id="prev"
                            ${page === 1 ? 'disabled' : ''}
                        >
                            Anterior
                        </button>

                        <button
                            id="next"
                            ${page * 20 >= r.total
                                ? 'disabled'
                                : ''}
                        >
                            Siguiente
                        </button>

                    </div>

                </div>
                `;

            $('#prev').onclick = () => {
                page--;
                render();
            };

            $('#next').onclick = () => {
                page++;
                render();
            };

            $$('[data-edit]', holder).forEach(b => {

                b.onclick = async () => {

                    try {

                        await editRecord(
                            table,
                            await api(table, {
                                params: {
                                    id: b.dataset.edit
                                }
                            }),
                            render
                        );

                    } catch (e) {

                        toast(e.message, true);

                    }
                };
            });

            $$('[data-delete]', holder).forEach(b => {

                b.onclick = () =>
                    confirmDelete(
                        table,
                        b.dataset.delete,
                        render
                    );
            });

        } catch (e) {

            if (holder.isConnected) {
                holder.innerHTML = errorBox(e);
            }
        }
    };

    $('#filters').onsubmit = e => {
        e.preventDefault();
        page = 1;
        render();
    };

    $('#filters').onreset = () => {

        setTimeout(() => {
            page = 1;
            render();
        }, 0);
    };

    if ($('#new-record')) {

        $('#new-record').onclick = () =>
            editRecord(
                table,
                {},
                render
            ).catch(e => toast(e.message, true));
    }

    await render();

    if (params.get('nuevo')) {
        await editRecord(
            table,
            {},
            render
        );
    }
}


function closeDialog() {

    $('#dialog').oncancel = null;

    if ($('#dialog').open) {
        $('#dialog').close();
    }

    $('#dialog').innerHTML = '';
}


async function confirmDelete(table, id, done) {

    const d = $('#dialog');

    d.innerHTML = `
        <div class="dialog-head">

            <h2 id="dialog-title">
                Eliminar ${singular[table]}
            </h2>

            <button
                data-close
                aria-label="Cerrar"
            >
                ×
            </button>

        </div>

        <p>
            Esta acción no se puede deshacer.

            ${
                table === 'visitas'
                    ? 'Se eliminarán también la salud, vivienda y área espiritual de esta ficha.'
                    : table === 'estudiantes'
                        ? 'También se eliminarán sus apoderados. Si tiene visitas, la eliminación será bloqueada.'
                        : 'Los registros con visitas asociadas no se pueden eliminar.'
            }
        </p>

        <div class="actions">

            <button data-close>
                Cancelar
            </button>

            <button
                id="confirm-delete"
                class="danger"
            >
                Eliminar definitivamente
            </button>

        </div>
    `;

    $$('[data-close]', d).forEach(
        b => b.onclick = closeDialog
    );

    d.showModal();

    $('#confirm-delete').onclick = async e => {

        e.target.disabled = true;

        try {

            await api(table, {
                method: 'DELETE',
                params: {
                    id
                }
            });

            closeDialog();

            toast('Registro eliminado.');

            await done();

        } catch (err) {

            toast(err.message, true);

            e.target.disabled = false;
        }
    };
}


function directoryFields(
    table,
    data,
    exclude
) {

    const groups =
        table === 'apoderados'
            ? [
                [
                    'Identidad y vínculo familiar',
                    [
                        'tipo_apoderado',
                        'parentesco_otro',
                        'nombres_apellidos',
                        'dni',
                        'fecha_nacimiento',
                        'estado_civil',
                        'fallecido',
                        'vive_otra_direccion'
                    ]
                ],

                [
                    'Contacto y domicilio',
                    [
                        'telefono_fijo',
                        'celular',
                        'email',
                        'direccion',
                        'distrito'
                    ]
                ],

                [
                    'Educación y trabajo',
                    [
                        'grado_instruccion',
                        'profesion',
                        'oficio_ocupacion',
                        'descripcion_trabajo',
                        'tipo_trabajo',
                        'empresa'
                    ]
                ],

                [
                    'Ingresos y jornada laboral',
                    [
                        'colaborador_acjg',
                        'ingreso_trabajo',
                        'otros_ingresos',
                        'total_ingresos',
                        'horario_desde',
                        'horario_hasta',
                        'horas_diarias',
                        'trabajo_rotativo'
                    ]
                ],

                [
                    'Seguro de salud',
                    [
                        'tiene_seguro',
                        'seguro'
                    ]
                ]
            ]

            : table === 'estudiantes'
                ? [
                    [
                        'Datos escolares',
                        [
                            'apellidos',
                            'nombres',
                            'dni',
                            'codigo',
                            'grado',
                            'seccion'
                        ]
                    ],

                    [
                        'Domicilio y familia',
                        [
                            'direccion',
                            'zona',
                            'distrito',
                            'telefono_fijo',
                            'fecha_nacimiento',
                            'lugar_como_hijo',
                            'total_hermanos_casa',
                            'con_quien_vive'
                        ]
                    ]
                ]

                : null;

    return groups
        ? groups.map(([title, keys]) => `
            <h3 class="form-group-title">
                ${title}
            </h3>

            ${keys
                .map(n => field(
                    table,
                    n,
                    data[n],
                    'record-'
                ))
                .join('')
            }
        `).join('')

        : fields(
            table,
            data,
            exclude,
            'record-'
        );
}


async function editRecord(
    table,
    data = {},
    done = () => {},
    studentId = null
) {

    const d = $('#dialog');

    let students = [];

    if (table === 'apoderados') {
        students = await all('estudiantes');
    }

    const exclude =
        table === 'apoderados'
            ? ['id_estudiante']
            : [];

    d.innerHTML = `
        <div class="dialog-head">

            <h2 id="dialog-title">
                ${data[schema[table].pk]
                    ? 'Editar'
                    : 'Registrar'
                }
                ${singular[table]}
            </h2>

            <button
                data-close
                aria-label="Cerrar"
            >
                ×
            </button>

        </div>

        <p
            class="muted"
            style="margin-bottom:22px"
        >
            Los campos con * son obligatorios.
        </p>

        <form id="record-form">

            <div class="form-grid">

                ${
                    table === 'apoderados'
                        ? `
                            <label class="field">

                                Estudiante *

                                <select
                                    name="id_estudiante"
                                    required
                                    ${studentId ? 'disabled' : ''}
                                >

                                    <option value="">
                                        Seleccionar estudiante
                                    </option>

                                    ${students.map(s => `
                                        <option
                                            value="${s.id_estudiante}"
                                            ${
                                                String(
                                                    studentId ??
                                                    data.id_estudiante
                                                ) ===
                                                String(s.id_estudiante)
                                                    ? 'selected'
                                                    : ''
                                            }
                                        >
                                            ${esc(fullName(s))}
                                            ·
                                            ${esc(s.grado)}
                                            ${esc(s.seccion)}
                                        </option>
                                    `).join('')}

                                </select>

                            </label>
                        `
                        : ''
                }

                ${directoryFields(
                    table,
                    data,
                    exclude
                )}

            </div>

            <div class="actions">

                <button
                    type="button"
                    data-close
                >
                    Cancelar
                </button>

                <button
                    class="primary"
                    type="submit"
                >
                    Guardar ${singular[table]}
                </button>

            </div>

        </form>
    `;

    let changed = false;

    d.oncancel = e => {

        if (
            changed &&
            !confirm(
                '¿Descartar los cambios del formulario?'
            )
        ) {
            e.preventDefault();
        }
    };

    $$('[data-close]', d).forEach(
        b => b.onclick = () => {

            if (
                !changed ||
                confirm(
                    '¿Descartar los cambios del formulario?'
                )
            ) {
                closeDialog();
            }
        }
    );

    const form = $('#record-form');

    form.oninput = () => {
        changed = true;
    };

    if (table === 'apoderados') {

        const updateIncome = () => {

            const omit =
                $('[name=colaborador_acjg]', form).value === '1';

            for (
                const n of [
                    'ingreso_trabajo',
                    'otros_ingresos',
                    'total_ingresos'
                ]
            ) {
                $(`[name=${n}]`, form).disabled = omit;
            }

            $('[name=total_ingresos]', form).value =
                omit
                    ? ''
                    : (
                        (Number(
                            $('[name=ingreso_trabajo]', form).value
                        ) || 0)
                        +
                        (Number(
                            $('[name=otros_ingresos]', form).value
                        ) || 0)
                    ).toFixed(2);
        };

        for (
            const n of [
                'colaborador_acjg',
                'ingreso_trabajo',
                'otros_ingresos'
            ]
        ) {
            $(`[name=${n}]`, form)
                .addEventListener(
                    'input',
                    updateIncome
                );
        }

        updateIncome();
    }

    form.onsubmit = async e => {

        e.preventDefault();

        const b = $('button[type=submit]', form);

        b.disabled = true;

        try {

            const id =
                data[schema[table].pk];

            await api(table, {
                method: id ? 'PUT' : 'POST',
                params: {
                    id
                },
                data: collect(form)
            });

            closeDialog();

            toast(
                'Datos guardados correctamente.'
            );

            await done();

        } catch (err) {

            showErrors(form, err);

        } finally {

            b.disabled = false;
        }
    };

    d.showModal();
}


const stepNames = [
    'Datos del estudiante',
    'Apoderados',
    'Información familiar',
    'Salud',
    'Vivienda',
    'Área espiritual',
    'Observaciones'
];

let studentChoices = [];
let profChoices = [];


async function wizard(id) {

    const serial = routeSerial;

    [
        studentChoices,
        profChoices
    ] = await Promise.all([
        all('estudiantes'),
        all('profesores')
    ]);

    if (serial !== routeSerial) return;

    visitDraft = id
        ? await api('visitas', {
            params: {
                id
            }
        })
        : {
            visita: {
                fecha_visita:
                    new Date().toLocaleDateString(
                        'en-CA',
                        {
                            timeZone: 'America/Lima'
                        }
                    ),
                estado: 'Realizada'
            },

            salud: {},

            vivienda: {},

            area_espiritual: [
                'PADRE',
                'MADRE',
                'HIJO'
            ].map(persona => ({
                persona
            })),

            apoderados: [],

            estudiante: {}
        };

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
            visitDraft.visita.fecha_visita
        )
    ) {

        const d = new Date();

        visitDraft.visita.fecha_visita = [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, '0'),
            String(d.getDate()).padStart(2, '0')
        ].join('-');
    }

    if (serial !== routeSerial) return;

    currentStep = 0;
    dirty = false;

    renderWizard();
}


function captureStep() {

    const form = $('#visit-form');

    if (!form) return;

    const values = collect(form);

    if ([0, 2, 6].includes(currentStep)) {
        Object.assign(
            visitDraft.visita,
            values
        );
    }

    if (currentStep === 3) {
        visitDraft.salud = values;
    }

    if (currentStep === 4) {
        visitDraft.vivienda = values;
    }

    if (currentStep === 5) {

        visitDraft.area_espiritual =
            $$('[data-persona]', form)
                .map(el => ({
                    ...collect(el),
                    persona: el.dataset.persona
                }));
    }
}


function stepValid() {

    const form = $('#visit-form');

    return !form || form.reportValidity();
}


function choice(
    name,
    label,
    items,
    pk,
    value,
    disabled = false
) {

    return `
        <label class="field">

            ${label} *

            <select
                name="${name}"
                id="visit-${name}"
                required
                ${disabled ? 'disabled' : ''}
            >

                <option value="">
                    Seleccionar
                </option>

                ${items.map(r => `
                    <option
                        value="${r[pk]}"
                        ${
                            String(value) === String(r[pk])
                                ? 'selected'
                                : ''
                        }
                    >
                        ${esc(fullName(r))}
                        ${r.estado === 0
                            ? ' (inactivo)'
                            : ''
                        }
                    </option>
                `).join('')}

            </select>

        </label>
    `;
}


function renderWizard() {

    const v = visitDraft.visita;
    const editing = !!v.id_visita;

    $('#content').innerHTML =
        heading(
            editing
                ? 'Editar visita'
                : 'Registrar visita',

            'Completa la ficha por secciones. Los campos con * son obligatorios.',

            `
                <button id="cancel-visit">
                    Cancelar
                </button>
            `
        )
        +
        `
        <div class="wizard-layout">

            <nav
                class="steps"
                aria-label="Secciones de la ficha"
            >

                ${stepNames.map((n, i) => `
                    <button
                        data-step="${i}"
                        class="${i === currentStep
                            ? 'active'
                            : ''
                        }"
                        ${
                            i === currentStep
                                ? 'aria-current="step"'
                                : ''
                        }
                    >
                        <span class="step-num">
                            ${i + 1}
                        </span>

                        ${n}
                    </button>
                `).join('')}

            </nav>

            <section class="panel">

                <div class="wizard-progress">
                    <span
                        style="width:${
                            (currentStep + 1) / 7 * 100
                        }%"
                    ></span>
                </div>

                <form id="visit-form">

                    <div
                        id="step-content"
                        class="form-section"
                    ></div>

                    <div class="wizard-foot">

                        <small>
                            Sección
                            ${currentStep + 1}
                            de 7
                        </small>

                        <div class="actions">

                            <button
                                type="button"
                                id="previous-step"
                                ${currentStep === 0
                                    ? 'disabled'
                                    : ''
                                }
                            >
                                Anterior
                            </button>

                            <button
                                type="submit"
                                class="primary"
                            >
                                ${
                                    currentStep === 6
                                        ? 'Guardar visita'
                                        : 'Siguiente ' +
                                          icon('arrow')
                                }
                            </button>

                        </div>

                    </div>

                </form>

            </section>

        </div>
        `;

    const content = $('#step-content');

    let html = `
        <h2>
            ${String(currentStep + 1).padStart(2, '0')}.
            ${stepNames[currentStep]}
        </h2>
    `;

    if (currentStep === 0) {

        html += `
            <p>
                Selecciona al estudiante y al docente
                que realiza la visita.
            </p>
        `;

        if (
            !studentChoices.length ||
            !profChoices.length
        ) {
            html += `
                <div class="error-banner">
                    Primero registra al menos un estudiante
                    y un profesor desde el menú.
                </div>
            `;
        }

        html += `
            <div class="form-grid">

                ${choice(
                    'id_estudiante',
                    'Estudiante',
                    studentChoices,
                    'id_estudiante',
                    v.id_estudiante,
                    editing
                )}

                ${choice(
                    'id_profesor',
                    'Profesor responsable',
                    profChoices.filter(
                        p =>
                            Number(p.estado) ||
                            String(p.id_profesor) ===
                            String(v.id_profesor)
                    ),
                    'id_profesor',
                    v.id_profesor
                )}

                ${[
                    'fecha_visita',
                    'motivo',
                    'estado'
                ].map(n =>
                    field(
                        'visitas',
                        n,
                        v[n],
                        'visit-'
                    )
                ).join('')}

            </div>

            <div id="student-context"></div>
        `;
    }

    if (currentStep === 1) {

        html += `
            <p>
                ${
                    editing
                        ? 'Estos datos corresponden al momento en que se registró la visita.'
                        : 'Revisa los apoderados del estudiante. Los cambios se guardan en su directorio.'
                }
            </p>

            <div id="family-list"></div>

            ${
                editing
                    ? ''
                    : `
                        <button
                            type="button"
                            id="add-family"
                        >
                            ${icon('plus')}
                            Añadir apoderado
                        </button>
                    `
            }
        `;
    }

    if (currentStep === 2) {

        html += `
            <p>
                Registra las condiciones de estudio
                y las responsabilidades en el hogar.
            </p>

            <div class="form-grid">

                ${
                    [
                        'ambiente_individual',
                        'cama_propia',
                        'responsable_matricula',
                        'quien_controla_tareas',
                        'lugar_estudio',
                        'quien_supervisa_quehaceres',
                        'responsabilidades',
                        'trabaja',
                        'actividad'
                    ]
                    .map(n =>
                        field(
                            'visitas',
                            n,
                            v[n],
                            'visit-'
                        )
                    )
                    .join('')
                }

            </div>
        `;
    }

    if (currentStep === 3) {

        html += `
            <p>
                Necesidades de aprendizaje,
                diagnóstico y acompañamiento.
            </p>

            <div class="form-grid">
                ${fields(
                    'salud',
                    visitDraft.salud,
                    ['id_visita'],
                    'health-'
                )}
            </div>
        `;
    }

    if (currentStep === 4) {

        html += `
            <p>
                Características, servicios
                y condiciones de la vivienda.
            </p>

            <div class="form-grid">
                ${fields(
                    'vivienda',
                    visitDraft.vivienda,
                    ['id_visita'],
                    'home-'
                )}
            </div>
        `;
    }

    if (currentStep === 5) {

        html += `
            <p>
                Completa la información disponible
                de cada integrante.
            </p>

            ${
                [
                    'PADRE',
                    'MADRE',
                    'HIJO'
                ].map(persona => `
                    <section
                        class="family-card"
                        data-persona="${persona}"
                    >

                        <h3 style="margin-bottom:20px">
                            ${
                                persona === 'HIJO'
                                    ? 'Estudiante'
                                    : persona === 'PADRE'
                                        ? 'Padre'
                                        : 'Madre'
                            }
                        </h3>

                        <div class="form-grid">

                            ${fields(
                                'area_espiritual',
                                visitDraft.area_espiritual.find(
                                    a => a.persona === persona
                                ) || {},
                                [
                                    'id_visita',
                                    'persona'
                                ],
                                persona + '-'
                            )}

                        </div>

                    </section>
                `).join('')
            }
        `;
    }

    if (currentStep === 6) {

        html += `
            <p>
                Revisa las secciones antes de guardar
                la ficha completa.
            </p>

            <div
                class="context-card"
                style="margin:0 0 22px"
            >

                <strong>
                    ${esc(fullName(visitDraft.estudiante))}
                </strong>

                <br>

                ${fmtDate(v.fecha_visita)}
                ·
                ${esc(v.estado)}

                <br>

                ${visitDraft.apoderados.length}
                apoderado(s)
                ${
                    editing
                        ? 'en la ficha'
                        : 'en el directorio'
                }

            </div>

            <div class="form-grid">

                ${[
                    'correo_responsable',
                    'observaciones'
                ].map(n =>
                    field(
                        'visitas',
                        n,
                        v[n],
                        'visit-'
                    )
                ).join('')}

            </div>
        `;
    }

    content.innerHTML = html;

    const form = $('#visit-form');

    form.oninput = () => {
        dirty = true;
    };

    const move = next => {

        if (
            next > currentStep &&
            !stepValid()
        ) {
            return;
        }

        captureStep();

        currentStep = next;

        renderWizard();

        $('#step-content h2')
            .setAttribute('tabindex', '-1');

        $('#step-content h2').focus();
    };

    $$('[data-step]').forEach(b => {

        b.onclick = () =>
            move(Number(b.dataset.step));
    });

    $('#previous-step').onclick = () =>
        move(currentStep - 1);

    $('#cancel-visit').onclick = () => {

        if (
            !dirty ||
            confirm(
                '¿Descartar la ficha sin guardar?'
            )
        ) {

            dirty = false;

            location.hash = '#visitas';
        }
    };

    form.onsubmit = async e => {

        e.preventDefault();

        if (currentStep < 6) {

            move(currentStep + 1);

            return;
        }

        captureStep();

        if (
            !v.id_estudiante ||
            !v.id_profesor ||
            !v.fecha_visita
        ) {

            toast(
                'Completa estudiante, profesor y fecha.',
                true
            );

            currentStep = 0;

            renderWizard();

            return;
        }

        const b = $('button[type=submit]', form);

        b.disabled = true;
        b.textContent = 'Guardando…';

        try {

            const result = await api('visitas', {
                method: editing
                    ? 'PUT'
                    : 'POST',

                params: {
                    id: v.id_visita
                },

                data: {
                    visita: v,
                    salud: visitDraft.salud,
                    vivienda: visitDraft.vivienda,
                    area_espiritual:
                        visitDraft.area_espiritual
                }
            });

            dirty = false;

            toast(
                'Visita guardada correctamente.'
            );

            location.hash =
                '#detalle?id=' +
                result.id;

        } catch (err) {

            const key =
                Object.keys(
                    err.fields || {}
                )[0];

            const target =
                key &&
                [
                    'id_estudiante',
                    'id_profesor',
                    'fecha_visita',
                    'estado',
                    'motivo'
                ].includes(key)
                    ? 0
                    : Object.hasOwn(
                        schema.salud.fields,
                        key
                    )
                        ? 3
                        : Object.hasOwn(
                            schema.vivienda.fields,
                            key
                        )
                            ? 4
                            : Object.hasOwn(
                                schema.area_espiritual.fields,
                                key
                            )
                                ? 5
                                : [
                                    'correo_responsable',
                                    'observaciones'
                                ].includes(key)
                                    ? 6
                                    : 2;

            if (
                target !== undefined &&
                target !== currentStep
            ) {

                currentStep = target;

                renderWizard();

                showErrors(
                    $('#visit-form'),
                    err
                );

            } else {

                showErrors(
                    form,
                    err
                );

                b.disabled = false;

                b.textContent =
                    'Guardar visita';
            }
        }
    };

    if (currentStep === 0) {

        const select =
            $('#visit-id_estudiante');

        select.onchange = async () => {

            captureStep();

            const sid = select.value;

            visitDraft.estudiante =
                studentChoices.find(
                    s =>
                        String(s.id_estudiante) ===
                        sid
                ) || {};

            visitDraft.apoderados = [];

            showStudentContext();

            if (sid) {

                try {

                    const aps =
                        await all(
                            'apoderados',
                            {
                                id_estudiante: sid
                            }
                        );

                    if (
                        String(
                            visitDraft.visita.id_estudiante
                        ) === sid
                    ) {

                        visitDraft.apoderados =
                            aps;

                        showFamily();
                    }

                } catch (e) {

                    toast(
                        e.message,
                        true
                    );
                }
            }
        };

        showStudentContext();
    }

    if (currentStep === 1) {

        showFamily();

        if ($('#add-family')) {

            $('#add-family').onclick = () => {

                if (!v.id_estudiante) {

                    toast(
                        'Selecciona primero un estudiante.',
                        true
                    );

                    return;
                }

                editRecord(
                    'apoderados',
                    {},
                    refreshFamily,
                    v.id_estudiante
                ).catch(
                    e => toast(
                        e.message,
                        true
                    )
                );
            };
        }
    }
}


function showStudentContext() {

    const box = $('#student-context');

    if (!box) return;

    const s = visitDraft.estudiante;

    if (!s.id_estudiante) {

        box.innerHTML = '';

        return;
    }

    box.innerHTML = `
        <div class="context-card">

            <strong>
                ${esc(fullName(s))}
            </strong>

            <br>

            ${esc(s.grado)}
            ·
            Sección
            ${esc(s.seccion)}
            ·
            DNI
            ${esc(s.dni || 'sin registrar')}

            <br>

            ${esc(
                s.direccion ||
                'Dirección sin registrar'
            )}

            ·

            ${esc(s.distrito || '')}

            <br>

            Vive con:
            ${esc(
                s.con_quien_vive ||
                'sin especificar'
            )}

            ·

            Hermanos:
            ${esc(
                s.total_hermanos_casa ??
                'sin especificar'
            )}

            ${
                visitDraft.visita.id_visita
                    ? ''
                    : `
                        <div class="actions">

                            <button
                                type="button"
                                id="edit-student"
                            >
                                Completar datos
                                del estudiante
                            </button>

                        </div>
                    `
            }

        </div>
    `;

    if ($('#edit-student')) {

        $('#edit-student').onclick =
            () =>
                editRecord(
                    'estudiantes',
                    s,
                    async () => {

                        visitDraft.estudiante =
                            await api(
                                'estudiantes',
                                {
                                    params: {
                                        id: s.id_estudiante
                                    }
                                }
                            );

                        studentChoices =
                            await all('estudiantes');

                        showStudentContext();
                    }
                )
                .catch(
                    e => toast(
                        e.message,
                        true
                    )
                );
    }
}


async function refreshFamily() {

    visitDraft.apoderados =
        await all(
            'apoderados',
            {
                id_estudiante:
                    visitDraft.visita.id_estudiante
            }
        );

    showFamily();
}


function showFamily() {

    const box = $('#family-list');

    if (!box) return;

    box.innerHTML =
        visitDraft.apoderados.length

            ? visitDraft.apoderados.map(a => `
                <div class="family-card">

                    <strong>
                        ${esc(a.nombres_apellidos)}
                    </strong>

                    <p class="muted">
                        ${esc(
                            a.tipo_apoderado
                                .replaceAll('_', ' ')
                        )}

                        ·

                        ${esc(
                            a.celular ||
                            'Sin celular'
                        )}

                        <br>

                        ${esc(
                            a.email ||
                            'Sin correo'
                        )}
                    </p>

                    ${
                        visitDraft.visita.id_visita
                            ? ''
                            : `
                                <div class="actions">

                                    <button
                                        type="button"
                                        data-family="${a.id_apoderado}"
                                    >
                                        Editar apoderado
                                    </button>

                                </div>
                            `
                    }

                </div>
            `).join('')

            : `
                <p
                    class="context-card"
                    style="margin-bottom:20px"
                >
                    No hay apoderados registrados
                    para este estudiante.
                </p>
            `;

    $$('[data-family]', box).forEach(b => {

        b.onclick = () =>
            editRecord(
                'apoderados',

                visitDraft.apoderados.find(
                    a =>
                        String(a.id_apoderado) ===
                        b.dataset.family
                ),

                refreshFamily,

                visitDraft.visita.id_estudiante
            )
            .catch(
                e => toast(
                    e.message,
                    true
                )
            );
    });
}


function detailFields(
    table,
    data,
    exclude = []
) {

    return `
        <dl class="detail-grid">

            ${
                Object.entries(
                    schema[table].fields
                )
                .filter(
                    ([n]) => !exclude.includes(n)
                )
                .map(([n, f]) => {

                    let v = data[n];

                    if (f.type === 'boolean') {

                        v =
                            v == null
                                ? 'Sin especificar'
                                : Number(v)
                                    ? 'Sí'
                                    : 'No';

                    } else if (f.type === 'date') {

                        v = fmtDate(v);
                    }

                    return `
                        <div
                            class="${
                                f.type === 'textarea'
                                    ? 'wide'
                                    : ''
                            }"
                        >

                            <dt>
                                ${esc(f.label)}
                            </dt>

                            <dd>
                                ${esc(
                                    v == null ||
                                    v === ''
                                        ? 'Sin especificar'
                                        : v
                                )}
                            </dd>

                        </div>
                    `;
                })
                .join('')
            }

        </dl>
    `;
}


async function detail(id) {

    const serial = routeSerial;

    const d = await api(
        'visitas',
        {
            params: {
                id
            }
        }
    );

    if (serial !== routeSerial) return;

    const panel = (
        title,
        body
    ) => `
        <section class="panel">

            <div class="panel-head">
                <h2>${title}</h2>
            </div>

            <div class="panel-body">
                ${body}
            </div>

        </section>
    `;

    $('#content').innerHTML =
        heading(
            'Ficha de visita #' + Number(id),

            `
                ${esc(
                    fullName(d.estudiante)
                )}
                ·
                ${fmtDate(
                    d.visita.fecha_visita
                )}
            `,

            `
                <div class="actions">

                    <a
                        class="button"
                        href="#visitas"
                    >
                        Volver
                    </a>

                    <button id="print">
                        Imprimir
                    </button>

                    <a
                        class="button primary"
                        href="#registrar-visita?id=${Number(id)}"
                    >
                        Editar ficha
                    </a>

                </div>
            `
        )

        +

        panel(
            'Datos de la visita',

            `
                <p style="margin-bottom:20px">

                    Profesor responsable:

                    <strong>
                        ${esc(
                            fullName(d.profesor)
                        )}
                    </strong>

                    ·

                    ${badge(
                        d.visita.estado
                    )}

                </p>

                ${detailFields(
                    'visitas',
                    d.visita,
                    [
                        'id_estudiante',
                        'id_profesor'
                    ]
                )}
            `
        )

        +

        panel(
            'Datos del estudiante',
            detailFields(
                'estudiantes',
                d.estudiante
            )
        )

        +

        panel(
            'Apoderados · Datos al registrar la visita',

            d.apoderados.length

                ? d.apoderados.map(a => `
                    <h3 style="margin:20px 0">
                        ${esc(
                            a.nombres_apellidos
                        )}
                    </h3>

                    ${detailFields(
                        'apoderados',
                        a,
                        ['id_estudiante']
                    )}
                `).join('')

                : '<p>No se registraron apoderados.</p>'
        )

        +

        panel(
            'Salud',
            detailFields(
                'salud',
                d.salud,
                ['id_visita']
            )
        )

        +

        panel(
            'Vivienda',
            detailFields(
                'vivienda',
                d.vivienda,
                ['id_visita']
            )
        )

        +

        panel(
            'Área espiritual',

            d.area_espiritual.map(a => `
                <h3 style="margin:20px 0">
                    ${esc(a.persona)}
                </h3>

                ${detailFields(
                    'area_espiritual',
                    a,
                    [
                        'id_visita',
                        'persona'
                    ]
                )}
            `).join('')
        );

    $('#print').onclick =
        () => window.print();
}


let acceptedHash = location.hash;


window.addEventListener(
    'beforeunload',
    e => {

        if (dirty) {

            e.preventDefault();

            e.returnValue = '';
        }
    }
);


window.addEventListener(
    'hashchange',
    async () => {

        if (
            dirty &&
            !confirm(
                'Hay cambios sin guardar. ¿Salir de la ficha?'
            )
        ) {

            history.replaceState(
                null,
                '',
                acceptedHash || '#inicio'
            );

            return;
        }

        dirty = false;

        acceptedHash =
            location.hash;

        await route();
    }
);


async function route() {

    if (!user) return;

    closeDialog();

    const serial = ++routeSerial;

    const [
        name = 'inicio',
        search = ''
    ] = location.hash
        .slice(1)
        .split('?');

    const params =
        new URLSearchParams(search);

    shell();

    try {

        if (
            name === 'inicio' ||
            !name
        ) {

            await dashboard();

        } else if (names[name]) {

            await listPage(
                name,
                params
            );

        } else if (
            name === 'registrar-visita'
        ) {

            await wizard(
                params.get('id')
            );

        } else if (
            name === 'detalle' &&
            params.get('id')
        ) {

            await detail(
                params.get('id')
            );

        } else {

            $('#content').innerHTML =
                empty(
                    'Página no encontrada',
                    'Vuelve al inicio para continuar.',
                    `
                        <a
                            class="button"
                            href="#inicio"
                        >
                            Inicio
                        </a>
                    `
                );
        }

    } catch (e) {

        if (serial === routeSerial) {

            $('#content').innerHTML =
                errorBox(e)
                +
                `
                    <button id="retry">
                        Volver a intentar
                    </button>
                `;
        }

        if ($('#retry')) {
            $('#retry').onclick = route;
        }
    }
}


async function boot() {

    try {

        const s =
            await api('session');

        csrf = s.csrf;
        user = s.user;

        if (!user) {

            await login();

            return;
        }

        schema =
            await api('schema');

        await route();

    } catch (e) {

        $('#app').innerHTML = `
            <main>

                ${heading(
                    'No se pudo abrir la intranet'
                )}

                ${errorBox(e)}

                <p>
                    Activa Apache y MySQL en XAMPP.
                    Importa el esquema y ejecuta
                    la migración antes de iniciar sesión.
                </p>

                <button id="retry">
                    Volver a intentar
                </button>

            </main>
        `;

        $('#retry').onclick = boot;
    }
}


$('.skip').addEventListener(
    'click',
    e => {

        e.preventDefault();

        const main = $('#content');

        if (main) {

            main.setAttribute(
                'tabindex',
                '-1'
            );

            main.focus();

            main.scrollIntoView();
        }
    }
);


boot();