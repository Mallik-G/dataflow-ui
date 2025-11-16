-- products.sql

DROP TABLE IF EXISTS products;

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (name, description, price, user_id) VALUES
('Laptop', 'High performance laptop', 1200.00, 1),
('Smartphone', 'Latest model smartphone', 800.00, 2),
('Headphones', 'Noise-cancelling headphones', 150.00, 1),
('Keyboard', 'Mechanical keyboard', 90.00, 3);
