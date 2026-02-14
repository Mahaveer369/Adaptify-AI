"""Utility functions for extracting text from various file formats."""


def extract_from_pdf(file_path: str) -> list[str]:
    """Extract text from PDF, page by page."""
    try:
        import pdfplumber
        pages = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
        return pages
    except Exception as e:
        print(f"PDF extraction error: {e}")
        return []


def extract_from_docx(file_path: str) -> str:
    """Extract text from DOCX file."""
    try:
        from docx import Document
        doc = Document(file_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return '\n\n'.join(paragraphs)
    except Exception as e:
        print(f"DOCX extraction error: {e}")
        return ""


def extract_from_image(file_path: str) -> str:
    """Extract text from image using OCR."""
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img)
        return text
    except Exception as e:
        print(f"OCR extraction error: {e}")
        return ""
