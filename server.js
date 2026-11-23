// OptiProcess Tech - Prototipo | Backend Node.js + Express | Persistencia en JSON
const express = require('express'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const app = express(); app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const FILE = path.join(__dirname, 'data', 'db.json');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

// ---------- Esquema único (lo consume también el frontend) ----------
const sel = (k, l, o, extra = {}) => ({ k, l, t: 'select', o, req: 1, ...extra });
const S = {
  produccion: { t: 'Producción', ic: '🏭', pre: 'OP', f: [
    { k: 'producto', l: 'Producto', req: 1 }, { k: 'cantidad', l: 'Cantidad', t: 'number', req: 1, min: 1 },
    sel('linea', 'Línea', ['Línea 1', 'Línea 2', 'Línea 3']), { k: 'responsable', l: 'Responsable', req: 1 },
    { k: 'entrega', l: 'Fecha de entrega', t: 'date', req: 1 }, sel('estado', 'Estado', ['Pendiente', 'En proceso', 'Terminada'], { d: 'Pendiente' }),
    { k: 'stockAplicado', l: 'Stock descontado', auto: 1 }] },
  recetas: { t: 'Recetas (BOM)', ic: '📋', pre: 'REC', f: [
    { k: 'producto', l: 'Producto terminado', req: 1 },
    { k: 'rendimiento', l: 'Rendimiento base (und)', t: 'number', req: 1, min: 1 },
    { k: 'insumos', l: 'Insumos requeridos', t: 'receta_items', req: 1 },
    { k: 'notas', l: 'Notas de preparación' }] },
  calidad: { t: 'Calidad', ic: '✅', pre: 'QC', f: [
    { k: 'lote', l: 'Lote / Orden', req: 1 }, sel('parametro', 'Parámetro', ['Temperatura °C', 'Peso g', 'pH', 'Humedad %']),
    { k: 'valor', l: 'Valor medido', t: 'number', req: 1 }, { k: 'min', l: 'Límite mínimo', t: 'number', req: 1 },
    { k: 'max', l: 'Límite máximo', t: 'number', req: 1 }, { k: 'inspector', l: 'Inspector', req: 1 }, { k: 'resultado', l: 'Resultado', auto: 1 }] },
  inventario: { t: 'Inventario', ic: '📦', pre: 'SKU', f: [
    { k: 'item', l: 'Ítem', req: 1 }, sel('categoria', 'Categoría', ['Materia prima', 'Insumo', 'Producto terminado', 'Empaque']),
    { k: 'stock', l: 'Stock actual', t: 'number', req: 1, min: 0 }, { k: 'minimo', l: 'Stock mínimo', t: 'number', req: 1, min: 0 },
    sel('unidad', 'Unidad', ['kg', 'und', 'lt', 'caja']), { k: 'ubicacion', l: 'Ubicación', req: 1 }] },
  personal: { t: 'Recursos humanos', ic: '👥', pre: 'EMP', f: [
    { k: 'nombre', l: 'Nombre completo', req: 1 }, { k: 'cargo', l: 'Cargo', req: 1 },
    sel('area', 'Área', ['Producción', 'Calidad', 'Logística', 'Administración']), sel('turno', 'Turno', ['Mañana', 'Tarde', 'Noche']),
    sel('estado', 'Estado', ['Activo', 'Vacaciones', 'Incapacidad'], { d: 'Activo' }), { k: 'ingreso', l: 'Fecha de ingreso', t: 'date', req: 1 }] },
  despachos: { t: 'Logística', ic: '🚚', pre: 'DSP', f: [
    { k: 'cliente', l: 'Cliente', req: 1 }, { k: 'destino', l: 'Destino', req: 1 }, { k: 'vehiculo', l: 'Placa vehículo', req: 1 },
    { k: 'conductor', l: 'Conductor', req: 1 }, { k: 'fecha', l: 'Fecha programada', t: 'date', req: 1 },
    { k: 'carga', l: 'Carga asignada', t: 'despacho_items', req: 1 },
    sel('estado', 'Estado', ['Programado', 'En ruta', 'Entregado', 'Retrasado'], { d: 'Programado' })] },
  feedback: { t: 'Validación de usuarios', ic: '💬', pre: 'FB', f: [
    { k: 'nombre', l: 'Nombre', req: 1 }, { k: 'rol', l: 'Rol / cargo', req: 1 },
    sel('facilidad', 'Facilidad de uso (1-5)', ['1', '2', '3', '4', '5']), sel('utilidad', 'Utilidad percibida (1-5)', ['1', '2', '3', '4', '5']),
    { k: 'comentario', l: 'Comentarios / mejoras' }] }
};

// Permisos: [lectura, escritura]
const PERM = {
  admin: m => [1, 1],
  supervisor: m => [1, m !== 'personal'],
  operario: m => [m !== 'personal', ['produccion', 'calidad', 'feedback'].includes(m)]
};
const USERS = [
  { user: 'admin', pass: hash('admin123'), rol: 'admin', nombre: 'Administrador' },
  { user: 'supervisor', pass: hash('super123'), rol: 'supervisor', nombre: 'Laura Supervisora' },
  { user: 'operario', pass: hash('oper123'), rol: 'operario', nombre: 'Carlos Operario' }
];

// ---------- Persistencia ----------
function seed() {
  const d = { seq: {}, auditoria: [], movs: [], produccion: [], recetas: [], calidad: [], inventario: [], personal: [], despachos: [], feedback: [] };
  const add = (m, o) => { d[m].push({ id: S[m].pre + '-' + String((d.seq[m] = (d.seq[m] || 0) + 1)).padStart(3, '0'), creado: new Date().toISOString(), ...o }); };

  // Inventario inicial (materias primas, insumos, empaque y productos terminados)
  [
    ['Harina de trigo', 'Materia prima', 420, 300, 'kg', 'Bodega A-1'],
    ['Azúcar', 'Materia prima', 90, 150, 'kg', 'Bodega A-2'],
    ['Levadura', 'Insumo', 25, 20, 'kg', 'Bodega B-1'],
    ['Bolsas de empaque', 'Empaque', 3000, 1000, 'und', 'Bodega C-1'],
    ['Pulpa de tomate', 'Materia prima', 60, 100, 'lt', 'Cuarto frío'],
    ['Avena en hojuelas', 'Materia prima', 180, 80, 'kg', 'Bodega A-3'],
    ['Pan tajado integral', 'Producto terminado', 700, 200, 'und', 'Despacho'],
    ['Galletas de avena', 'Producto terminado', 450, 150, 'und', 'Despacho'],
    ['Salsa de tomate', 'Producto terminado', 220, 100, 'und', 'Despacho'],
    ['Pan de hamburguesa', 'Producto terminado', 1500, 300, 'und', 'Despacho'],
    ['Galletas de chocolate', 'Producto terminado', 900, 200, 'und', 'Despacho']
  ].forEach(([item, categoria, stock, minimo, unidad, ubicacion]) => add('inventario', { item, categoria, stock, minimo, unidad, ubicacion }));

  // Recetas preconfiguradas (rendimiento base en unidades y consumo de insumos)
  [
    ['Pan tajado integral', 100, [
      { itemId: 'SKU-001', item: 'Harina de trigo', cantidad: 35, unidad: 'kg' },
      { itemId: 'SKU-003', item: 'Levadura', cantidad: 1.5, unidad: 'kg' },
      { itemId: 'SKU-004', item: 'Bolsas de empaque', cantidad: 100, unidad: 'und' }
    ], 'Amasado 20 min, horneado a 180 °C'],
    ['Galletas de avena', 100, [
      { itemId: 'SKU-001', item: 'Harina de trigo', cantidad: 15, unidad: 'kg' },
      { itemId: 'SKU-006', item: 'Avena en hojuelas', cantidad: 12, unidad: 'kg' },
      { itemId: 'SKU-002', item: 'Azúcar', cantidad: 8, unidad: 'kg' },
      { itemId: 'SKU-004', item: 'Bolsas de empaque', cantidad: 100, unidad: 'und' }
    ], 'Horneado rápido a 175 °C'],
    ['Salsa de tomate', 100, [
      { itemId: 'SKU-005', item: 'Pulpa de tomate', cantidad: 25, unidad: 'lt' },
      { itemId: 'SKU-002', item: 'Azúcar', cantidad: 4, unidad: 'kg' },
      { itemId: 'SKU-004', item: 'Bolsas de empaque', cantidad: 100, unidad: 'und' }
    ], 'Pasteurización a 85 °C']
  ].forEach(([producto, rendimiento, insumos, notas]) => add('recetas', { producto, rendimiento, insumos, notas }));

  // Órdenes de producción
  [
    ['Pan tajado integral', 1200, 'Línea 1', 'María Gómez', 3, 'En proceso', 'Pendiente'],
    ['Galletas de avena', 800, 'Línea 2', 'Pedro Ruiz', -2, 'En proceso', 'Pendiente'],
    ['Salsa de tomate', 500, 'Línea 3', 'Ana Torres', 6, 'Pendiente', 'Pendiente'],
    ['Pan de hamburguesa', 1500, 'Línea 1', 'María Gómez', -5, 'Terminada', 'Sin receta'],
    ['Mermelada fresa', 300, 'Línea 3', 'Ana Torres', 9, 'Pendiente', 'Pendiente'],
    ['Galletas de chocolate', 900, 'Línea 2', 'Pedro Ruiz', -1, 'Terminada', 'Sin receta']
  ].forEach(([producto, cantidad, linea, responsable, e, estado, stockAplicado]) =>
    add('produccion', { producto, cantidad, linea, responsable, entrega: day(e), estado, stockAplicado })
  );

  // Calidad
  [
    ['OP-004', 'Temperatura °C', 180, 170, 190, 'Sofía Mena'],
    ['OP-004', 'Peso g', 452, 450, 460, 'Sofía Mena'],
    ['OP-006', 'Humedad %', 14, 8, 12, 'Julián Díaz'],
    ['OP-001', 'pH', 5.4, 5, 6, 'Sofía Mena'],
    ['OP-002', 'Temperatura °C', 205, 170, 190, 'Julián Díaz']
  ].forEach(([lote, parametro, valor, min, max, inspector]) =>
    add('calidad', { lote, parametro, valor, min, max, inspector, resultado: valor >= min && valor <= max ? 'Aprobado' : 'Rechazado' })
  );

  // Personal
  [
    ['María Gómez', 'Jefe de producción', 'Producción', 'Mañana', 'Activo'],
    ['Pedro Ruiz', 'Supervisor de planta', 'Producción', 'Tarde', 'Activo'],
    ['Sofía Mena', 'Coordinadora de calidad', 'Calidad', 'Mañana', 'Activo'],
    ['Julián Díaz', 'Analista de calidad', 'Calidad', 'Tarde', 'Vacaciones'],
    ['Andrea Pardo', 'Coordinadora logística', 'Logística', 'Mañana', 'Activo']
  ].forEach(([nombre, cargo, area, turno, estado], i) =>
    add('personal', { nombre, cargo, area, turno, estado, ingreso: day(-300 - i * 120) })
  );

  // Despachos con productos terminados ya asignados
  [
    ['Supermercados Éxito', 'Bogotá', 'ABC123', 'Luis Pérez', 0, [
      { itemId: 'SKU-007', item: 'Pan tajado integral', cantidad: 150, unidad: 'und' },
      { itemId: 'SKU-008', item: 'Galletas de avena', cantidad: 80, unidad: 'und' }
    ], 'En ruta'],
    ['Tiendas D1', 'Medellín', 'XYZ789', 'Iván Rojas', 2, [
      { itemId: 'SKU-010', item: 'Pan de hamburguesa', cantidad: 300, unidad: 'und' }
    ], 'Programado'],
    ['Olímpica', 'Barranquilla', 'KLM456', 'Hugo León', -2, [
      { itemId: 'SKU-009', item: 'Salsa de tomate', cantidad: 60, unidad: 'und' }
    ], 'Retrasado'],
    ['Alkosto', 'Cali', 'QWE321', 'Jorge Ríos', -3, [
      { itemId: 'SKU-011', item: 'Galletas de chocolate', cantidad: 200, unidad: 'und' }
    ], 'Entregado']
  ].forEach(([cliente, destino, vehiculo, conductor, f, carga, estado]) =>
    add('despachos', { cliente, destino, vehiculo, conductor, fecha: day(f), carga, estado })
  );

  return d;
}

let db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE)) : seed();
if (!db.recetas) db.recetas = [];
const save = () => fs.writeFileSync(FILE, JSON.stringify(db, null, 1));
save();
const log = (u, accion, mod, id) => {
  db.auditoria.unshift({ fecha: new Date().toISOString(), usuario: u.user, rol: u.rol, accion, modulo: mod, registro: id });
  db.auditoria = db.auditoria.slice(0, 300);
};

