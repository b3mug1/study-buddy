#!/usr/bin/env python3
"""Run database migrations on a target PostgreSQL database (e.g. Neon, Supabase, local)."""

import os
import sys
from pathlib import Path
import psycopg


def main() -> None:
    db_url = os.environ.get("DATABASE_URL")
    if len(sys.argv) > 1:
        db_url = sys.argv[1]

    if not db_url:
        print("Usage: python scripts/migrate.py <DATABASE_URL>")
        print("   or: set DATABASE_URL=... and run python scripts/migrate.py")
        sys.exit(1)

    # Ensure migrations directory exists
    repo_root = Path(__file__).resolve().parent.parent
    migrations_dir = repo_root / "migrations"
    migration_files = sorted(migrations_dir.glob("*.sql"))

    if not migration_files:
        print(f"No SQL migration files found in {migrations_dir}")
        sys.exit(1)

    print(f"--> Connecting to database...")
    # Mask password for display
    safe_url = db_url
    if "@" in safe_url and ":" in safe_url:
        user_part, rest = safe_url.split("@", 1)
        proto_user = user_part.split("://", 1)
        if len(proto_user) == 2 and ":" in proto_user[1]:
            user = proto_user[1].split(":", 1)[0]
            safe_url = f"{proto_user[0]}://{user}:***@{rest}"

    print(f"Target: {safe_url}")

    with psycopg.connect(db_url, autocommit=True) as conn:
        print("Connected successfully!\n")
        with conn.cursor() as cur:
            for sql_file in migration_files:
                print(f"--> Applying {sql_file.name}...")
                content = sql_file.read_text(encoding="utf-8")
                cur.execute(content)
                print(f"    [OK] {sql_file.name} applied successfully.")

    print("\nAll database migrations applied successfully!")


if __name__ == "__main__":
    main()

