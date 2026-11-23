// OptiProcess Tech - Frontend SPA (JavaScript puro, sin dependencias)
const $ = s => document.querySelector(s);
let T = localStorage.tk, U = JSON.parse(localStorage.us || 'null'), SC = null, view = 'dashboard', rows = [], q = '', sortK = '', sortD = 1;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fdate = s => s ? new Date(s).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '';
function toast(m, e) { const d = document.createElement('div'); d.className = 't' + (e ? ' e' : ''); d.textContent = m; $('#toast').append(d); setTimeout(() => d.remove(), 4200); }
async function api(p, m = 'GET', b) {
  const r = await fetch('/api/' + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T }, body: b ? JSON.stringify(b) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && p !== 'login') { logout(); throw new Error(j.error); }
  if (!r.ok) throw new Error(j.error || 'Error'); return j;
}
const badge = v => {
  const s = String(v ?? '');
  if (s.startsWith('Aplicado')) return `<span class="b g">${esc(s)}</span>`;
  const m = { Aprobado: 'g', Terminada: 'g', Entregado: 'g', Activo: 'g', Rechazado: 'r', Retrasado: 'r', Incapacidad: 'r', 'En proceso': 'bl', 'En ruta': 'bl', Pendiente: 'y', Programado: 'y', Vacaciones: 'y', 'Sin receta': 'y' };
  return m[s] ? `<span class="b ${m[s]}">${esc(s)}</span>` : esc(s);
};

// ---- Sesión ----
$('#lf').onsubmit = async e => { e.preventDefault(); try { const r = await api('login', 'POST', { user: $('#lu').value, pass: $('#lp').value }); T = r.token; U = r.user; localStorage.tk = T; localStorage.us = JSON.stringify(U); start(); } catch (x) { toast(x.message, 1); } };
function logout() { localStorage.removeItem('tk'); T = null; $('#app').classList.add('hide'); $('#login').classList.remove('hide'); }
$('#out').onclick = logout;
async function start() {
  try { SC = await api('schema'); } catch { return logout(); }
  $('#login').classList.add('hide'); $('#app').classList.remove('hide'); $('#who').textContent = `${U.nombre} · ${U.rol}`;
  const items = [['dashboard', '📊', 'Dashboard'], ...Object.entries(SC.S).filter(([m]) => SC.perm[m][0]).map(([m, s]) => [m, s.ic, s.t]), ['reporte', '📄', 'Reporte'], ['auditoria', '🕵️', 'Trazabilidad']];
  $('#nav').innerHTML = items.map(([k, i, t]) => `<a data-k="${k}">${i} ${t}</a>`).join('');
  $('#nav').onclick = e => { const k = e.target.dataset.k; if (k) { go(k); $('#side').classList.remove('open'); } };
  go('dashboard'); alerts();
}
$('#burger').onclick = () => $('#side').classList.toggle('open');
$('#theme').onclick = () => { const d = document.documentElement.dataset.t === 'dark'; document.documentElement.dataset.t = d ? '' : 'dark'; localStorage.th = d ? '' : 'dark'; };
document.documentElement.dataset.t = localStorage.th || '';
$('#bellb').onclick = () => $('#bpanel').classList.toggle('hide');

async function alerts() {
  const a = await api('alertas'); $('#bcount').textContent = a.length || '';
  $('#bpanel').innerHTML = a.length ? a.map(x => `<div>${x.n === 'critica' ? '🔴' : '🟠'} ${esc(x.t)}</div>`).join('') : '<div>Sin alertas 🎉</div>';
}
function go(k) { view = k; q = ''; sortK = ''; document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.k === k)); render(); }

async function render() {
  const t = SC.S[view]; $('#title').textContent = t ? t.t : { dashboard: 'Dashboard en tiempo real', reporte: 'Reporte automático', auditoria: 'Trazabilidad de operaciones' }[view];
  try { if (view === 'dashboard') await dash(); else if (view === 'reporte') await reporte(); else if (view === 'auditoria') await audit(); else { rows = await api(view); table(); } } catch (e) { toast(e.message, 1); }
  alerts();
}
setInterval(() => { if ($('#modal').classList.contains('hide') && T && SC && !document.activeElement?.matches('input')) render(); }, 10000);

