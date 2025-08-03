# analytics/main.py

from fastapi import FastAPI, HTTPException, Query
from analytics.database import engine
import pandas as pd
import re
from sqlalchemy import text
from analytics.analysis import run_clustering
from fastapi import UploadFile, File, Form
from typing import List
from analytics.schema import ClusteringRequest, ClusteringResponse, UploadResponse
import os
from fastapi.middleware.cors import CORSMiddleware
from typing import List
app = FastAPI(
    title="Clustering Analysis Module",
    description="Performs unsupervised clustering (KMeans, DBSCAN, etc.) and returns results with optional LLM summary",
    version="1.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev only; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from fastapi import UploadFile, File, HTTPException, Query
from analytics.schema import UploadResponse
from analytics.database import engine
import pandas as pd
import os

# @app.post("/upload", response_model=UploadResponse)
# async def upload_table(file: UploadFile = File(...), table_name: str = Query(...)):
#     # ✅ Step 1: Validate extension
#     ext = os.path.splitext(file.filename)[1].lower()
#     if ext not in {".csv", ".xlsx", ".xls"}:
#         raise HTTPException(status_code=400, detail="Only CSV or Excel files are allowed.")

#     # ✅ Step 2: Read file into DataFrame
#     df = pd.read_csv(file.file) if ext == ".csv" else pd.read_excel(file.file)

#     # ✅ Force numeric where possible (fix mixed types)
#     df = df.apply(pd.to_numeric, errors='ignore')
    
#     # ✅ Step 3: Write DataFrame to Supabase (PostgreSQL)
#     try:
#         df.to_sql(table_name, engine, schema='public', if_exists='replace', index=False)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to write to database: {str(e)}")

#     # ✅ Step 4: Logging (optional but helpful for debugging)
#     print(f"✅ Uploaded table '{table_name}' with shape {df.shape}")
#     print(f"📊 Columns: {df.dtypes.to_dict()}")

#     # ✅ Step 5: Extract numeric columns
#     numeric_cols = df.select_dtypes(include=["int8", "float8", "int4", "float32", "decimal"]).columns.tolist()

#     return UploadResponse(table_name=table_name, available_columns=numeric_cols)

# @app.post("/upload", response_model=UploadResponse)
# async def upload_table(file: UploadFile = File(...), table_name: str = Query(...)):
#     # ✅ Validate table name
#     if df.empty:
#         raise HTTPException(status_code=400, detail="Uploaded file is empty or unreadable.")

#     if len(df.columns) == 0:
#         raise HTTPException(status_code=400, detail="No columns found in the uploaded file.")

#     if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", table_name):
#         raise HTTPException(status_code=400, detail="Invalid table name.")
    
#     ext = os.path.splitext(file.filename)[1].lower()
#     if ext not in {".csv", ".xlsx", ".xls"}:
#         raise HTTPException(status_code=400, detail="Only CSV or Excel files are allowed.")

#     # Read file
#     df = pd.read_csv(file.file) if ext == ".csv" else pd.read_excel(file.file)

#     # Optional: clean column names
#     df.columns = [col.strip().replace(" ", "_") for col in df.columns]

#     # Save to Supabase
#     try:
#         df.to_sql(table_name, engine, schema='public', if_exists='replace', index=False)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to write to database: {str(e)}")
#     print(f"✅ Uploaded table '{table_name}' with shape {df.shape}")

#     # ✅ Return ALL columns (not just numeric)
#     all_columns = [{"name": col, "type": str(df[col].dtype)} for col in df.columns]
#     print(f"📊 Returning ALL columns: {all_columns}")

#     return UploadResponse(table_name=table_name, available_columns=all_columns)

@app.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...), table_name: str = Query(...)):
    # ✅ Validate filename extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {".csv", ".xlsx", ".xls"}:
        raise HTTPException(status_code=400, detail="Only CSV or Excel files are allowed.")

    # ✅ Validate table name
    if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", table_name):
        raise HTTPException(status_code=400, detail="Invalid table name format.")

    table_name = table_name.lower()
    # ✅ Load file into DataFrame
    try:
        df = pd.read_csv(file.file) if ext == ".csv" else pd.read_excel(file.file)
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to read uploaded file.")

    if df.empty or len(df.columns) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty or has no columns.")

    # # ✅ Clean column names
    # df.columns = [col.strip().replace(" ", "_").lower() for col in df.columns]

    # ✅ Save to Supabase (PostgreSQL)
    try:
        df.to_sql(table_name, engine, schema='public', if_exists='replace', index=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database insert failed: {str(e)}")

    available_columns = [{"name": col.lower(), "type": str(df[col].dtype)} for col in df.columns]
    return UploadResponse(table_name=table_name, available_columns=available_columns)


@app.post("/analyze", response_model=ClusteringResponse)
async def analyze(request: ClusteringRequest):
    try:
        # 1. Run the clustering logic
        result_data, chart_data = run_clustering(request)

        # # 2. (Optional) Generate summary using LLM
        # summary = generate_summary(result_data)

        # 3. Return all outputs
        return {
            "data": result_data,
            "chart_data": chart_data,
            # "llm_observations": summary
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/available_tables", response_model=List[str])
def list_uploaded_tables():
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_type = 'BASE TABLE';
            """))
            return [row[0] for row in result.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch table list: {str(e)}")

from analytics.schema import ColumnInfo  # Add this import

@app.get("/available_columns", response_model=List[ColumnInfo])
def get_all_columns(table_name: str = Query(...)):
    try:
        with engine.connect() as conn:
            result = conn.execute(text(f'SELECT * FROM "{table_name}" LIMIT 1'))
            df = pd.DataFrame(result.fetchall(), columns=result.keys())

        columns = [
            ColumnInfo(name=col, type=str(df[col].dtype))
            for col in df.columns
            if str(df[col].dtype) in {"int64", "float64", "int32", "float32"}
        ]
        return columns

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch columns: {str(e)}")

# from fastapi import FastAPI

# app = FastAPI()

# @app.get("/")
# def root():
#     return {"status": "App running"}
