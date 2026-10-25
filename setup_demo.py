import os, sqlite3
from pathlib import Path
BASE = Path(__file__).resolve().parent
db = Path(os.getenv("SQLITE_PATH", str(BASE / "data" / "company.db")))
if not db.is_absolute():
    db = BASE / db
db.parent.mkdir(parents=True, exist_ok=True)
con = sqlite3.connect(db)
try:
    con.executescript('''
    CREATE TABLE IF NOT EXISTS employees (
      employee_id INTEGER PRIMARY KEY, name TEXT NOT NULL,
      department TEXT NOT NULL, title TEXT NOT NULL,
      location TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS leave_requests (
      request_id INTEGER PRIMARY KEY, employee_id INTEGER NOT NULL,
      leave_type TEXT NOT NULL, start_date TEXT NOT NULL,
      end_date TEXT NOT NULL, status TEXT NOT NULL);
    DELETE FROM leave_requests; DELETE FROM employees;
    INSERT INTO employees VALUES
      (1001,'Asha Rao','Engineering','Software Engineer','Pune','Active'),
      (1002,'Rahul Mehta','Engineering','Data Engineer','Bengaluru','Active'),
      (1003,'Neha Shah','Human Resources','HR Specialist','Pune','Active'),
      (1004,'Imran Khan','Finance','Financial Analyst','Mumbai','Active'),
      (1005,'Kavya Iyer','Engineering','QA Engineer','Chennai','Inactive');
    INSERT INTO leave_requests VALUES
      (501,1001,'Annual leave','2026-11-02','2026-11-04','Pending'),
      (502,1002,'Sick leave','2026-10-12','2026-10-12','Approved'),
      (503,1003,'Annual leave','2026-12-21','2026-12-24','Pending');
    ''')
    con.commit()
    print(f"Demo database created: {db}")
finally:
    con.close()
