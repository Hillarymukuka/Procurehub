"""Utility helpers for managing uploaded files."""

from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from ..config import get_settings


settings = get_settings()
BASE_UPLOAD_DIR = settings.resolved_upload_dir
BASE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Security: Whitelist allowed file extensions and MIME types
ALLOWED_EXTENSIONS = {
    '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp',
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.csv', '.zip', '.rar'
}

ALLOWED_MIME_TYPES = {
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/bmp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/octet-stream'  # Generic binary, check extension
}

# 25MB max file size (configurable)
MAX_FILE_SIZE = 25 * 1024 * 1024


def validate_upload_file(upload: UploadFile) -> None:
    """Validate file extension, content type, and size for security."""
    if not upload.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required"
        )
    
    # Check extension against whitelist
    extension = Path(upload.filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{extension}' not allowed. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )
    
    # Validate MIME type (content-type header)
    content_type = upload.content_type or ''
    if content_type and content_type not in ALLOWED_MIME_TYPES:
        # Allow octet-stream if extension is valid
        if content_type != 'application/octet-stream':
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file content type: {content_type}"
            )
    
    # Check file size
    upload.file.seek(0, 2)  # Seek to end
    file_size = upload.file.tell()
    upload.file.seek(0)  # Reset to beginning
    
    if file_size > MAX_FILE_SIZE:
        max_size_mb = MAX_FILE_SIZE / 1024 / 1024
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {max_size_mb}MB"
        )
    
    if file_size == 0:
        raise HTTPException(
            status_code=400,
            detail="File is empty"
        )


def save_upload_file(upload: UploadFile, subdir: Optional[str] = None) -> Path:
    """Persist an uploaded file and return its path.
    
    Security features:
    - Validates file extension and MIME type
    - Enforces file size limits
    - Sanitizes subdirectory to prevent path traversal
    - Uses random UUID filenames to prevent conflicts and predictability
    """
    # Validate file before saving
    validate_upload_file(upload)
    
    target_dir = BASE_UPLOAD_DIR
    if subdir:
        # Security: Prevent path traversal attacks by only using basename
        # This prevents "../../../etc/passwd" type attacks
        safe_subdir = Path(subdir).name
        target_dir = target_dir / safe_subdir
        target_dir.mkdir(parents=True, exist_ok=True)

    # Use safe extension from whitelist (already validated)
    extension = Path(upload.filename or "").suffix.lower()
    filename = f"{uuid4().hex}{extension}"
    file_path = target_dir / filename

    # Save file
    with file_path.open("wb") as out_file:
        content = upload.file.read()
        out_file.write(content)

    return file_path