// ---------- Lógica de Automatización de Stock por Receta (Producción) ----------
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

function buscarReceta(producto) {
  const norm = String(producto || '').trim().toLowerCase();
  return db.recetas.find(r => String(r.producto || '').trim().toLowerCase() === norm);
}

function aplicarProduccionConReceta(orden, u) {
  const receta = buscarReceta(orden.producto);
  if (!receta) {
    orden.stockAplicado = 'Sin receta';
    return { aplicado: false, mensaje: `Orden ${orden.id} terminada (sin receta vinculada para "${orden.producto}")` };
  }

  const factor = Number(orden.cantidad) / Number(receta.rendimiento);
  const requerimientos = [];

  for (const ing of receta.insumos) {
    const invItem = db.inventario.find(i => i.id === ing.itemId) ||
      db.inventario.find(i => i.item.trim().toLowerCase() === String(ing.item || '').trim().toLowerCase());
    if (!invItem) {
      throw new Error(`Insumo "${ing.item}" de la receta ${receta.id} no existe en inventario.`);
    }
    const necesario = round2(Number(ing.cantidad) * factor);
    if (invItem.stock < necesario) {
      throw new Error(`Stock insuficiente de "${invItem.item}": requiere ${necesario} ${invItem.unidad}, disponible ${invItem.stock} ${invItem.unidad}.`);
    }
    requerimientos.push({ invItem, necesario });
  }

  for (const { invItem, necesario } of requerimientos) {
    invItem.stock = round2(invItem.stock - necesario);
    log(u, `Consumo automático (${orden.id}): -${necesario} ${invItem.unidad}`, 'inventario', invItem.id);
  }

  const prodNorm = String(orden.producto || '').trim().toLowerCase();
  let prodTerminado = db.inventario.find(i => i.item.trim().toLowerCase() === prodNorm);
  if (prodTerminado) {
    prodTerminado.stock = round2(prodTerminado.stock + Number(orden.cantidad));
    log(u, `Ingreso producción (${orden.id}): +${orden.cantidad} ${prodTerminado.unidad}`, 'inventario', prodTerminado.id);
  } else {
    db.seq.inventario = (db.seq.inventario || 0) + 1;
    prodTerminado = {
      id: 'SKU-' + String(db.seq.inventario).padStart(3, '0'),
      creado: new Date().toISOString(),
      item: orden.producto.trim(),
      categoria: 'Producto terminado',
      stock: Number(orden.cantidad),
      minimo: Math.max(10, Math.round(Number(orden.cantidad) * 0.2)),
      unidad: 'und',
      ubicacion: 'Despacho'
    };
    db.inventario.push(prodTerminado);
    log(u, `Alta automática producto terminado (${orden.id}): +${orden.cantidad} und`, 'inventario', prodTerminado.id);
  }

  orden.stockAplicado = `Aplicado (${receta.id})`;
  return {
    aplicado: true,
    mensaje: `Stock actualizado con receta ${receta.id}: insumos descontados y +${orden.cantidad} und de "${orden.producto}"`
  };
}

