-- Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('owner','director','gerente','supervisor','vendedor') DEFAULT 'vendedor',
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Crear tabla de leads
CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  telefono VARCHAR(60),
  modelo VARCHAR(120),
  fuente VARCHAR(60),
  formaPago VARCHAR(60),
  notas TEXT,
  estado VARCHAR(40) DEFAULT 'nuevo',
  assigned_to INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lead_user FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- Usuarios demo
INSERT IGNORE INTO users (name, email, password, role) VALUES
('María Dueña','maria@alluma.com','admin123','owner'),
('Carlos Director','carlos@alluma.com','director123','director'),
('Ana Gerente','ana@alluma.com','gerente123','gerente');
