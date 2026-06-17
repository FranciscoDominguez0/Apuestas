-- Base de Datos para el Sistema de Apuestas
-- Ejecutar este script en MySQL Workbench

CREATE DATABASE IF NOT EXISTS sistema_apuestas;
USE sistema_apuestas;

-- 1. Tabla de Usuarios (Jugadores)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    cedula VARCHAR(20) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Partidos
CREATE TABLE IF NOT EXISTS partidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    eq1 VARCHAR(50) NOT NULL,
    eq2 VARCHAR(50) NOT NULL,
    estado ENUM('ABIERTO', 'EN_JUEGO', 'FINALIZADO') DEFAULT 'ABIERTO',
    ganador ENUM('EQ1', 'EMP', 'EQ2') NULL DEFAULT NULL
);

-- 3. Tabla de Tickets (Apuestas)
CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    partido_id INT NOT NULL,
    usuario_cedula VARCHAR(20) NOT NULL,
    prediccion ENUM('EQ1', 'EMP', 'EQ2') NOT NULL,
    monto DECIMAL(10, 2) NOT NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    aprobado BOOLEAN DEFAULT FALSE,
    reclamado BOOLEAN DEFAULT FALSE,
    pagado BOOLEAN DEFAULT FALSE,
    telefono_contacto VARCHAR(20) DEFAULT NULL,
    
    FOREIGN KEY (partido_id) REFERENCES partidos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_cedula) REFERENCES usuarios(cedula) ON DELETE CASCADE
);

-- 4. Tabla de Administradores
CREATE TABLE IF NOT EXISTS administradores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    clave VARCHAR(255) NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar administrador por defecto
INSERT INTO administradores (usuario, clave) VALUES ('admin', 'admin123');