// ---------- Lógica de Descuento/Ajuste de Stock en Logística (Despachos) ----------
function aplicarCargaDespacho(cargaNueva, cargaAnterior, despachoId, vehiculo, u) {
  const prevMap = new Map();
  for (const it of (cargaAnterior || [])) {
    prevMap.set(it.itemId, round2((prevMap.get(it.itemId) || 0) + Number(it.cantidad)));
  }
  const newMap = new Map();
  for (const it of (cargaNueva || [])) {
    newMap.set(it.itemId, round2((newMap.get(it.itemId) || 0) + Number(it.cantidad)));
  }

  const allIds = new Set([...prevMap.keys(), ...newMap.keys()]);
  const deltas = [];

  // 1. Verificar disponibilidad atómica antes de tocar stock
  for (const itemId of allIds) {
    const prevQty = prevMap.get(itemId) || 0;
    const newQty = newMap.get(itemId) || 0;
    const delta = round2(newQty - prevQty); // > 0 descuenta más; < 0 devuelve al inventario
    if (delta === 0) continue;

    const invItem = db.inventario.find(i => i.id === itemId);
    if (!invItem) {
      throw new Error(`El producto (${itemId}) ya no existe en el inventario.`);
    }
    if (delta > 0 && invItem.stock < delta) {
      throw new Error(`Stock insuficiente de "${invItem.item}" para cargar: requiere ${delta} ${invItem.unidad} adicionales, disponible ${invItem.stock} ${invItem.unidad}.`);
    }
    deltas.push({ invItem, delta });
  }

  // 2. Aplicar ajustes en inventario y registrar trazabilidad
  for (const { invItem, delta } of deltas) {
    invItem.stock = round2(invItem.stock - delta);
    if (delta > 0) {
      log(u, `Asignado a despacho ${despachoId} (${vehiculo}): -${delta} ${invItem.unidad}`, 'inventario', invItem.id);
    } else {
      log(u, `Ajuste/devolución despacho ${despachoId} (${vehiculo}): +${Math.abs(delta)} ${invItem.unidad}`, 'inventario', invItem.id);
    }
  }

  const resumen = (cargaNueva || []).map(c => `${c.cantidad} ${c.unidad} de ${c.item}`).join(', ');
  return deltas.length
    ? `Carga asignada (${vehiculo}) y descontada del inventario: ${resumen}`
    : null;
}

