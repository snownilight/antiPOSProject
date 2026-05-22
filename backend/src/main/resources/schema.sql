-- Category Table
CREATE TABLE IF NOT EXISTS category (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sort_order INT DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Product Table
CREATE TABLE IF NOT EXISTS product (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url VARCHAR(1000),
    status VARCHAR(50) DEFAULT 'AVAILABLE', -- AVAILABLE, SOLD_OUT, HIDDEN
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_category FOREIGN KEY (category_id) REFERENCES category(id)
);

-- Dining Table
CREATE TABLE IF NOT EXISTS dining_table (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    seats INT DEFAULT 2,
    status VARCHAR(50) DEFAULT 'EMPTY', -- EMPTY, OCCUPIED, CLEANING
    token VARCHAR(255) UNIQUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    table_id BIGINT NOT NULL,
    order_no VARCHAR(50) NOT NULL UNIQUE,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PREPARING, READY, PAID, CANCELLED
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_table FOREIGN KEY (table_id) REFERENCES dining_table(id)
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_item (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    subtotal DECIMAL(10, 2) NOT NULL,
    note VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES product(id)
);

-- For compatibility with existing databases, dynamically add token column and populate it if needed
ALTER TABLE dining_table ADD COLUMN IF NOT EXISTS token VARCHAR(255) UNIQUE;
UPDATE dining_table SET token = UUID() WHERE token IS NULL;

-- Modifier Group Table
CREATE TABLE IF NOT EXISTS modifier_group (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    min_selection INT DEFAULT 0,
    max_selection INT DEFAULT 1,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Modifier Option Table
CREATE TABLE IF NOT EXISTS modifier_option (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    group_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    price_modifier DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_option_group FOREIGN KEY (group_id) REFERENCES modifier_group(id)
);

-- Product Modifier Group (Many-to-Many Relation)
CREATE TABLE IF NOT EXISTS product_modifier_group (
    product_id BIGINT NOT NULL,
    group_id BIGINT NOT NULL,
    PRIMARY KEY (product_id, group_id),
    CONSTRAINT fk_pm_product FOREIGN KEY (product_id) REFERENCES product(id),
    CONSTRAINT fk_pm_group FOREIGN KEY (group_id) REFERENCES modifier_group(id)
);

-- Option Modifier Group (Many-to-Many Relation for nested customization)
CREATE TABLE IF NOT EXISTS option_modifier_group (
    option_id BIGINT NOT NULL,
    group_id BIGINT NOT NULL,
    PRIMARY KEY (option_id, group_id),
    CONSTRAINT fk_omg_option FOREIGN KEY (option_id) REFERENCES modifier_option(id),
    CONSTRAINT fk_omg_group FOREIGN KEY (group_id) REFERENCES modifier_group(id)
);

-- Order Item Option Table
CREATE TABLE IF NOT EXISTS order_item_option (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_item_id BIGINT NOT NULL,
    option_id BIGINT NOT NULL,
    option_name VARCHAR(255) NOT NULL,
    price_modifier DECIMAL(10, 2) NOT NULL,
    parent_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_oio_item FOREIGN KEY (order_item_id) REFERENCES order_item(id) ON DELETE CASCADE,
    CONSTRAINT fk_oio_option FOREIGN KEY (option_id) REFERENCES modifier_option(id),
    CONSTRAINT fk_oio_parent FOREIGN KEY (parent_id) REFERENCES order_item_option(id) ON DELETE CASCADE
);

-- Dynamically add parent_id column if it doesn't exist for existing databases
ALTER TABLE order_item_option ADD COLUMN IF NOT EXISTS parent_id BIGINT NULL;


