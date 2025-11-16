-- orders.sql

DROP TABLE IF EXISTS orders;

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    product_id INT,
    quantity INT DEFAULT 1,
    total_price DECIMAL(10,2),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO orders (user_id, product_id, quantity, total_price) VALUES
(1, 1, 1, 1200.00),
(2, 2, 2, 1600.00),
(1, 3, 1, 150.00),
(3, 4, 3, 270.00);
