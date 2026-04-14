# VyapaarIQ SQL Scripts for pgAdmin

This directory contains SQL scripts for managing the VyapaarIQ database directly in pgAdmin.

## 📁 Scripts Overview

### 1. **01-preview-truncate.sql** - Truncate All Data
**Purpose:** Delete all data from all tables and reset auto-increment sequences

**When to use:**
- Start fresh with a clean database
- Testing new features
- Resetting the development environment

**What it does:**
- ✅ Empties all 11 tables
- ✅ Resets all auto-increment sequences to 1
- ✅ Maintains table structure (schema intact)

**SQL included:**
```sql
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE customers CASCADE;
-- ... (all tables)
ALTER SEQUENCE users_id_seq RESTART WITH 1;
-- ... (all sequences)
```

---

### 2. **02-add-opening-balance.sql** - Add OB Columns
**Purpose:** Add Opening Balance columns to the users table

**When to use:**
- First time setting up the database for OB functionality
- After upgrading from an older version

**What it does:**
- ✅ Adds `opening_balance NUMERIC NULL` column
- ✅ Adds `pending_ob_amount NUMERIC NULL` column
- ✅ Verifies the columns were created successfully

**Note:** Safe to run multiple times (uses `IF NOT EXISTS`)

---

### 3. **03-view-data.sql** - View Data Queries
**Purpose:** Query and inspect data in the database

**Includes:**
1. **View all users** - See all user accounts with OB status
2. **View all transactions** - See recent sales, expenses, payments
3. **View customers** - See customers with pending amounts
4. **Transaction summary** - Count and totals by user
5. **Today's transactions** - View today's activity for a specific user
6. **Calculate closing balance** - See calculated balance for each user
7. **View subscriptions** - See subscription status

**How to use:**
- Copy each query individually
- Paste into pgAdmin SQL editor
- Replace `YOUR_USER_ID` with an actual user ID if needed
- Click "Execute"

---

### 4. **04-manage-data.sql** - Management Operations
**Purpose:** Common data management operations

**Includes:**
1. Delete transactions for a user
2. Delete a complete user account
3. Clear opening balance
4. Clear pending OB update
5. Find users without OB set
6. Find users with pending OB update
7. Find orphaned records
8. Recalculate customer pending amounts
9. Database statistics

**⚠️ WARNING:** Some queries have DELETE/UPDATE statements
- They are commented out by default
- Uncomment them carefully
- Always backup before executing destructive operations

---

## 🚀 How to Use in pgAdmin

### Method 1: Direct Copy-Paste (Fastest)
1. Open pgAdmin → Select your database
2. Click **Tools** → **Query Tool**
3. Copy the SQL script content
4. Paste into the SQL editor
5. Click **Execute** (or press F5)

### Method 2: Open as File
1. In pgAdmin, right-click your database → **Query Tool**
2. Click the **Open File** button
3. Select the SQL script file
4. Click **Execute**

### Method 3: Using Command Line
```bash
# Connect to your database and run a script
psql -U postgres -d vyapaariq -f ./sql/01-preview-truncate.sql
```

---

## 📋 Common Workflows

### Workflow 1: Reset Database for Testing
```
Step 1: Run 02-add-opening-balance.sql (if columns don't exist)
Step 2: Run 01-preview-truncate.sql
✅ Database is now empty and ready for testing
```

### Workflow 2: Check Database Status
```
Step 1: Run 03-view-data.sql (query #10: Database Statistics)
Step 2: Run 03-view-data.sql (query #1: View all users with OB)
Step 3: Run 03-view-data.sql (query #4: Transaction summary)
✅ You now have a complete picture of your database
```

### Workflow 3: Fix Data Issues
```
Step 1: Run 03-view-data.sql (query #7: Orphaned records)
Step 2: Run 03-view-data.sql (query #8: Orphaned customers)
Step 3: Use 04-manage-data.sql to clean up or fix issues
✅ Data is clean and consistent
```

### Workflow 4: User Management
```
Step 1: Run 03-view-data.sql (query #5: Find users without OB)
Step 2: Run 04-manage-data.sql (query #2: Delete user if needed)
✅ User data is managed
```

---

## 📊 Database Schema (After OB Migration)

```
users table:
├── id (SERIAL PRIMARY KEY)
├── phone_number (VARCHAR)
├── language (VARCHAR)
├── created_at (TIMESTAMP)
├── opening_balance NUMERIC NULL ← NEW
└── pending_ob_amount NUMERIC NULL ← NEW

transactions table:
├── id (SERIAL PRIMARY KEY)
├── user_id (FOREIGN KEY → users)
├── type (VARCHAR: 'sale', 'expense', 'payment')
├── amount (DECIMAL)
├── category (VARCHAR)
├── customer_id (FOREIGN KEY → customers)
├── customer_name (VARCHAR)
├── is_credit (BOOLEAN)
└── created_at (TIMESTAMP)

customers table:
├── id (SERIAL PRIMARY KEY)
├── user_id (FOREIGN KEY → users)
├── name (VARCHAR)
├── pending_amount (DECIMAL)
└── created_at (TIMESTAMP)

subscriptions table:
├── id (SERIAL PRIMARY KEY)
├── user_id (FOREIGN KEY → users)
├── status (VARCHAR)
├── plan_type (VARCHAR)
├── start_date (TIMESTAMP)
├── end_date (TIMESTAMP)
└── created_at (TIMESTAMP)
```

---

## 🔍 Troubleshooting

### Error: "Relation does not exist"
**Cause:** Table hasn't been created yet
**Solution:** Create the schema first using `db/schema.sql`

### Error: "Cannot truncate due to foreign key constraint"
**Cause:** Foreign key constraints are preventing truncation
**Solution:** Script already handles this with `SET session_replication_role = replica;`

### Error: "Sequence does not exist"
**Cause:** Some sequences don't exist
**Solution:** Script skips missing sequences automatically

### Slow Query
**Cause:** Large number of records
**Solution:** Use `LIMIT` or `WHERE` clauses to filter data

---

## 💾 Backup Before Destructive Operations

```bash
# Backup the database
pg_dump -U postgres vyapaariq > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql -U postgres vyapaariq < backup_20240101_120000.sql
```

---

## ✅ Verification Checklist

After running scripts, verify:

- [ ] All tables exist: `SELECT tablename FROM pg_tables WHERE schemaname='public';`
- [ ] OB columns exist: Run `02-add-opening-balance.sql` verification query
- [ ] Data is consistent: Run `03-view-data.sql` queries
- [ ] No orphaned records: Run `04-manage-data.sql` queries #7, #8

---

## 📞 Support

For issues or questions:
1. Check pgAdmin error messages
2. Verify your database connection
3. Ensure you have proper permissions
4. Run statistics query to understand data state
