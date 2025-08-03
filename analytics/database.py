# analytics/database.py

from dotenv import load_dotenv
import os

# ✅ Load the .env file inside the analytics folder
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))


from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# ✅ Supabase PostgreSQL credentials (set in your .env or system environment)
DB_USER = os.getenv("DB_USER", "your_supabase_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "your_supabase_password")
DB_HOST = os.getenv("DB_HOST", "db.your-project-id.supabase.co")  # From Supabase dashboard
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")  # Often 'postgres' by default in Supabase

# ✅ Supabase uses SSL, so enable it
DATABASE_URL = (
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    f"?sslmode=require"
)

# ✅ SQLAlchemy engine and session
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
