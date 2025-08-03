# This file defines the input and output data models for your FastAPI clustering module using Pydantic, which validates and documents your API automatically.

# The file is divided into 4 logical blocks:
# Enumeration of supported clustering algorithms
# Input model (ClusteringRequest) and parameters
# Output sub-models for chart and cluster details
# Final output model (ClusteringResponse) for returning data to the client

from pydantic import BaseModel, Field, model_validator
from typing import Dict, List, Optional, Any
from enum import Enum
from typing import List, Optional


class ColumnInfo(BaseModel):
    name: str
    type: str

# --- ENUM FOR ALGORITHM TYPES ---
class AlgorithmType(str, Enum):
    kmeans = "kmeans"
    dbscan = "dbscan"
    hierarchical = "hierarchical"
    meanshift = "meanshift"  # ✅ Added

# --- ENUM FOR NORMALIZATION TYPES ---
class NormalizationMethod(str, Enum):
    none = "none"
    standard = "standard"
    minmax = "minmax"
    maxabs = "maxabs"
    robust = "robust"

class UploadResponse(BaseModel):
    table_name: str
    available_columns: List[Dict[str, str]]  # each col will be {name: str, type: str}

# --- CLUSTERING PARAMETERS MODEL ---
class ClusteringParams(BaseModel):
    algorithm: AlgorithmType = Field(..., description="Clustering algorithm to use")
    num_clusters: Optional[int] = Field(3, ge=2, description="Number of clusters (used for KMeans and Hierarchical)")
    normalize: NormalizationMethod = Field(NormalizationMethod.standard, description="Normalization method to apply to input data. Choose from: 'none', 'standard', 'minmax', 'maxabs', 'robust'.")
    eps: Optional[float] = Field(0.5, description="DBSCAN epsilon value (distance threshold)")
    min_samples: Optional[int] = Field(5, description="DBSCAN min_samples (minimum neighbors)")
    
# --- INPUT MODEL ---
class ClusteringRequest(BaseModel):
    table_name: str = Field(..., description="Name of the database table to query (e.g., 'user_activity')")
    columns: List[str] = Field(..., description="Mapping of feature keys to actual database column names")
    params: ClusteringParams = Field(..., description="Clustering configuration settings")

    @model_validator(mode="after")
    def validate_min_features(self) -> "ClusteringRequest":
        if len(self.columns) < 2:
            raise ValueError("Select at least 2 features for clustering.")
        return self


# --- OUTPUT SUB-MODELS ---
class ClusterSummary(BaseModel):
    cluster_id: int = Field(..., description="Cluster label (e.g., 0, 1, 2)")
    count: int = Field(..., description="Number of items in the cluster")
    centroid: Optional[Dict[str, float]] = Field(None, description="Centroid of the cluster (if applicable)")

class ChartData(BaseModel):
    image_base64: Optional[str] = Field(None, description="Base64-encoded image string of chart")
    scatter_data: Optional[Dict[str, Any]] = Field(None, description="Structured scatter plot data for frontend")

# --- OUTPUT MODEL ---
class ClusteringResponse(BaseModel):
    data: List[ClusterSummary] = Field(..., description="List of cluster summaries")
    chart_data: ChartData = Field(..., description="Chart or plot-related output")
    # llm_observations: Optional[str] = Field(None, description="Optional LLM-generated summary of clustering insights")


