import os, re, sqlite3
from pathlib import Path
from mcp.server.fastmcp import FastMCP
mcp = FastMCP("ReadOnlySQL")
BASE = Path(__file__).resolve().parents[1]
DB = Path(os.getenv("SQLITE_PATH", str(BASE / "data" / "company.db")))
if not DB.is_absolute():
    DB = BASE / DB
ALLOWED = {"employees", "leave_requests"}

def connect_ro():
    if not DB.exists():
        raise FileNotFoundError("Demo DB missing; run python setup_demo.py")
    conn = sqlite3.connect(DB.resolve().as_uri() + "?mode=ro", uri=True, timeout=5)
    conn.row_factory = sqlite3.Row
    denied = {
        sqlite3.SQLITE_INSERT, sqlite3.SQLITE_UPDATE, sqlite3.SQLITE_DELETE,
        sqlite3.SQLITE_CREATE_INDEX, sqlite3.SQLITE_CREATE_TABLE,
        sqlite3.SQLITE_CREATE_TRIGGER, sqlite3.SQLITE_CREATE_VIEW,
        sqlite3.SQLITE_DROP_INDEX, sqlite3.SQLITE_DROP_TABLE,
        sqlite3.SQLITE_DROP_TRIGGER, sqlite3.SQLITE_DROP_VIEW,
        sqlite3.SQLITE_ALTER_TABLE, sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH,
        sqlite3.SQLITE_PRAGMA,
    }
    def authorize(action, table, column, database, trigger):
        if action in denied:
            return sqlite3.SQLITE_DENY
        if action == sqlite3.SQLITE_READ and table.lower() not in ALLOWED:
            return sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK
    conn.set_authorizer(authorize)
    return conn

@mcp.tool()
def get_database_schema() -> dict:
    """Return approved database schema to help plan natural-language SQL."""
    return {"tables": {
        "employees": ["employee_id INTEGER", "name TEXT", "department TEXT",
                      "title TEXT", "location TEXT", "status TEXT"],
        "leave_requests": ["request_id INTEGER", "employee_id INTEGER",
                           "leave_type TEXT", "start_date TEXT", "end_date TEXT",
                           "status TEXT"]},
        "relationships": ["leave_requests.employee_id references employees.employee_id"]}

@mcp.tool()
def query_database(sql: str) -> dict:
    """Execute one SQLite SELECT/CTE on employees or leave_requests; max 100 rows.

    Use get_database_schema first. A final semicolon is accepted. Match text filters
    case-insensitively with COLLATE NOCASE. Never write or query unapproved tables.
    """
    sql = sql.strip()
    if not sql or len(sql) > 4000:
        raise ValueError("SQL is empty or too long")
    # A single statement terminator is normal LLM output, not a second statement.
    sql = sql.removesuffix(";").rstrip()
    if any(x in sql for x in (";", "--", "/*", "*/")):
        raise ValueError("Semicolons between statements and SQL comments are forbidden")
    if not re.match(r"(?is)^(SELECT|WITH)\b", sql):
        raise ValueError("Only SELECT/CTE queries are allowed")
    if re.search(r"(?i)\b(sqlite_master|sqlite_schema|pragma|attach|detach|insert|update|delete|drop|alter|create|replace)\b", sql):
        raise ValueError("Disallowed SQL keyword")
    if not re.search(r"(?i)\bFROM\b", sql):
        raise ValueError("Use only approved tables: employees, leave_requests")
    conn = connect_ro()
    try:
        # SQLite resolves quoted identifiers, aliases and CTEs. Its authorizer,
        # rather than a FROM/JOIN regex, enforces the underlying table allowlist.
        try:
            cur = conn.execute(sql)
        except sqlite3.DatabaseError as exc:
            raise ValueError(f"SQLite query rejected (use only approved tables employees, leave_requests): {exc}") from exc
        cols = [c[0] for c in cur.description or []]
        rows = cur.fetchmany(101)
        return {"columns": cols, "rows": [dict(r) for r in rows[:100]],
                "row_count": min(len(rows), 100), "truncated": len(rows) > 100}
    finally:
        conn.close()

if __name__ == "__main__":
    mcp.run(transport="stdio")
