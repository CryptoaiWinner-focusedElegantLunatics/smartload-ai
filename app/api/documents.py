from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.ocr_service import extract_text_from_pdf
from app.services.llm_service import extract_shipment_data, ShipmentData

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


@router.post("/extract", response_model=ShipmentData)
async def extract_document(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Tylko pliki PDF są obsługiwane")

    pdf_bytes = await file.read()
    text = extract_text_from_pdf(pdf_bytes)          # OCR + normalizacja tekstu
    shipment = await extract_shipment_data(text)     # LLM + mapping/walidacja

    return shipment