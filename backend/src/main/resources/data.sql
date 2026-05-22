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

INSERT IGNORE INTO product (id, category_id, name, description, price, image_url, status) 
VALUES (10, 2, '黃金泡菜', '黃金比例醃製酸甜脆口', 25.00, 'https://images.unsplash.com/photo-1627962491560-f4b679b380f2?q=80&w=600&auto=format&fit=crop', 'AVAILABLE');

INSERT IGNORE INTO product (id, category_id, name, description, price, image_url, status) 
VALUES (11, 2, '皮蛋豆腐', '經典爽口涼拌菜', 35.00, 'https://images.unsplash.com/photo-1627962491560-f4b679b380f2?q=80&w=600&auto=format&fit=crop', 'AVAILABLE');

INSERT IGNORE INTO product (id, category_id, name, description, price, image_url, status) 
VALUES (9, 3, '珍珠奶茶', '濃郁奶香與Q彈珍珠的完美結合', 50.00, 'https://images.unsplash.com/photo-1576092762791-dd9e2220abd4?q=80&w=600&auto=format&fit=crop', 'AVAILABLE');

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

-- Insert Modifier Groups
INSERT IGNORE INTO modifier_group (id, name, min_selection, max_selection) VALUES (1, '甜度', 1, 1);
INSERT IGNORE INTO modifier_group (id, name, min_selection, max_selection) VALUES (2, '冰塊', 1, 1);
INSERT IGNORE INTO modifier_group (id, name, min_selection, max_selection) VALUES (3, '加料', 0, 3);
INSERT IGNORE INTO modifier_group (id, name, min_selection, max_selection) VALUES (4, '套餐升級', 0, 1);

-- Insert Modifier Options
-- 甜度 (Group 1)
INSERT IGNORE INTO modifier_option (id, group_id, name, price_modifier) VALUES (1, 1, '正常甜', 0.00);
INSERT IGNORE INTO modifier_option (id, group_id, name, price_modifier) VALUES (2, 1, '半糖 (5分)', 0.00);
INSERT IGNORE INTO modifier_option (id, group_id, name, price_modifier) VALUES (3, 1, '微糖 (3分)', 0.00);
INSERT IGNORE INTO modifier_option (id, group_id, name, price_modifier) VALUES (4, 1, '無糖', 0.00);

-- 冰塊 (Group 2)
INSERT IGNORE INTO modifier_option (id, group_id, name, price_modifier) VALUES (5, 2, '正常冰', 0.00);
INSERT IGNORE INTO modifier_option (id, group_id, name, price_modifier) VALUES (6, 2, '少冰', 0.00);
INSERT IGNORE INTO modifier_option (id, group_id, name, price_modifier) VALUES (7, 2, '微冰', 0.00);
INSERT IGNORE INTO modifier_option (id, group_id, name, price_modifier) VALUES (8, 2, '去冰', 0.00);

-- 加料 (Group 3)
INSERT IGNORE INTO modifier_option (id, group_id, name, price_modifier) VALUES (9, 3, '加珍珠', 10.00);
INSERT IGNORE INTO modifier_option (id, group_id, name, price_modifier) VALUES (10, 3, '加椰果', 10.00);
INSERT IGNORE INTO modifier_option (id, group_id, name, price_modifier) VALUES (11, 3, '加布丁', 15.00);

-- 套餐升級 (Group 4)
INSERT IGNORE INTO modifier_option (id, group_id, name, price_modifier) VALUES (12, 4, '升級 A 套餐 (燙青菜 + 貢丸湯)', 50.00);
INSERT IGNORE INTO modifier_option (id, group_id, name, price_modifier) VALUES (13, 4, '升級 B 套餐 (燙青菜 + 紅茶)', 60.00);
INSERT IGNORE INTO modifier_option (id, group_id, name, price_modifier) VALUES (14, 4, '升級 C 套餐 (自選小菜 + 自選飲料)', 70.00);

-- Product Modifier Group mapping
-- 古早味紅茶 (Product 5) -> 甜度 (Group 1), 冰塊 (Group 2), 加料 (Group 3)
INSERT IGNORE INTO product_modifier_group (product_id, group_id) VALUES (5, 1);
INSERT IGNORE INTO product_modifier_group (product_id, group_id) VALUES (5, 2);
INSERT IGNORE INTO product_modifier_group (product_id, group_id) VALUES (5, 3);

