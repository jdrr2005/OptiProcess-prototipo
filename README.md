# OptiProcess Tech – Prototipo funcional (alta resolución)

Plataforma web que centraliza **producción, calidad, inventarios, recursos humanos y logística** (Entrega 1 – Grupo B05, Sub-grupo 6).

## Tecnologías
| Capa | Tecnología |
|---|---|
| Motor / runtime | **Node.js ≥ 18** (probado en v22) |
| Backend | JavaScript + **Express 4** (única librería externa) |
| Frontend | HTML5 + CSS3 + JavaScript puro (SPA, sin frameworks; gráficos en CSS) |
| Persistencia | Archivo JSON (`data/db.json`, se autogenera con datos demo) |
| Autenticación | Token de sesión en memoria + contraseñas con hash SHA-256 |

## Ejecución en Visual Studio Code
1. Instalar Node.js LTS (https://nodejs.org) y abrir esta carpeta en VS Code (`Archivo > Abrir carpeta`).
2. Abrir terminal (`Ctrl + ñ`) y ejecutar:
   ```bash
   npm install
   npm start
   ```
3. Abrir **http://localhost:3000**. (Alternativa: F5 usando la configuración `.vscode/launch.json`; `npm run dev` recarga al guardar.)

## Usuarios demo
| Usuario | Contraseña | Rol |
|---|---|---|
| admin | admin123 | Acceso total, elimina y restablece datos |
| supervisor | super123 | Gestiona todo excepto RR.HH. (solo lectura) y eliminar |
| operario | oper123 | Registra producción y calidad; sin acceso a RR.HH. |

## 24 funcionalidades implementadas
| # | Funcionalidad | Módulo |
|---|---|---|
| 1 | Inicio de sesión con usuario y contraseña | Seguridad |
| 2 | Roles y permisos (admin / supervisor / operario) | Seguridad |
| 3 | Dashboard con KPIs en tiempo real | Indicadores |
| 4 | Gráficos de producción, despachos e inventario | Indicadores |
| 5 | Actualización automática cada 10 s ("en vivo") | Indicadores |
| 6 | CRUD de órdenes de producción con código automático (OP-001) | Producción |
| 7 | Flujo de estados Pendiente → En proceso → Terminada con descuento automático de stock por receta | Producción |
| + | Gestión de Recetas (BOM) por producto con cálculo proporcional de insumos | Recetas |
| 8 | Inspecciones de calidad con resultado Aprobado/Rechazado automático | Calidad |
| 9 | CRUD de inventario | Inventarios |
| 10 | Movimientos de entrada/salida con bloqueo de stock negativo | Inventarios |
| 11 | Alertas de stock bajo (resaltado en rojo) | Inventarios |
| 12 | Gestión de personal (cargo, área, turno, estado) | RR.HH. |
| 13 | Programación de despachos con asignación de productos terminados y descuento automático de stock | Logística |
| 14 | Seguimiento de estado de despacho (botón Entregar) | Logística |
| 15 | Validaciones automáticas (obligatorios, numéricos, rangos, listas) en cliente y servidor | Transversal |
| 16 | Centro de notificaciones 🔔 (órdenes vencidas, calidad rechazada, retrasos, stock) | Transversal |
| 17 | Búsqueda instantánea en cada tabla | Transversal |
| 18 | Ordenamiento por columna | Transversal |
| 19 | Exportación a CSV (compatible con Excel) | Transversal |
| 20 | Reporte operativo automático imprimible / PDF | Reportes |
| 21 | Trazabilidad: historial de quién hizo qué y cuándo | Auditoría |
| 22 | Modo oscuro | Experiencia |
| 23 | Diseño responsive (celular/tablet/PC) con menú hamburguesa | Experiencia |
| 24 | Formulario de feedback (facilidad/utilidad 1-5) para las sesiones de validación | Validación |
| + | Restablecer datos demo (API `POST /api/reset`, admin) | Soporte |

## Baja vs. alta resolución
- **Baja resolución:** wireframes en papel/Figma/Canva de las pantallas: Login, Dashboard, Tabla + formulario, Reporte.
- **Alta resolución:** esta aplicación funcional.

## Estructura
```
server.js          API REST, validaciones, permisos, alertas, auditoría
public/index.html  Estructura de la SPA
public/styles.css  Estilos, modo oscuro, responsive
public/app.js      Lógica del cliente
data/db.json       Base de datos (se crea al iniciar)
```
Para reiniciar los datos, detenga el servidor y borre `data/db.json`.

## Guía rápida para la validación con usuarios
Pida a cada persona: (1) ingresar como operario, (2) crear una orden de producción, (3) registrar una inspección fuera de rango, (4) revisar las alertas, (5) llenar el módulo **Validación de usuarios**. Los resultados quedan en la tabla y se exportan a CSV.