// ---------- Auth ----------
const sess = {};
app.post('/api/login', (req, res) => {
  const u = USERS.find(x => x.user === req.body.user && x.pass === hash(req.body.pass || ''));
  if (!u) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  const t = crypto.randomBytes(16).toString('hex'); sess[t] = u; log(u, 'Inicio de sesión', 'sistema', '-'); save();
  res.json({ token: t, user: { user: u.user, rol: u.rol, nombre: u.nombre } });
});
app.use('/api', (req, res, next) => {
  const u = sess[(req.headers.authorization || '').slice(7)];
  if (!u) return res.status(401).json({ error: 'Sesión no válida' }); req.u = u; next();
});

// ---------- Validación ----------
function validar(m, b, parcial, currentId = null) {
  const out = {};
  for (const f of S[m].f) {
    if (f.auto) continue;
    let v = b[f.k]; if (v === undefined && parcial) continue;
    if ((v === undefined || v === '') && f.d) v = f.d;
    if (f.req && (v === undefined || String(v).trim() === '')) throw new Error(`"${f.l}" es obligatorio`);

    if (f.t === 'receta_items') {
      if (!Array.isArray(v) || v.length === 0) throw new Error('Debe agregar al menos un insumo a la receta');
      const limpios = [];
      const vistos = new Set();
      for (const it of v) {
        const inv = db.inventario.find(x => x.id === it.itemId);
        if (!inv) throw new Error(`Insumo inválido en la receta (${it.itemId || 'sin ID'})`);
        const cant = Number(it.cantidad);
        if (!(cant > 0)) throw new Error(`La cantidad de "${inv.item}" debe ser mayor a 0`);
        if (vistos.has(inv.id)) throw new Error(`El insumo "${inv.item}" está duplicado en la receta`);
        vistos.add(inv.id);
        limpios.push({ itemId: inv.id, item: inv.item, cantidad: cant, unidad: inv.unidad });
      }
      out[f.k] = limpios;
      continue;
    }

    if (f.t === 'despacho_items') {
      if (!Array.isArray(v) || v.length === 0) throw new Error('Debe asignar al menos un producto terminado al vehículo');
      const limpios = [];
      const vistos = new Set();
      for (const it of v) {
        const inv = db.inventario.find(x => x.id === it.itemId);
        if (!inv) throw new Error(`Producto inválido en el despacho (${it.itemId || 'sin ID'})`);
        if (inv.categoria !== 'Producto terminado') throw new Error(`Solo se pueden despachar productos terminados ("${inv.item}" es ${inv.categoria})`);
        const cant = Number(it.cantidad);
        if (!(cant > 0)) throw new Error(`La cantidad a despachar de "${inv.item}" debe ser mayor a 0`);
        if (vistos.has(inv.id)) throw new Error(`El producto "${inv.item}" está duplicado en la carga`);
        vistos.add(inv.id);
        limpios.push({ itemId: inv.id, item: inv.item, cantidad: cant, unidad: inv.unidad });
      }
      out[f.k] = limpios;
      continue;
    }

    if (f.t === 'number' && v !== undefined && v !== '') {
      v = Number(v);
      if (isNaN(v)) throw new Error(`"${f.l}" debe ser numérico`);
      if (f.min !== undefined && v < f.min) throw new Error(`"${f.l}" debe ser ≥ ${f.min}`);
    }
    if (f.t === 'select' && v && !f.o.includes(String(v))) throw new Error(`Valor inválido en "${f.l}"`);
    out[f.k] = typeof v === 'string' ? v.trim() : v;
  }

  if (m === 'calidad' && (out.min ?? 0) > (out.max ?? 0)) throw new Error('El mínimo no puede superar al máximo');
  if (m === 'recetas' && out.producto) {
    const dup = db.recetas.find(r => r.producto.trim().toLowerCase() === out.producto.toLowerCase() && r.id !== currentId);
    if (dup) throw new Error(`Ya existe una receta para "${out.producto}" (${dup.id})`);
  }
  return out;
}