// ---- Gráficos ----
const bars = (data, max) => { max = max || Math.max(1, ...data.map(d => d.v)); return data.map(d => `<div class="bar"><span>${esc(d.l)}</span><div class="tr"><i style="width:${Math.min(100, d.v * 100 / max)}%;${d.v <= (d.min ?? -1) ? 'background:var(--er)' : ''}"></i></div><b>${d.v}</b></div>`).join(''); };
async function dash() {
  const d = await api('dashboard'), k = (l, v, w) => `<div class="card kpi ${w ? 'warn' : ''}"><span class="muted">${l}</span><b>${v}</b></div>`;
  $('#view').innerHTML = `<div class="kpis">${k('Órdenes de producción', d.ordenes)}${k('Unidades terminadas', d.unidadesTerminadas)}${k('Unidades despachadas', d.unidadesDespachadas || 0)}${k('Recetas activas', d.recetasCount || 0)}${k('Calidad aprobada', d.calidadPct + '%')}${k('Entregas a tiempo', d.entregasATiempo + '%')}${k('Ítems con stock bajo', d.stockBajo, d.stockBajo)}${k('Personal activo', d.activos + '/' + d.personal)}${k('Alertas activas', d.alertas, d.alertas)}</div>
  <div class="grid2"><div class="card"><h3>Producción por estado</h3>${bars(Object.entries(d.porEstado).map(([l, v]) => ({ l, v })))}</div>
  <div class="card"><h3>Despachos por estado</h3>${bars(Object.entries(d.despachos).map(([l, v]) => ({ l, v })))}</div>
  <div class="card"><h3>Inventario (rojo = bajo mínimo)</h3>${bars(d.stock.map(s => ({ l: s.l, v: s.v, min: s.min })))}</div></div>`;
}

// ---- Render de celdas ----
function renderCell(c, x) {
  if (c.k === 'estado' || c.k === 'resultado' || c.k === 'stockAplicado') return badge(x[c.k]);
  if (c.k === 'stock' && x.stock <= x.minimo) return `<span class="b r">${x.stock} ⚠</span>`;
  if ((c.k === 'insumos' || c.k === 'carga') && Array.isArray(x[c.k])) {
    const items = x[c.k].map(i => `<span class="chip">${esc(i.item)}: <b>${i.cantidad} ${esc(i.unidad)}</b></span>`).join('');
    return `<div class="col-wrap">${items || '<span class="muted">Sin asignar</span>'}</div>`;
  }
  return esc(x[c.k]);
}

