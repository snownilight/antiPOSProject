-- Insert default categories
INSERT IGNORE INTO category (id, name, sort_order) VALUES (1, '主餐', 10);
INSERT IGNORE INTO category (id, name, sort_order) VALUES (2, '小菜', 20);
INSERT IGNORE INTO category (id, name, sort_order) VALUES (3, '飲料', 30);
INSERT IGNORE INTO category (id, name, sort_order) VALUES (4, '停售分類 (測試)', 40);

-- 標記為已刪除的分類
UPDATE category SET is_deleted = TRUE WHERE id = 4;

-- Insert default products
INSERT IGNORE INTO product (id, category_id, name, description, price, image_url, status) 
VALUES (1, 1, '招牌滷肉飯', '肥瘦相間，入口即化的美味', 50.00, 'https://images.unsplash.com/photo-1596522354195-e84ae3c98731?q=80&w=600&auto=format&fit=crop', 'AVAILABLE');

INSERT IGNORE INTO product (id, category_id, name, description, price, image_url, status) 
VALUES (2, 1, '香酥排骨飯', '現炸金黃大排骨，外酥內嫩', 90.00, 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?q=80&w=600&auto=format&fit=crop', 'AVAILABLE');

INSERT IGNORE INTO product (id, category_id, name, description, price, image_url, status) 
VALUES (3, 2, '燙青菜', '每日產地直送新鮮蔬菜', 40.00, 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?q=80&w=600&auto=format&fit=crop', 'AVAILABLE');

INSERT IGNORE INTO product (id, category_id, name, description, price, image_url, status) 
VALUES (4, 2, '滷蛋', '入味香Ｑ滷鴨蛋', 15.00, 'https://images.unsplash.com/photo-1627962491560-f4b679b380f2?q=80&w=600&auto=format&fit=crop', 'SOLD_OUT');

INSERT IGNORE INTO product (id, category_id, name, description, price, image_url, status) 
VALUES (5, 3, '古早味紅茶', '微甜不膩的經典紅茶', 30.00, 'https://images.unsplash.com/photo-1576092762791-dd9e2220abd4?q=80&w=600&auto=format&fit=crop', 'AVAILABLE');

INSERT IGNORE INTO product (id, category_id, name, description, price, image_url, status, is_deleted) 
VALUES (6, 3, '隱藏版特調', '已刪除的商品測試', 99.00, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=600&auto=format&fit=crop', 'AVAILABLE', TRUE);

-- Insert default dining tables
INSERT IGNORE INTO dining_table (id, name, seats, status, token) VALUES (1, 'T1', 2, 'EMPTY', 'token-t1');
INSERT IGNORE INTO dining_table (id, name, seats, status, token) VALUES (2, 'T2', 2, 'EMPTY', 'token-t2');
INSERT IGNORE INTO dining_table (id, name, seats, status, token) VALUES (3, 'T3', 4, 'OCCUPIED', 'token-t3');
INSERT IGNORE INTO dining_table (id, name, seats, status, token) VALUES (4, 'T4', 6, 'CLEANING', 'token-t4');

-- Insert default orders
INSERT IGNORE INTO orders (id, table_id, order_no, total_amount, status) VALUES (1, 3, 'TW-260521-A1B2C', 100.00, 'PENDING');
INSERT IGNORE INTO orders (id, table_id, order_no, total_amount, status) VALUES (2, 1, 'TW-260521-D4E5F', 140.00, 'PAID');

-- Insert default order items
INSERT IGNORE INTO order_item (id, order_id, product_id, product_name, price, quantity, subtotal, note) 
VALUES (1, 1, 1, '招牌滷肉飯', 50.00, 2, 100.00, '少油');

INSERT IGNORE INTO order_item (id, order_id, product_id, product_name, price, quantity, subtotal, note) 
VALUES (2, 2, 2, '香酥排骨飯', 90.00, 1, 90.00, NULL);
INSERT IGNORE INTO order_item (id, order_id, product_id, product_name, price, quantity, subtotal, note) 
VALUES (3, 2, 1, '招牌滷肉飯', 50.00, 1, 50.00, NULL);