-- 珍珠奶茶 (Product 9) -> 甜度 (Group 1), 冰塊 (Group 2), 加料 (Group 3)
INSERT IGNORE INTO product_modifier_group (product_id, group_id) VALUES (9, 1);
INSERT IGNORE INTO product_modifier_group (product_id, group_id) VALUES (9, 2);
INSERT IGNORE INTO product_modifier_group (product_id, group_id) VALUES (9, 3);

-- 招牌滷肉飯 (Product 1) -> 套餐升級 (Group 4)
INSERT IGNORE INTO product_modifier_group (product_id, group_id) VALUES (1, 4);

-- 香酥排骨飯 (Product 2) -> 套餐升級 (Group 4)
INSERT IGNORE INTO product_modifier_group (product_id, group_id) VALUES (2, 4);

-- Option Modifier Group Mapping (Option 13 "升級 B 套餐" -> Sweetness Group 1, Ice Group 2)
INSERT IGNORE INTO option_modifier_group (option_id, group_id) VALUES (13, 1);
INSERT IGNORE INTO option_modifier_group (option_id, group_id) VALUES (13, 2);

-- Option Modifier Group Mapping (Option 14 "升級 C 套餐" -> Sweetness Group 1, Ice Group 2)
INSERT IGNORE INTO option_modifier_group (option_id, group_id) VALUES (14, 1);
INSERT IGNORE INTO option_modifier_group (option_id, group_id) VALUES (14, 2);

-- Insert Bundle Items
-- B 套餐 (Option 13) -> 燙青菜 (ID 1), 紅茶 (ID 2)
INSERT IGNORE INTO bundle_item (id, option_id, name, sort_order) VALUES (1, 13, '燙青菜', 0);
INSERT IGNORE INTO bundle_item (id, option_id, name, sort_order) VALUES (2, 13, '紅茶', 1);

-- A 套餐 (Option 12) -> 燙青菜 (ID 3), 貢丸湯 (ID 4)
INSERT IGNORE INTO bundle_item (id, option_id, name, sort_order) VALUES (3, 12, '燙青菜', 0);
INSERT IGNORE INTO bundle_item (id, option_id, name, sort_order) VALUES (4, 12, '貢丸湯', 1);

-- C 套餐 (Option 14) -> 自選小菜 (ID 5, Category 2, Allowance $20), 自選飲料 (ID 6, Category 3, Allowance $30)
INSERT IGNORE INTO bundle_item (id, option_id, name, target_category_id, base_allowance, sort_order) VALUES (5, 14, '自選小菜', 2, 20.00, 0);
INSERT IGNORE INTO bundle_item (id, option_id, name, target_category_id, base_allowance, sort_order) VALUES (6, 14, '自選飲料', 3, 30.00, 1);

-- Bundle Item Modifier Group Mapping (紅茶 (ID 2) -> 甜度 (Group 1), 冰塊 (Group 2))
INSERT IGNORE INTO bundle_item_modifier_group (bundle_item_id, group_id) VALUES (2, 1);
INSERT IGNORE INTO bundle_item_modifier_group (bundle_item_id, group_id) VALUES (2, 2);

-- Bundle Item Modifier Group Mapping (自選飲料 (ID 6) -> 甜度 (Group 1), 冰塊 (Group 2))
INSERT IGNORE INTO bundle_item_modifier_group (bundle_item_id, group_id) VALUES (6, 1);
INSERT IGNORE INTO bundle_item_modifier_group (bundle_item_id, group_id) VALUES (6, 2);
-- Insert default users
INSERT IGNORE INTO users (id, username, password, role, display_name) VALUES 
(1, 'admin', '$2a$10$ODXi7zmlFbYWI.gPa2JVX.g0RB3Hk.1NT1YHl8qNBV77AiEX4sxum', 'ADMIN', '系統管理員'),
(2, 'waiter', '$2a$10$5ikwpZlPdlwRC9NlLQZ1zOTKFJQ0Z7sWDaSOXmPgyOYH7xYgobGPS', 'WAITER', '服務生甲'),
(3, 'kitchen', '$2a$10$c61EzBJMU0Xg4AAJUI1xMu6I2BJbPJA7yvkMa33tLfqnkLzeEspeK', 'KITCHEN', '主廚阿輝');

