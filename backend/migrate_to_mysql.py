import sqlite3
import pymysql
import os

MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", 3306))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "root")
MYSQL_DB = os.getenv("MYSQL_DB", "studypilot_db")

def migrate_sqlite_to_mysql():
    sqlite_path = os.path.join(os.path.dirname(__file__), "studypilot.db")
    if not os.path.exists(sqlite_path):
        print(f"SQLite file not found at {sqlite_path}")
        return

    s_conn = sqlite3.connect(sqlite_path)
    s_conn.row_factory = sqlite3.Row
    s_cur = s_conn.cursor()

    # Ensure MySQL database exists
    m_conn_init = pymysql.connect(host=MYSQL_HOST, port=MYSQL_PORT, user=MYSQL_USER, password=MYSQL_PASSWORD)
    with m_conn_init.cursor() as cur:
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{MYSQL_DB}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    m_conn_init.close()

    m_conn = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
        cursorclass=pymysql.cursors.DictCursor
    )
    m_cur = m_conn.cursor()

    # Disable foreign keys to recreate clean schema
    m_cur.execute("SET FOREIGN_KEY_CHECKS = 0;")

    schema_path = os.path.join(os.path.dirname(__file__), "schema_mysql.sql")
    if os.path.exists(schema_path):
        with open(schema_path, "r", encoding="utf-8") as f:
            statements = [s.strip() for s in f.read().split(";") if s.strip()]
            for stmt in statements:
                try:
                    m_cur.execute(stmt)
                except Exception as e:
                    print("Schema statement warning:", e)
        m_conn.commit()

    tables_order = [
        "users",
        "tokens",
        "password_resets",
        "user_plans",
        "exams",
        "syllabus_uploads",
        "syllabus_units",
        "subjects",
        "chapters",
        "topics",
        "topic_progress",
        "study_plans",
        "study_plan_tasks",
        "question_bank",
        "mock_tests",
        "mock_test_topics",
        "test_attempts",
        "test_attempt_answers",
        "revision_sessions",
        "revision_session_topics",
        "monthly_assessments",
        "topic_learning_content",
        "topic_interactions",
        "topic_chats",
        "topic_practice_attempts",
        "recovery_plans",
        "previous_year_papers",
        "pyp_questions",
        "topic_trend_analysis",
        "predicted_papers"
    ]

    total_migrated = 0
    for table in tables_order:
        try:
            s_cur.execute(f"SELECT * FROM `{table}`")
            s_rows = s_cur.fetchall()
            if not s_rows:
                continue

            m_cur.execute(f"TRUNCATE TABLE `{table}`;")

            col_names = [col[0] for col in s_cur.description]
            cols_str = ", ".join([f"`{c}`" for c in col_names])
            placeholders = ", ".join(["%s"] * len(col_names))
            insert_query = f"INSERT INTO `{table}` ({cols_str}) VALUES ({placeholders})"

            data_tuples = []
            for r in s_rows:
                row_vals = []
                for c in col_names:
                    val = r[c]
                    row_vals.append(val)
                data_tuples.append(tuple(row_vals))

            m_cur.executemany(insert_query, data_tuples)
            m_conn.commit()
            print(f"  [OK] Migrated {len(data_tuples):>3} rows into `{table}`")
            total_migrated += len(data_tuples)
        except Exception as e:
            print(f"  [Error] Table {table}: {e}")

    m_cur.execute("SET FOREIGN_KEY_CHECKS = 1;")
    m_conn.commit()
    m_conn.close()
    s_conn.close()
    print(f"\n=======================================================")
    print(f"SUCCESS: {total_migrated} rows across {len(tables_order)} tables migrated to MySQL database '{MYSQL_DB}'.")
    print(f"=======================================================")

if __name__ == "__main__":
    migrate_sqlite_to_mysql()
