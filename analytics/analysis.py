# analytics/analysis.py

import pandas as pd
from sqlalchemy import text
from analytics.database import engine
from sklearn.preprocessing import StandardScaler, MinMaxScaler, MaxAbsScaler, RobustScaler
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering, MeanShift
import matplotlib.pyplot as plt
import seaborn as sns
import io
import base64

from analytics.schema import ClusteringRequest, ClusterSummary, ChartData

def run_clustering(request: ClusteringRequest):
    # --- Step 1: Read actual user data from PostgreSQL ---
    table = request.table_name
    cols = request.columns  # This is now a list of selected feature names

    print("🟡 Step 1: Preparing to query DB...")

    try:
        quoted_cols = ', '.join([f'"{col}"' for col in cols])
        query_str = f'SELECT {quoted_cols} FROM "{table}"'
        print(f"🔍 Running query: {query_str}")
        query = text(query_str)
        with engine.connect() as connection:
            df = pd.read_sql(query, connection)
    except Exception as e:
        print(f"❌ Failed to run query: {e}")
        raise

    print("🟢 Step 2: DB query successful, rows:", len(df))
    
    X = df[cols].copy()  # Keep original column names

    # --- Step 2: Normalize if needed ---
    norm = request.params.normalize
    if norm == "standard":
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
    elif norm == "minmax":
        scaler = MinMaxScaler()
        X_scaled = scaler.fit_transform(X)
    elif norm == "maxabs":
        scaler = MaxAbsScaler()
        X_scaled = scaler.fit_transform(X)
    elif norm == "robust":
        scaler = RobustScaler()
        X_scaled = scaler.fit_transform(X)
    else:  # "none"
        X_scaled = X.values

    # --- Step 3: Apply selected algorithm ---
    algo = request.params.algorithm
    model = None

    if algo == "kmeans":
        model = KMeans(n_clusters=request.params.num_clusters, random_state=42)
    elif algo == "dbscan":
        model = DBSCAN(eps=request.params.eps or 0.5, min_samples=request.params.min_samples or 5)
    elif algo == "hierarchical":
        model = AgglomerativeClustering(n_clusters=request.params.num_clusters)
    elif algo == "meanshift":
        model = MeanShift()
    else:
        raise ValueError("Unsupported algorithm")

    labels = model.fit_predict(X_scaled)
    df["cluster"] = labels

    # --- Step 4: Prepare summaries ---
    summaries = []
    for cluster_id in sorted(df["cluster"].unique()):
        cluster_data = df[df["cluster"] == cluster_id]
        summary = ClusterSummary(
            cluster_id=int(cluster_id),
            count=len(cluster_data),
            centroid=dict(cluster_data[cols].mean())  # Only centroids for selected features
        )
        summaries.append(summary)

    # --- Step 5: Chart (only 2D plot if 2 features selected)
    scatter_data = {}
    image_base64 = ""

    if len(cols) >= 2:
        fig, ax = plt.subplots()
        sns.scatterplot(x=cols[0], y=cols[1], hue="cluster", data=df, palette="tab10", ax=ax)

        # Optional: show centroids
        if hasattr(model, "cluster_centers_"):
            centers = model.cluster_centers_
            ax.scatter(centers[:, 0], centers[:, 1], s=100, c="black", marker="x", label="Centroids")
            ax.legend()

        ax.set_title(f"{algo.upper()} Clustering")
        buf = io.BytesIO()
        plt.savefig(buf, format="png")
        buf.seek(0)
        image_base64 = base64.b64encode(buf.read()).decode("utf-8")
        plt.close()

        scatter_data = {
            "x": X[cols[0]].tolist(),
            "y": X[cols[1]].tolist(),
            "labels": df["cluster"].tolist()
        }

    chart = ChartData(
        image_base64=image_base64,
        scatter_data=scatter_data
    )

    return summaries, chart

