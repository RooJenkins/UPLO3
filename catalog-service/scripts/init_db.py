#!/usr/bin/env python3
"""Initialize database with schema"""

import os
import sys
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("Error: DATABASE_URL environment variable not set")
    print("Please create a .env file with DATABASE_URL=postgresql://...")
    sys.exit(1)


def init_database():
    """Initialize database with schema from schema.sql"""
    print("Initializing UPLO-DB database...")

    # Read schema file
    schema_path = os.path.join(
        os.path.dirname(__file__),
        '../backend/database/schema.sql'
    )

    with open(schema_path, 'r') as f:
        schema_sql = f.read()

    # Connect and execute
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cur = conn.cursor()

        print("Executing schema...")
        cur.execute(schema_sql)

        print("✅ Database initialized successfully!")

        # Show stats
        cur.execute("SELECT COUNT(*) FROM brands")
        brand_count = cur.fetchone()[0]
        print(f"   - {brand_count} brands created")

        cur.execute("SELECT COUNT(*) FROM stores")
        store_count = cur.fetchone()[0]
        print(f"   - {store_count} stores created")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        sys.exit(1)


if __name__ == "__main__":
    init_database()