const autoCalc = (m, o) => {
  if (m === 'calidad') o.resultado = o.valor >= o.min && o.valor <= o.max ? 'Aprobado' : 'Rechazado';
  if (m === 'produccion' && !o.stockAplicado) o.stockAplicado = 'Pendiente';
  return o;
};

// ---------- Rutas especiales ----------
app.get('/api/schema', (q, r) => r.json({ S, perm: Object.fromEntries(Object.keys(S).map(m => [m, PERM[q.u.rol](m)])) }));
app.get('/api/auditoria', (q, r) => r.json(db.auditoria));
function alertas() {
  const hoy = day(0), a = [];
  db.inventario.filter(i => i.stock <= i.minimo).forEach(i => a.push({ n: 'critica', m: 'inventario', t: `Stock bajo: ${i.item} (${i.stock}/${i.minimo} ${i.unidad})` }));
  db.produccion.filter(o => o.estado !== 'Terminada' && o.entrega < hoy).forEach(o => a.push({ n: 'critica', m: 'produccion', t: `Orden ${o.id} vencida (${o.producto})` }));
  db.calidad.filter(c => c.resultado === 'Rechazado').forEach(c => a.push({ n: 'media', m: 'calidad', t: `Inspección ${c.id} rechazada: ${c.parametro} = ${c.valor}` }));
  db.despachos.filter(d => d.estado === 'Retrasado').forEach(d => a.push({ n: 'media', m: 'despachos', t: `Despacho ${d.id} retrasado hacia ${d.destino}` }));
  return a;
}
app.get('/api/alertas', (q, r) => r.json(alertas()));
app.get('/api/dashboard', (q, r) => {
  const c = (arr, k) => arr.reduce((a, x) => (a[x[k]] = (a[x[k]] || 0) + 1, a), {});
  const ap = db.calidad.filter(x => x.resultado === 'Aprobado').length;
  const unidadesDespachadas = db.despachos.reduce((sum, d) => sum + (Array.isArray(d.carga) ? d.carga.reduce((s, it) => s + Number(it.cantidad || 0), 0) : 0), 0);
  r.json({
    ordenes: db.produccion.length, porEstado: c(db.produccion, 'estado'), unidadesTerminadas: db.produccion.filter(o => o.estado === 'Terminada').reduce((s, o) => s + o.cantidad, 0),
    calidadPct: db.calidad.length ? Math.round(ap * 100 / db.calidad.length) : 0, stockBajo: db.inventario.filter(i => i.stock <= i.minimo).length,
    despachos: c(db.despachos, 'estado'), activos: db.personal.filter(p => p.estado === 'Activo').length, personal: db.personal.length, alertas: alertas().length,
    stock: db.inventario.map(i => ({ l: i.item, v: i.stock, min: i.minimo })), entregasATiempo: db.despachos.length ? Math.round(db.despachos.filter(d => d.estado !== 'Retrasado').length * 100 / db.despachos.length) : 0,
    recetasCount: db.recetas.length, unidadesDespachadas
  });
});
app.post('/api/reset', (q, r) => { if (q.u.rol !== 'admin') return r.status(403).json({ error: 'Solo el administrador' }); db = seed(); log(q.u, 'Restablecer datos demo', 'sistema', '-'); save(); r.json({ ok: 1 }); });
app.post('/api/inventario/:id/mov', (q, r) => {
  if (!PERM[q.u.rol]('inventario')[1]) return r.status(403).json({ error: 'Sin permiso' });
  const i = db.inventario.find(x => x.id === q.params.id), cant = Number(q.body.cant), tipo = q.body.tipo;
  if (!i) return r.status(404).json({ error: 'No existe' });
  if (!(cant > 0) || !['Entrada', 'Salida'].includes(tipo)) return r.status(400).json({ error: 'Cantidad o tipo inválido' });
  if (tipo === 'Salida' && cant > i.stock) return r.status(400).json({ error: `Stock insuficiente (disponible: ${i.stock})` });
  i.stock = round2(i.stock + (tipo === 'Entrada' ? cant : -cant)); log(q.u, `${tipo} de ${cant} ${i.unidad}`, 'inventario', i.id); save(); r.json(i);
});

