DROP TABLE IF EXISTS categories;

CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT
);

INSERT INTO categories (name, description) VALUES
('Electronics', 'All electronic items like laptop, phone, etc.'),
('Accessories', 'All accessories like headphones, keyboard, etc.'),
('Clothing', 'Men and Women clothing items'),
('Books', 'All kinds of books and novels');
