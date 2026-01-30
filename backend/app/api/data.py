"""
Powercast AI - Data Upload API
Handle CSV uploads and data ingestion
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime
import logging
import csv
import io

from app.core.config import settings
from app.core.supabase import get_supabase, MockDatabase

logger = logging.getLogger(__name__)
router = APIRouter()


# =========================================
# Enums & Models
# =========================================


class UploadStatus(str, Enum):
    processing = "processing"
    completed = "completed"
    failed = "failed"


class UploadResponse(BaseModel):
    """Response model for an upload"""

    id: str
    user_id: str
    plant_id: Optional[str] = None
    filename: str
    file_size: int
    rows_count: int
    status: UploadStatus
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = {}
    uploaded_at: str
    processed_at: Optional[str] = None


class UploadListResponse(BaseModel):
    """Response model for upload list"""

    uploads: List[UploadResponse]
    total: int


class DataValidationResult(BaseModel):
    """Result of CSV validation"""

    valid: bool
    rows_count: int
    columns: List[str]
    errors: List[str] = []
    warnings: List[str] = []
    sample_data: List[Dict[str, Any]] = []


# Required columns for different data types
REQUIRED_COLUMNS = {
    "forecast": ["timestamp", "output_mw"],
    "weather": ["timestamp", "temperature"],
    "plant": ["name", "type", "capacity_mw"],
}

OPTIONAL_COLUMNS = {
    "forecast": ["temperature", "humidity", "wind_speed", "cloud_cover", "irradiance"],
    "weather": ["humidity", "wind_speed", "cloud_cover", "pressure"],
    "plant": ["location", "status", "efficiency_pct"],
}


# =========================================
# Helper Functions
# =========================================


def get_user_id(authorization: Optional[str] = None) -> str:
    """Extract user ID from authorization header"""
    # Development mode - use demo user
    return "demo-user"


def detect_data_type(columns: List[str]) -> str:
    """Detect the type of data based on columns"""
    cols_lower = [c.lower() for c in columns]

    if "output_mw" in cols_lower:
        return "forecast"
    elif "temperature" in cols_lower and "output_mw" not in cols_lower:
        return "weather"
    elif "capacity_mw" in cols_lower:
        return "plant"
    else:
        return "unknown"


def validate_csv_content(content: str) -> DataValidationResult:
    """Validate CSV content and return validation result"""
    errors = []
    warnings = []

    try:
        # Parse CSV
        reader = csv.DictReader(io.StringIO(content))
        columns = reader.fieldnames or []

        if not columns:
            return DataValidationResult(
                valid=False,
                rows_count=0,
                columns=[],
                errors=["No columns found in CSV file"],
            )

        # Normalize column names
        columns = [c.strip().lower() for c in columns]

        # Detect data type
        data_type = detect_data_type(columns)

        if data_type == "unknown":
            errors.append(
                "Could not determine data type from columns. Expected: timestamp, output_mw for forecast data"
            )

        # Check required columns
        if data_type in REQUIRED_COLUMNS:
            for col in REQUIRED_COLUMNS[data_type]:
                if col not in columns:
                    errors.append(f"Missing required column: {col}")

        # Parse rows and validate
        rows = []
        sample_data = []
        row_errors = 0

        for i, row in enumerate(reader):
            rows.append(row)

            if i < 5:  # Sample first 5 rows
                sample_data.append({k.strip().lower(): v for k, v in row.items()})

            # Validate timestamp format if present
            if "timestamp" in row:
                try:
                    datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00"))
                except ValueError:
                    row_errors += 1
                    if row_errors <= 3:
                        errors.append(
                            f"Row {i + 2}: Invalid timestamp format '{row.get('timestamp', '')}'"
                        )

            # Validate numeric fields
            for field in ["output_mw", "capacity_mw", "temperature"]:
                if field in row and row[field]:
                    try:
                        float(row[field])
                    except ValueError:
                        row_errors += 1
                        if row_errors <= 3:
                            errors.append(
                                f"Row {i + 2}: Invalid numeric value for {field}: '{row[field]}'"
                            )

        if row_errors > 3:
            warnings.append(f"... and {row_errors - 3} more validation errors")

        if len(rows) == 0:
            errors.append("No data rows found in CSV file")

        # Warnings for optional columns
        if data_type in OPTIONAL_COLUMNS:
            missing_optional = [
                col for col in OPTIONAL_COLUMNS[data_type] if col not in columns
            ]
            if missing_optional:
                warnings.append(
                    f"Optional columns not found: {', '.join(missing_optional)}"
                )

        return DataValidationResult(
            valid=len(errors) == 0,
            rows_count=len(rows),
            columns=columns,
            errors=errors,
            warnings=warnings,
            sample_data=sample_data,
        )

    except Exception as e:
        return DataValidationResult(
            valid=False,
            rows_count=0,
            columns=[],
            errors=[f"Failed to parse CSV: {str(e)}"],
        )


# =========================================
# Routes
# =========================================


@router.get("", response_model=UploadListResponse)
async def list_uploads(
    user_id: str = Depends(get_user_id),
    status: Optional[UploadStatus] = None,
    plant_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """List all uploads for the current user"""
    supabase = get_supabase()

    if supabase:
        try:
            query = supabase.table("uploads").select("*").eq("user_id", user_id)

            if status:
                query = query.eq("status", status.value)
            if plant_id:
                query = query.eq("plant_id", plant_id)

            query = query.order("uploaded_at", desc=True).range(
                offset, offset + limit - 1
            )

            result = query.execute()
            uploads = [UploadResponse(**u) for u in result.data]

            count_result = (
                supabase.table("uploads")
                .select("*", count="exact")
                .eq("user_id", user_id)
                .execute()
            )
            total = count_result.count or len(uploads)

            return UploadListResponse(uploads=uploads, total=total)

        except Exception as e:
            logger.error(f"Supabase error: {e}")
            raise HTTPException(status_code=500, detail="Database error")

    else:
        # Mock uploads for development
        uploads = list(MockDatabase._uploads.values())
        uploads = [u for u in uploads if u.get("user_id") == user_id]

        if status:
            uploads = [u for u in uploads if u["status"] == status.value]
        if plant_id:
            uploads = [u for u in uploads if u.get("plant_id") == plant_id]

        total = len(uploads)
        uploads = uploads[offset : offset + limit]

        return UploadListResponse(
            uploads=[UploadResponse(**u) for u in uploads], total=total
        )


@router.post("/validate")
async def validate_upload(file: UploadFile = File(...)):
    """Validate a CSV file before uploading"""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    try:
        content = await file.read()
        content_str = content.decode("utf-8")

        result = validate_csv_content(content_str)

        return {
            "filename": file.filename,
            "file_size": len(content),
            "validation": result.model_dump(),
        }

    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process file: {str(e)}")


@router.post("", response_model=UploadResponse, status_code=201)
async def upload_data(
    file: UploadFile = File(...),
    plant_id: Optional[str] = Form(None),
    region_code: str = Form("SWISS_GRID"),  # Region code for this data
    user_id: str = Depends(get_user_id),
):
    """
    Upload and process a CSV file.
    
    The CSV must contain 'timestamp' and 'output_mw' columns.
    Data is stored in the forecast_data table for real-time forecasting.
    """
    import pandas as pd
    from app.services.real_data_store import get_real_data_store
    from app.services.data_sanitizer import DataSanitizer
    
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    try:
        content = await file.read()
        content_str = content.decode("utf-8")

        # Validate first
        validation = validate_csv_content(content_str)

        if not validation.valid:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Validation failed",
                    "errors": validation.errors,
                },
            )

        supabase = get_supabase()
        
        if not supabase:
            raise HTTPException(
                status_code=503,
                detail="Database not configured. Cannot store data."
            )

        # Parse CSV into DataFrame
        import io
        df = pd.read_csv(io.StringIO(content_str))
        
        # Normalize column names
        df.columns = [c.strip().lower() for c in df.columns]
        
        # Detect region from CSV if present
        if 'region_code' in df.columns:
            csv_region = df['region_code'].iloc[0]
            if csv_region:
                region_code = csv_region
                logger.info(f"Detected region from CSV: {region_code}")
        
        # Sanitize data (gap detection, interpolation)
        sanitizer = DataSanitizer()
        df_clean, sanitized_result = sanitizer.sanitize(df)
        
        if not sanitized_result.is_valid:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Data rejected due to quality issues",
                    "status": sanitized_result.status,
                    "gaps": sanitized_result.gaps,
                    "max_gap_minutes": sanitized_result.max_gap_minutes,
                    "error": sanitized_result.message,
                }
            )
        
        # Track gaps filled info
        gaps_filled = sanitized_result.missing_intervals > 0
        interpolated_rows = sanitized_result.missing_intervals

        # Create upload record
        upload_data_record = {
            "user_id": user_id,
            "plant_id": plant_id,
            "filename": file.filename,
            "file_size": len(content),
            "rows_count": len(df_clean),
            "status": "processing",
            "metadata": {
                "columns": validation.columns,
                "data_type": detect_data_type(validation.columns),
                "region_code": region_code,
                "gaps_filled": gaps_filled,
                "interpolated_rows": interpolated_rows,
            },
        }

        try:
            # Create upload record
            result = supabase.table("uploads").insert(upload_data_record).execute()

            if not result.data:
                raise HTTPException(
                    status_code=500, detail="Failed to create upload record"
                )

            upload_record = result.data[0]
            upload_id = upload_record["id"]

            # Store actual timeseries data in forecast_data table
            data_store = get_real_data_store()
            store_result = data_store.store_csv_data(
                df=df_clean,
                region_code=region_code,
                upload_id=upload_id,
                plant_id=plant_id,
            )
            
            logger.info(f"Stored {store_result['rows_inserted']} rows for region {region_code}")

            # Update upload record as completed
            supabase.table("uploads").update(
                {
                    "status": "completed",
                    "processed_at": datetime.utcnow().isoformat(),
                    "metadata": {
                        **upload_data_record["metadata"],
                        "rows_stored": store_result["rows_inserted"],
                    }
                }
            ).eq("id", upload_id).execute()

            upload_record["status"] = "completed"
            upload_record["processed_at"] = datetime.utcnow().isoformat()

            return UploadResponse(**upload_record)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Database error: {e}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to process upload: {str(e)}"
        )


@router.get("/{upload_id}", response_model=UploadResponse)
async def get_upload(upload_id: str, user_id: str = Depends(get_user_id)):
    """Get details of a specific upload"""
    supabase = get_supabase()

    if supabase:
        try:
            result = (
                supabase.table("uploads")
                .select("*")
                .eq("id", upload_id)
                .eq("user_id", user_id)
                .single()
                .execute()
            )

            if not result.data:
                raise HTTPException(status_code=404, detail="Upload not found")

            return UploadResponse(**result.data)

        except Exception as e:
            if "404" in str(e):
                raise HTTPException(status_code=404, detail="Upload not found")
            logger.error(f"Supabase error: {e}")
            raise HTTPException(status_code=500, detail="Database error")

    else:
        upload = MockDatabase._uploads.get(upload_id)
        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found")
        if upload.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        return UploadResponse(**upload)


@router.delete("/{upload_id}", status_code=204)
async def delete_upload(upload_id: str, user_id: str = Depends(get_user_id)):
    """Delete an upload record"""
    supabase = get_supabase()

    if supabase:
        try:
            # Check ownership
            check = (
                supabase.table("uploads")
                .select("id")
                .eq("id", upload_id)
                .eq("user_id", user_id)
                .execute()
            )

            if not check.data:
                raise HTTPException(status_code=404, detail="Upload not found")

            supabase.table("uploads").delete().eq("id", upload_id).execute()
            return None

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Supabase error: {e}")
            raise HTTPException(status_code=500, detail="Database error")

    else:
        upload = MockDatabase._uploads.get(upload_id)
        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found")
        if upload.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        del MockDatabase._uploads[upload_id]
        return None
