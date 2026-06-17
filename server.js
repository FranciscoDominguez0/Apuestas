const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Ruta principal para no tener que escribir /Apuestas.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/Apuestas.html');
});

// Configuración de la base de datos
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'Administrador',
    password: process.env.DB_PASSWORD || 'Panama26',
    database: process.env.DB_NAME || 'sistema_apuestas'
};

let pool;

async function initDB() {
    pool = mysql.createPool(dbConfig);
    console.log("Conexión configurada hacia MySQL.");
    
    // Migrar contraseñas planas a bcrypt si existen (Seguridad)
    try {
        const [usuarios] = await pool.query("SELECT id, password FROM usuarios");
        for (let u of usuarios) {
            if (!u.password.startsWith('$2b$')) {
                const hash = await bcrypt.hash(u.password, 10);
                await pool.query("UPDATE usuarios SET password = ? WHERE id = ?", [hash, u.id]);
            }
        }
        const [admins] = await pool.query("SELECT id, clave FROM administradores");
        for (let a of admins) {
            if (!a.clave.startsWith('$2b$')) {
                const hash = await bcrypt.hash(a.clave, 10);
                await pool.query("UPDATE administradores SET clave = ? WHERE id = ?", [hash, a.id]);
            }
        }
        console.log("Verificación de seguridad de contraseñas completada.");
    } catch (e) {
        console.error("Error al verificar/migrar contraseñas:", e.message);
    }
}
initDB();

// =======================
// SEGURIDAD ANTI-FUERZA BRUTA
// =======================

const loginAttempts = {};

function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (loginAttempts[ip] && loginAttempts[ip].lockUntil > now) {
        const remaining = Math.ceil((loginAttempts[ip].lockUntil - now) / 1000 / 60);
        return res.json({ success: false, message: `Demasiados intentos fallidos. Por seguridad, tu IP ha sido bloqueada. Intenta de nuevo en ${remaining} minutos.` });
    }
    next();
}

function recordFailedLogin(ip) {
    const now = Date.now();
    if (!loginAttempts[ip] || loginAttempts[ip].lockUntil < now) {
        loginAttempts[ip] = { count: 1, lockUntil: 0 };
    } else {
        loginAttempts[ip].count += 1;
        if (loginAttempts[ip].count >= 4) {
            loginAttempts[ip].lockUntil = now + 3 * 60 * 1000; // Bloqueo de 3 minutos
        }
    }
}

function resetLogin(ip) {
    if (loginAttempts[ip]) {
        loginAttempts[ip].count = 0;
        loginAttempts[ip].lockUntil = 0;
    }
}

// =======================
// RUTAS DE AUTENTICACIÓN
// =======================

app.post('/api/auth/register', async (req, res) => {
    try {
        const { nombre, cedula, password } = req.body;
        if (!nombre || !cedula || !password) return res.json({ success: false, message: 'Faltan datos' });

        const [rows] = await pool.query("SELECT id FROM usuarios WHERE cedula = ?", [cedula]);
        if (rows.length > 0) return res.json({ success: false, message: 'Cédula ya registrada' });

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query("INSERT INTO usuarios (nombre, cedula, password) VALUES (?, ?, ?)", [nombre, cedula, hashedPassword]);
        res.json({ success: true, user: { nombre, cedula } });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/auth/login', rateLimiter, async (req, res) => {
    try {
        const ip = req.ip || req.connection.remoteAddress;
        const { cedula, password } = req.body;
        const [rows] = await pool.query("SELECT nombre, cedula, password FROM usuarios WHERE cedula = ?", [cedula]);
        
        if (rows.length > 0) {
            const valid = await bcrypt.compare(password, rows[0].password);
            if (valid) {
                resetLogin(ip);
                return res.json({ success: true, user: { nombre: rows[0].nombre, cedula: rows[0].cedula } });
            }
        }
        recordFailedLogin(ip);
        res.json({ success: false, message: 'Credenciales incorrectas' });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/auth/admin', rateLimiter, async (req, res) => {
    try {
        const ip = req.ip || req.connection.remoteAddress;
        const { usuario, clave } = req.body;
        const [rows] = await pool.query("SELECT usuario, clave FROM administradores WHERE usuario = ?", [usuario]);
        
        if (rows.length > 0) {
            const valid = await bcrypt.compare(clave, rows[0].clave);
            if (valid) {
                resetLogin(ip);
                return res.json({ success: true, admin: rows[0].usuario });
            }
        }
        recordFailedLogin(ip);
        res.json({ success: false, message: 'Credenciales de administrador incorrectas' });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

// =======================
// RUTAS DE PARTIDOS
// =======================

app.get('/api/partidos', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM partidos ORDER BY id ASC");
        res.json({ success: true, partidos: rows });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/partidos/create', async (req, res) => {
    try {
        const { eq1, eq2 } = req.body;
        await pool.query("INSERT INTO partidos (eq1, eq2, estado) VALUES (?, ?, 'ABIERTO')", [eq1, eq2]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/partidos/start', async (req, res) => {
    try {
        await pool.query("UPDATE partidos SET estado = 'EN_JUEGO' WHERE id = ? AND estado = 'ABIERTO'", [req.body.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/partidos/finish', async (req, res) => {
    try {
        const { id, ganador } = req.body;
        const [pendientes] = await pool.query("SELECT id FROM tickets WHERE partido_id = ? AND aprobado = FALSE", [id]);
        if (pendientes.length > 0) return res.json({ success: false, message: 'Hay tickets pendientes de aprobación' });

        await pool.query("UPDATE partidos SET estado = 'FINALIZADO', ganador = ? WHERE id = ?", [ganador, id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

// =======================
// RUTAS DE TICKETS
// =======================

app.get('/api/tickets', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT t.*, u.nombre 
            FROM tickets t
            JOIN usuarios u ON t.usuario_cedula = u.cedula
            ORDER BY t.id ASC
        `);
        const formatted = rows.map(t => ({
            id: t.id,
            partidoId: t.partido_id,
            nombre: t.nombre,
            cedula: t.usuario_cedula,
            prediccion: t.prediccion,
            monto: parseFloat(t.monto),
            fecha: t.fecha,
            aprobado: Boolean(t.aprobado),
            reclamado: Boolean(t.reclamado),
            pagado: Boolean(t.pagado),
            telefonoContacto: t.telefono_contacto
        }));
        res.json({ success: true, tickets: formatted });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/tickets/create', async (req, res) => {
    try {
        const { partidoId, cedula, prediccion, monto } = req.body;
        const [result] = await pool.query(
            "INSERT INTO tickets (partido_id, usuario_cedula, prediccion, monto) VALUES (?, ?, ?, ?)",
            [partidoId, cedula, prediccion, monto]
        );
        res.json({ success: true, id: result.insertId });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/tickets/approve', async (req, res) => {
    try {
        await pool.query("UPDATE tickets SET aprobado = TRUE WHERE id = ?", [req.body.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/tickets/reject', async (req, res) => {
    try {
        await pool.query("DELETE FROM tickets WHERE id = ?", [req.body.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/tickets/claim', async (req, res) => {
    try {
        await pool.query("UPDATE tickets SET reclamado = TRUE, telefono_contacto = ? WHERE id = ?", [req.body.telefono, req.body.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/tickets/pay', async (req, res) => {
    try {
        await pool.query("UPDATE tickets SET pagado = TRUE WHERE id = ?", [req.body.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

// Arrancar el servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor de apuestas corriendo en http://localhost:${PORT}`);
});
