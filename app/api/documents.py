# app/api/documents.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.ocr_service import extract_text_from_pdf

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/parse")
async def parse_document(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Tylko pliki PDF są obsługiwane")
    
    pdf_bytes = await file.read()
    text = extract_text_from_pdf(pdf_bytes)
    
    return {
        "filename": file.filename,
        "text": text,
        "char_count": len(text),
    }