// ---------- CRUD genérico ----------
const chk = (m, rw) => (q, r, n) => {
  if (!S[q.params.m]) return r.status(404).json({ error: 'Módulo inexistente' });
  const p = PERM[q.u.rol](q.params.m); if (!p[rw]) return r.status(403).json({ error: 'No tiene permiso para esta acción' }); n();
};
app.get('/api/:m', chk(0, 0), (q, r) => r.json(db[q.params.m]));
app.post('/api/:m', chk(0, 1), (q, r) => {
  const m = q.params.m; try {
    const o = autoCalc(m, validar(m, q.body));
    const nextSeq = (db.seq[m] || 0) + 1;
    const rec = { id: S[m].pre + '-' + String(nextSeq).padStart(3, '0'), creado: new Date().toISOString(), ...o };

    let infoStock = null;
    if (m === 'produccion' && rec.estado === 'Terminada') {
      infoStock = aplicarProduccionConReceta(rec, q.u).mensaje;
    }
    if (m === 'despachos' && Array.isArray(rec.carga)) {
      infoStock = aplicarCargaDespacho(rec.carga, [], rec.id, rec.vehiculo, q.u);
    }

    db.seq[m] = nextSeq;
    db[m].push(rec); log(q.u, 'Crear', m, rec.id); save();
    r.status(201).json(infoStock ? { ...rec, _msg: infoStock } : rec);
  } catch (e) { r.status(400).json({ error: e.message }); }
});
app.put('/api/:m/:id', chk(0, 1), (q, r) => {
  const m = q.params.m, rec = db[m].find(x => x.id === q.params.id); if (!rec) return r.status(404).json({ error: 'No existe' });
  try {
    const updated = autoCalc(m, { ...rec, ...validar(m, q.body, true, rec.id) });
    let infoStock = null;

    if (m === 'produccion') {
      const yaAplicado = String(rec.stockAplicado || '').startsWith('Aplicado');
      if (rec.estado !== 'Terminada' && updated.estado === 'Terminada' && !yaAplicado) {
        infoStock = aplicarProduccionConReceta(updated, q.u).mensaje;
      } else if (yaAplicado && (updated.producto !== rec.producto || Number(updated.cantidad) !== Number(rec.cantidad))) {
        throw new Error('No se puede cambiar producto o cantidad de una orden cuyo stock ya fue descontado.');
      }
    }

    if (m === 'despachos' && Array.isArray(updated.carga)) {
      if (rec.estado === 'Entregado' && JSON.stringify(rec.carga || []) !== JSON.stringify(updated.carga)) {
        throw new Error('No se puede modificar la carga de un despacho ya entregado.');
      }
      infoStock = aplicarCargaDespacho(updated.carga, rec.carga || [], rec.id, updated.vehiculo, q.u);
    }

    Object.assign(rec, updated);
    log(q.u, 'Editar', m, rec.id); save();
    r.json(infoStock ? { ...rec, _msg: infoStock } : rec);
  } catch (e) { r.status(400).json({ error: e.message }); }
});
app.delete('/api/:m/:id', chk(0, 1), (q, r) => {
  if (q.u.rol !== 'admin') return r.status(403).json({ error: 'Solo el administrador puede eliminar' });
  const m = q.params.m, rec = db[m].find(x => x.id === q.params.id);
  if (!rec) return r.status(404).json({ error: 'No existe' });

  // Si se elimina un despacho que aún no ha sido entregado, reintegrar su carga al inventario
  if (m === 'despachos' && rec.estado !== 'Entregado' && Array.isArray(rec.carga) && rec.carga.length) {
    aplicarCargaDespacho([], rec.carga, rec.id, rec.vehiculo, q.u);
  }

  db[m] = db[m].filter(x => x.id !== q.params.id);
  log(q.u, 'Eliminar', m, q.params.id); save(); r.json({ ok: 1 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n OptiProcess Tech listo -> http://localhost:${PORT}\n`));