// ---- Tabla CRUD ----
function table() {
  const s = SC.S[view], [, w] = SC.perm[view], cols = [{ k: 'id', l: 'ID' }, ...s.f];
  let r = rows.filter(x => !q || JSON.stringify(x).toLowerCase().includes(q.toLowerCase()));
  if (sortK) r = [...r].sort((a, b) => (a[sortK] > b[sortK] ? 1 : -1) * sortD);
  $('#view').innerHTML = `<div class="tools"><input id="sq" placeholder="🔍 Buscar..." value="${esc(q)}">
    ${w ? '<button class="btn" id="new">+ Nuevo</button>' : ''}<button class="btn ghost" id="csv">⬇ Exportar CSV</button></div>
  <div class="card tw"><table><thead><tr>${cols.map(c => `<th data-k="${c.k}">${c.l}${sortK === c.k ? (sortD > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}<th></th></tr></thead><tbody>
  ${r.map(x => `<tr>${cols.map(c => `<td>${renderCell(c, x)}</td>`).join('')}<td>${w ? actions(x) : ''}</td></tr>`).join('') || `<tr><td colspan="${cols.length + 1}" class="muted">Sin registros</td></tr>`}</tbody></table></div>`;
  $('#sq').oninput = e => { q = e.target.value; const p = e.target.selectionStart; table(); $('#sq').focus(); $('#sq').setSelectionRange(p, p); };
  document.querySelectorAll('th[data-k]').forEach(h => h.onclick = () => { sortD = sortK === h.dataset.k ? -sortD : 1; sortK = h.dataset.k; table(); });
  $('#csv').onclick = () => csv(cols, r);
  if (w) $('#new').onclick = () => form();
  document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => act(b.dataset.a, b.dataset.id));
}
const actions = x => `${view === 'produccion' && x.estado !== 'Terminada' ? `<button class="btn sm" data-a="adv" data-id="${x.id}">${x.estado === 'Pendiente' ? 'Iniciar ▶' : 'Terminar y Descontar ✓'}</button> ` : ''}${view === 'inventario' ? `<button class="btn sm" data-a="mov" data-id="${x.id}">± Mov.</button> ` : ''}${view === 'despachos' && x.estado !== 'Entregado' ? `<button class="btn sm" data-a="ent" data-id="${x.id}">Entregar</button> ` : ''}<button class="btn sm ghost" data-a="edit" data-id="${x.id}">✏️</button>${U.rol === 'admin' ? ` <button class="btn sm red" data-a="del" data-id="${x.id}">🗑</button>` : ''}`;
async function act(a, id) {
  const x = rows.find(r => r.id === id);
  try {
    if (a === 'edit') return form(x);
    if (a === 'adv') {
      const res = await api(`${view}/${id}`, 'PUT', { estado: x.estado === 'Pendiente' ? 'En proceso' : 'Terminada' });
      toast(res._msg || 'Estado actualizado');
      return render();
    }
    if (a === 'ent') await api(`${view}/${id}`, 'PUT', { estado: 'Entregado' });
    if (a === 'del') { if (!confirm('¿Eliminar ' + id + '?')) return; await api(`${view}/${id}`, 'DELETE'); }
    if (a === 'mov') return movForm(x);
    toast('Operación realizada'); render();
  } catch (e) { toast(e.message, 1); }
}

function modal(title, html, onsub, customExtractor) {
  $('#mt').textContent = title;
  $('#mf').innerHTML = html + '<div class="acts"><button type="button" class="btn ghost" id="cx">Cancelar</button><button class="btn">Guardar</button></div>';
  $('#modal').classList.remove('hide');
  $('#cx').onclick = () => $('#modal').classList.add('hide');
  $('#mf').onsubmit = async e => {
    e.preventDefault();
    try {
      const payload = customExtractor ? customExtractor(e.target) : Object.fromEntries(new FormData(e.target));
      const res = await onsub(payload);
      $('#modal').classList.add('hide');
      toast((res && res._msg) ? res._msg : 'Guardado correctamente');
      render();
    } catch (x) { toast(x.message, 1); }
  };
}

async function form(x) {
  const f = SC.S[view].f.filter(c => !c.auto);

  // Formulario especializado para Recetas (BOM)
  if (view === 'recetas') {
    const inv = await api('inventario');
    const materias = inv.filter(i => i.categoria !== 'Producto terminado');
    const existingItems = (x && Array.isArray(x.insumos) && x.insumos.length)
      ? x.insumos
      : [{ itemId: materias[0]?.id || '', cantidad: '' }];

    const rowTpl = (it = {}) => `
      <div class="rec-row" style="display:grid;grid-template-columns:1fr 110px 36px;gap:6px;margin-bottom:6px;align-items:center">
        <select class="rec-item" required>
          <option value="">-- Seleccionar insumo --</option>
          ${materias.map(m => `<option value="${m.id}" ${it.itemId === m.id ? 'selected' : ''}>${esc(m.item)} (${esc(m.unidad)}) · disp: ${m.stock}</option>`).join('')}
        </select>
        <input class="rec-cant" type="number" min="0.01" step="any" placeholder="Cant." value="${esc(it.cantidad ?? '')}" required>
        <button type="button" class="btn sm red rec-del" title="Quitar">✕</button>
      </div>`;

    const html = `
      <label>Producto terminado *
        <input name="producto" placeholder="Ej: Pan tajado integral" required value="${esc(x ? x.producto : '')}">
      </label>
      <label>Rendimiento base (unidades producidas por receta) *
        <input name="rendimiento" type="number" min="1" step="1" placeholder="Ej: 100" required value="${esc(x ? x.rendimiento : 100)}">
      </label>
      <div style="display:grid;gap:4px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="muted">Insumos requeridos por cada lote base *</span>
          <button type="button" class="btn sm ghost" id="add-ing">+ Agregar insumo</button>
        </div>
        <div id="rec-list">${existingItems.map(rowTpl).join('')}</div>
      </div>
      <label>Notas de preparación
        <input name="notas" placeholder="Instrucciones o parámetros clave" value="${esc(x ? x.notas : '')}">
      </label>`;

    modal((x ? 'Editar ' : 'Nueva ') + 'Receta de Producción', html,
      b => x ? api(`recetas/${x.id}`, 'PUT', b) : api('recetas', 'POST', b),
      formEl => {
        const insumos = [...formEl.querySelectorAll('.rec-row')].map(r => ({
          itemId: r.querySelector('.rec-item').value,
          cantidad: Number(r.querySelector('.rec-cant').value)
        }));
        return {
          producto: formEl.producto.value,
          rendimiento: Number(formEl.rendimiento.value),
          insumos,
          notas: formEl.notas.value
        };
      }
    );

    const bindDel = () => $('#rec-list').querySelectorAll('.rec-del').forEach(b => b.onclick = () => {
      if ($('#rec-list').children.length > 1) b.parentElement.remove();
    });
    bindDel();
    $('#add-ing').onclick = () => { $('#rec-list').insertAdjacentHTML('beforeend', rowTpl()); bindDel(); };
    return;
  }

  // Formulario especializado para Logística / Despachos (asignación de productos terminados al camión)
  if (view === 'despachos') {
    const inv = await api('inventario');
    const terminados = inv.filter(i => i.categoria === 'Producto terminado');
    const prevCarga = (x && Array.isArray(x.carga)) ? x.carga : [];
    const existingItems = prevCarga.length
      ? prevCarga
      : [{ itemId: terminados[0]?.id || '', cantidad: '' }];

    const rowTpl = (it = {}) => `
      <div class="dsp-row" style="display:grid;grid-template-columns:1fr 110px 36px;gap:6px;margin-bottom:6px;align-items:center">
        <select class="dsp-item" required>
          <option value="">-- Producto terminado --</option>
          ${terminados.map(p => {
            const yaAsignado = prevCarga.find(c => c.itemId === p.id)?.cantidad || 0;
            const maxDisp = Math.round((p.stock + Number(yaAsignado)) * 100) / 100;
            return `<option value="${p.id}" ${it.itemId === p.id ? 'selected' : ''}>${esc(p.item)} (${esc(p.unidad)}) · disp: ${maxDisp}</option>`;
          }).join('')}
        </select>
        <input class="dsp-cant" type="number" min="1" step="any" placeholder="Cant." value="${esc(it.cantidad ?? '')}" required>
        <button type="button" class="btn sm red dsp-del" title="Quitar">✕</button>
      </div>`;

    const estados = ['Programado', 'En ruta', 'Entregado', 'Retrasado'];
    const html = `
      <label>Cliente *
        <input name="cliente" placeholder="Ej: Supermercados Éxito" required value="${esc(x ? x.cliente : '')}">
      </label>
      <label>Destino *
        <input name="destino" placeholder="Ej: Bogotá" required value="${esc(x ? x.destino : '')}">
      </label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <label>Placa vehículo *
          <input name="vehiculo" placeholder="Ej: ABC123" required value="${esc(x ? x.vehiculo : '')}">
        </label>
        <label>Conductor *
          <input name="conductor" placeholder="Nombre del conductor" required value="${esc(x ? x.conductor : '')}">
        </label>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <label>Fecha programada *
          <input name="fecha" type="date" required value="${esc(x ? x.fecha : '')}">
        </label>
        <label>Estado *
          <select name="estado" required>${estados.map(o => `<option ${x && x.estado == o ? 'selected' : ''}>${o}</option>`).join('')}</select>
        </label>
      </div>
      <div style="display:grid;gap:4px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="muted">Productos terminados asignados al vehículo *</span>
          <button type="button" class="btn sm ghost" id="add-dsp-item">+ Agregar producto</button>
        </div>
        <div id="dsp-list">${existingItems.map(rowTpl).join('')}</div>
        <span class="muted" style="font-size:.78rem">ℹ️ Al guardar, las cantidades asignadas se descontarán automáticamente del inventario.</span>
      </div>`;

    modal((x ? 'Editar Despacho · ' : 'Programar Despacho · ') + 'Logística', html,
      b => x ? api(`despachos/${x.id}`, 'PUT', b) : api('despachos', 'POST', b),
      formEl => {
        const carga = [...formEl.querySelectorAll('.dsp-row')].map(r => ({
          itemId: r.querySelector('.dsp-item').value,
          cantidad: Number(r.querySelector('.dsp-cant').value)
        }));
        return {
          cliente: formEl.cliente.value,
          destino: formEl.destino.value,
          vehiculo: formEl.vehiculo.value,
          conductor: formEl.conductor.value,
          fecha: formEl.fecha.value,
          estado: formEl.estado.value,
          carga
        };
      }
    );

    const bindDel = () => $('#dsp-list').querySelectorAll('.dsp-del').forEach(b => b.onclick = () => {
      if ($('#dsp-list').children.length > 1) b.parentElement.remove();
    });
    bindDel();
    $('#add-dsp-item').onclick = () => { $('#dsp-list').insertAdjacentHTML('beforeend', rowTpl()); bindDel(); };
    return;
  }

  // Formulario de Producción con sugerencia de recetas registradas y vista previa de consumo
  if (view === 'produccion') {
    const recetas = await api('recetas').catch(() => []);
    const baseHtml = f.map(c => `<label>${c.l}${c.req ? ' *' : ''}${c.t === 'select'
      ? `<select name="${c.k}" required>${c.o.map(o => `<option ${x && x[c.k] == o ? 'selected' : ''}>${o}</option>`).join('')}</select>`
      : `<input name="${c.k}" ${c.k === 'producto' ? 'list="recetas-dl" id="prod-inp"' : ''} ${c.k === 'cantidad' ? 'id="cant-inp"' : ''} type="${c.t || 'text'}" ${c.req ? 'required' : ''} ${c.min !== undefined ? `min="${c.min}"` : ''} step="any" value="${esc(x ? x[c.k] : '')}">`
    }</label>`).join('');

    const dl = `<datalist id="recetas-dl">${recetas.map(r => `<option value="${esc(r.producto)}">Receta ${r.id} (base ${r.rendimiento} und)</option>`).join('')}</datalist>`;
    const previewBox = `<div id="rec-preview" class="muted" style="background:var(--bg);padding:8px 10px;border-radius:8px;border:1px solid var(--bd);font-size:.82rem"></div>`;

    modal((x ? 'Editar ' : 'Nuevo registro · ') + SC.S[view].t, dl + baseHtml + previewBox, b => x ? api(`${view}/${x.id}`, 'PUT', b) : api(view, 'POST', b));

    const updatePreview = () => {
      const pName = ($('#prod-inp')?.value || '').trim().toLowerCase();
      const cant = Number($('#cant-inp')?.value || 0);
      const rec = recetas.find(r => r.producto.trim().toLowerCase() === pName);
      const box = $('#rec-preview');
      if (!box) return;
      if (!rec) {
        box.innerHTML = 'ℹ️ Sin receta asociada: al terminar no descontará insumos automáticamente.';
        return;
      }
      const factor = cant > 0 ? cant / rec.rendimiento : 0;
      const detalle = rec.insumos.map(i => `${esc(i.item)}: <b>${Math.round(i.cantidad * factor * 100) / 100} ${esc(i.unidad)}</b>`).join(' · ');
      box.innerHTML = `📋 <b>Receta ${rec.id} vinculada</b> (base ${rec.rendimiento} und)<br>Consumo estimado al terminar: ${cant > 0 ? detalle : 'ingrese cantidad'}`;
    };
    $('#prod-inp')?.addEventListener('input', updatePreview);
    $('#cant-inp')?.addEventListener('input', updatePreview);
    updatePreview();
    return;
  }

  modal((x ? 'Editar ' : 'Nuevo registro · ') + SC.S[view].t, f.map(c => `<label>${c.l}${c.req ? ' *' : ''}${c.t === 'select' ? `<select name="${c.k}" required>${c.o.map(o => `<option ${x && x[c.k] == o ? 'selected' : ''}>${o}</option>`).join('')}</select>` : `<input name="${c.k}" type="${c.t || 'text'}" ${c.req ? 'required' : ''} ${c.min !== undefined ? `min="${c.min}"` : ''} step="any" value="${esc(x ? x[c.k] : '')}">`}</label>`).join(''), b => x ? api(`${view}/${x.id}`, 'PUT', b) : api(view, 'POST', b));
}

function movForm(x) { modal(`Movimiento · ${x.item} (stock ${x.stock} ${x.unidad})`, `<label>Tipo<select name="tipo"><option>Entrada</option><option>Salida</option></select></label><label>Cantidad<input name="cant" type="number" min="1" step="any" required></label>`, b => api(`inventario/${x.id}/mov`, 'POST', b)); }
function csv(cols, r) {
  const fmt = (val) => Array.isArray(val) ? val.map(i => `${i.item} (${i.cantidad} ${i.unidad})`).join(', ') : (val ?? '');
  const t = [cols.map(c => c.l), ...r.map(x => cols.map(c => `"${String(fmt(x[c.k])).replace(/"/g, '""')}"`))].map(l => l.join(';')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + t], { type: 'text/csv' })); a.download = view + '.csv'; a.click(); toast('CSV exportado');
}

