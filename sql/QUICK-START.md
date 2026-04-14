# Quick Start Guide: Running SQL Scripts in pgAdmin

## 🎯 Step-by-Step Instructions

### Step 1: Open pgAdmin Query Tool
1. Open pgAdmin in your browser
2. Navigate to your database (usually "vyapaariq")
3. Right-click on the database → Select **Query Tool**
   - Or: Tools → Query Tool

### Step 2: Copy SQL Script
1. Open one of the SQL files:
   - `01-preview-truncate.sql` (truncate all data)
   - `02-add-opening-balance.sql` (add OB columns)
   - `03-view-data.sql` (view data)
   - `04-manage-data.sql` (manage data)
   - `05-complete-reset.sql` (complete reset)

2. Select all content (Ctrl+A)
3. Copy it (Ctrl+C)

### Step 3: Paste in pgAdmin
1. In the pgAdmin Query Tool, click in the SQL editor
2. Paste the script (Ctrl+V)

### Step 4: Execute
1. Click the **▶ Execute** button (or press F5)
2. Check the results panel below

---

## 📋 Quick Reference by Task

### Task: Truncate All Data (Start Fresh)
```
File: 01-preview-truncate.sql
Steps:
  1. Copy the entire file
  2. Paste in pgAdmin Query Tool
  3. Execute (F5)
  
Result: All data deleted, sequences reset to 1
```

### Task: Add Opening Balance Columns
```
File: 02-add-opening-balance.sql
Steps:
  1. Copy the entire file
  2. Paste in pgAdmin Query Tool
  3. Execute (F5)
  
Result: Two new columns added to users table
        opening_balance and pending_ob_amount
```

### Task: View All Users
```
File: 03-view-data.sql
Query: Query #1 (View all users with their opening balance)
Steps:
  1. Copy just the first query from the file
  2. Paste in pgAdmin Query Tool
  3. Execute (F5)
  
Result: List of all users
```

### Task: View All Transactions
```
File: 03-view-data.sql
Query: Query #2 (View all transactions)
Steps:
  1. Copy just the query #2 section
  2. Paste in pgAdmin Query Tool
  3. Execute (F5)
  
Result: List of recent transactions
```

### Task: Check Database Statistics
```
File: 03-view-data.sql
Query: Query #10 (Database Statistics)
Steps:
  1. Copy just the statistics query
  2. Paste in pgAdmin Query Tool
  3. Execute (F5)
  
Result: Count of records in each table
```

### Task: Find Users Without Opening Balance
```
File: 04-manage-data.sql
Query: Query #5 (Find users without opening balance set)
Steps:
  1. Copy just the query
  2. Paste in pgAdmin Query Tool
  3. Execute (F5)
  
Result: List of users who haven't set OB
```

### Task: Complete Fresh Start
```
File: 05-complete-reset.sql
Steps:
  1. Copy the entire file
  2. Paste in pgAdmin Query Tool
  3. Execute (F5)
  
Result: All tables dropped and recreated from scratch
⚠️ WARNING: This deletes EVERYTHING
```

---

## ⚡ Keyboard Shortcuts in pgAdmin

| Action | Shortcut |
|--------|----------|
| Execute Query | F5 |
| Execute Query Up to Cursor | Shift+F5 |
| Save Query | Ctrl+S |
| Clear Screen | Ctrl+L |
| Open File | Ctrl+O |
| New Query Tab | Ctrl+T |
| Close Query Tab | Ctrl+W |

---

## 🔍 Understanding Query Results

### ✅ Success Indicators
- No error messages in the "Messages" tab
- Rows affected: X (shown below results)
- Query returned successfully

### ❌ Error Messages
**Common errors and solutions:**

| Error | Cause | Solution |
|-------|-------|----------|
| `ERROR: relation "xyz" does not exist` | Table doesn't exist | Run `02-add-opening-balance.sql` first |
| `ERROR: permission denied` | Insufficient permissions | Check database user permissions |
| `ERROR: duplicate key value` | Unique constraint violated | Check for duplicate phone numbers |
| `ERROR: foreign key constraint` | Related data exists | Run script in correct order |

---

## 📊 Typical Workflow

### 1️⃣ First Time Setup
```
Step 1: Run 02-add-opening-balance.sql
        → Adds OB columns to users table
        
Step 2: Run 03-view-data.sql (Query #10)
        → Check that all tables exist
        
Step 3: You're ready to use the app!
```

### 2️⃣ Development / Testing
```
Step 1: Run 01-preview-truncate.sql
        → Clear all test data
        
Step 2: Manually test the app with fresh data
        
Step 3: Run 03-view-data.sql (Query #4)
        → Verify transactions were recorded correctly
```

### 3️⃣ Debugging Data Issues
```
Step 1: Run 03-view-data.sql (Query #10)
        → See what data exists
        
Step 2: Run 03-view-data.sql (appropriate query)
        → Examine specific issue
        
Step 3: Run 04-manage-data.sql (fix query)
        → Fix the issue
        
Step 4: Run 03-view-data.sql (verification query)
        → Confirm fix worked
```

---

## 💡 Pro Tips

### Tip 1: Save Frequently Used Queries
In pgAdmin, you can save queries for later:
- File → Save As
- Name it descriptively
- Reuse anytime

### Tip 2: Use Multiple Query Tabs
- Ctrl+T to open a new query tab
- Keep multiple queries open at once
- Compare results side by side

### Tip 3: Export Results
- Right-click results → Download as CSV
- Use for Excel analysis
- Share data with team

### Tip 4: Modify Queries
Most view queries can be modified:
```sql
-- Add WHERE to filter
WHERE phone_number = '919876543210'

-- Add LIMIT to see fewer results
LIMIT 10

-- Add ORDER BY to sort
ORDER BY created_at DESC
```

---

## 🚨 IMPORTANT: Backup Before Destructive Operations

Before running truncate or reset scripts:

```sql
-- Create a backup
pg_dump -U postgres -d vyapaariq -f backup_$(date +%Y%m%d_%H%M%S).sql

-- Or in pgAdmin:
-- Right-click database → Backup
-- Save to file
```

---

## ✅ Verification Checklist

After each operation:

1. [ ] No error messages displayed
2. [ ] "Executed in X ms" shown at bottom
3. [ ] Results match expectations
4. [ ] Run verification query
5. [ ] Data integrity is good

---

## 🔗 Useful Resources

- **pgAdmin Documentation:** https://www.pgadmin.org/docs/
- **PostgreSQL SQL Commands:** https://www.postgresql.org/docs/current/sql-syntax.html
- **SQL Cheat Sheet:** https://www.postgresqltutorial.com/

---

## 📞 Troubleshooting

### "I accidentally ran a destructive query!"
1. Don't panic - database has undo in pgAdmin
2. Edit → Undo (if available)
3. Or restore from backup

### "Query is taking too long"
1. Click the **Cancel** button (X)
2. Add `LIMIT 100` to queries
3. Filter with `WHERE` clause

### "I don't see my changes"
1. Click **Refresh** (F5) in the left panel
2. Close and reopen the Query Tool
3. Check that you executed in the right database

---

## 🎓 Learning More

Want to learn SQL?
- W3Schools SQL Tutorial: https://www.w3schools.com/sql/
- PostgreSQL Tutorial: https://www.postgresqltutorial.com/
- Khan Academy SQL Course: https://www.khanacademy.org/computing/computer-programming/sql

---

**Ready to go!** 🚀

Start with `02-add-opening-balance.sql` to add the OB columns, then use `03-view-data.sql` to verify everything is working.
