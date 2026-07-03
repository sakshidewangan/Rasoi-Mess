-- =============================================================
-- RASOI MANAGEMENT SYSTEM - PostgreSQL Schema
-- =============================================================

-- Users & Roles (OWNER or STUDENT)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('OWNER', 'STUDENT')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings (key-value store for global config)
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Delivery Zones
CREATE TABLE IF NOT EXISTS delivery_zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    route_order INT DEFAULT 0
);

-- Students / Customers
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    mobile VARCHAR(15) UNIQUE NOT NULL,
    guardian_mobile VARCHAR(15),
    college VARCHAR(100),
    hostel VARCHAR(100),
    room_number VARCHAR(20),
    google_map_link TEXT,
    delivery_zone_id INT REFERENCES delivery_zones(id) ON DELETE SET NULL,
    credit_limit NUMERIC(10,2) DEFAULT 1000.00,
    current_balance NUMERIC(10,2) DEFAULT 0.00,  -- positive = student owes money
    veg_status VARCHAR(10) DEFAULT 'VEG' CHECK (veg_status IN ('VEG', 'NON_VEG')),
    status VARCHAR(10) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BLOCKED', 'INACTIVE')),
    tiffin_box_count INT DEFAULT 0,
    academic_session VARCHAR(20),
    joining_date DATE NOT NULL,
    leaving_date DATE,
    remarks TEXT,
    photo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student Default Meal Schedule
-- Tracks which meals a student normally gets and at what price
CREATE TABLE IF NOT EXISTS student_default_meals (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    has_breakfast BOOLEAN DEFAULT TRUE,
    has_lunch BOOLEAN DEFAULT TRUE,
    has_dinner BOOLEAN DEFAULT TRUE,
    custom_breakfast_price NUMERIC(10,2),  -- NULL = use global settings price
    custom_lunch_price NUMERIC(10,2),
    custom_dinner_price NUMERIC(10,2),
    effective_from DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily Meal Calendar (THE SINGLE SOURCE OF TRUTH)
-- 3 rows per student per day (one per meal type)
-- Each row stores the price at time of creation (price snapshot)
CREATE TABLE IF NOT EXISTS daily_meal_calendar (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    meal_date DATE NOT NULL,
    meal_type VARCHAR(10) NOT NULL CHECK (meal_type IN ('BREAKFAST', 'LUNCH', 'DINNER')),
    price NUMERIC(10,2) NOT NULL,          -- price snapshot at time of record creation
    status VARCHAR(15) DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'SERVED', 'SKIPPED', 'CANCELLED', 'WASTED', 'ISSUE')),
    tiffin_box_returned BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,       -- true after month is closed
    note TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, meal_date, meal_type)
);

-- Leaves & Pauses (convenience wrapper for batch overrides)
CREATE TABLE IF NOT EXISTS leaves_and_pauses (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    skip_breakfast BOOLEAN DEFAULT FALSE,
    skip_lunch BOOLEAN DEFAULT FALSE,
    skip_dinner BOOLEAN DEFAULT FALSE,
    reason VARCHAR(255),
    created_by VARCHAR(10) DEFAULT 'OWNER' CHECK (created_by IN ('OWNER', 'STUDENT')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Meal Skip Audit Log (permanent, tamper-proof proof of every skipped meal)
CREATE TABLE IF NOT EXISTS meal_skip_log (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    meal_date DATE NOT NULL,
    meal_type VARCHAR(10) NOT NULL CHECK (meal_type IN ('BREAKFAST', 'LUNCH', 'DINNER')),
    initiated_by VARCHAR(15) NOT NULL CHECK (initiated_by IN ('STUDENT_SELF', 'OWNER', 'SYSTEM_LEAVE')),
    initiated_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    leave_id INT REFERENCES leaves_and_pauses(id) ON DELETE SET NULL,
    reason TEXT,
    price_deducted NUMERIC(10,2) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments Collected
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_mode VARCHAR(15) NOT NULL CHECK (payment_mode IN ('CASH', 'UPI', 'BANK_TRANSFER')),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    expense_date DATE NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monthly Bill Snapshots (frozen at month close)
CREATE TABLE IF NOT EXISTS monthly_bill_snapshots (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    billing_month VARCHAR(7) NOT NULL,     -- YYYY-MM
    breakfast_taken INT DEFAULT 0,
    lunch_taken INT DEFAULT 0,
    dinner_taken INT DEFAULT 0,
    breakfast_skipped INT DEFAULT 0,
    lunch_skipped INT DEFAULT 0,
    dinner_skipped INT DEFAULT 0,
    total_bill_amount NUMERIC(10,2) DEFAULT 0.00,
    total_paid NUMERIC(10,2) DEFAULT 0.00,
    opening_balance NUMERIC(10,2) DEFAULT 0.00,
    closing_balance NUMERIC(10,2) DEFAULT 0.00,
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, billing_month)
);

-- =============================================================
-- DEFAULT SEED DATA
-- =============================================================

-- Default settings
INSERT INTO settings (key, value) VALUES
    ('rasoi_name', 'My Rasoi'),
    ('breakfast_price', '40'),
    ('lunch_price', '70'),
    ('dinner_price', '70'),
    ('receipt_prefix', 'RCP'),
    ('currency', 'INR'),
    ('financial_year_start', '04')  -- April start
ON CONFLICT (key) DO NOTHING;

-- Default owner account (password: admin123 - CHANGE IN PRODUCTION)
-- bcrypt hash of 'admin123'
INSERT INTO users (name, phone, password_hash, role) VALUES
    ('Rasoi Owner', '9999999999', '$2b$10$muPCtXOFkAejuB.XqAPUUe9B/YkZChonxrFn4gFfFH458YgTUXume', 'OWNER')
ON CONFLICT (phone) DO NOTHING;