// ---- Trazabilidad y reporte ----
async function audit() {
  const a = await api('auditoria');
  $('#view').innerHTML = `<div class="card tw"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Módulo</th><th>Registro</th></tr></thead><tbody>${a.map(x => `<tr><td>${fdate(x.fecha)}</td><td>${x.usuario}</td><td>${x.rol}</td><td>${esc(x.accion)}</td><td>${x.modulo}</td><td>${x.registro}</td></tr>`).join('')}</tbody></table></div>`;
}
async function reporte() {
  const d = await api('dashboard'), al = await api('alertas'), p = await api('produccion');
  $('#view').innerHTML = `<div class="tools noprint"><button class="btn" onclick="print()">🖨 Imprimir / Guardar PDF</button></div>
  <div class="card"><h2>Reporte operativo · OptiProcess Tech</h2><p class="muted">Generado automáticamente el ${fdate(new Date())} por ${esc(U.nombre)}</p>
  <ul><li>Órdenes de producción: <b>${d.ordenes}</b> (${Object.entries(d.porEstado).map(([k, v]) => k + ': ' + v).join(', ')})</li><li>Unidades terminadas: <b>${d.unidadesTerminadas}</b></li><li>Unidades despachadas: <b>${d.unidadesDespachadas || 0}</b></li><li>Recetas configuradas: <b>${d.recetasCount || 0}</b></li><li>Calidad aprobada: <b>${d.calidadPct}%</b></li><li>Entregas a tiempo: <b>${d.entregasATiempo}%</b></li><li>Personal activo: <b>${d.activos}/${d.personal}</b></li></ul>
  <h3>Alertas (${al.length})</h3><ul>${al.map(a => `<li>${esc(a.t)}</li>`).join('') || '<li>Sin alertas</li>'}</ul>
  <h3>Órdenes de producción</h3><table><tr><th>ID</th><th>Producto</th><th>Cant.</th><th>Entrega</th><th>Estado</th><th>Stock</th></tr>${p.map(o => `<tr><td>${o.id}</td><td>${esc(o.producto)}</td><td>${o.cantidad}</td><td>${o.entrega}</td><td>${o.estado}</td><td>${esc(o.stockAplicado || '-')}</td></tr>`).join('')}</table></div>`;
}
if (T) start(); else $('#login').classList.remove('hide');
