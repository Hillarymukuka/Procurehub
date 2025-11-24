"""Purchase Order PDF generation service."""

import io
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    Flowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from ..config import get_settings
from ..models import CompanySettings, RFQ, Quotation, SupplierProfile

settings = get_settings()


class RoundedParagraphBox(Flowable):
    """Flowable container used for the rounded detail boxes."""

    def __init__(self, width: float, title: str, body: str):
        super().__init__()
        self.width = width
        self.title_text = title
        self.body_text = body
        self.padding = 12
        self.radius = 8
        self.border_color = colors.HexColor("#d9d9d9")
        self.background_color = colors.HexColor("#f4f4f4")

        stylesheet = getSampleStyleSheet()
        self.title_style = ParagraphStyle(
            "RoundedBoxTitle",
            parent=stylesheet["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.black,
        )
        self.body_style = ParagraphStyle(
            "RoundedBoxBody",
            parent=stylesheet["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=colors.black,
        )
        self.title_para = Paragraph(self.title_text, self.title_style)
        self.body_para = Paragraph(self.body_text, self.body_style)
        self.title_height = 0.0
        self.body_height = 0.0
        self.height = 0.0

    def wrap(self, availWidth, availHeight):  # type: ignore[override]
        usable_width = min(self.width, availWidth)
        inner_width = usable_width - 2 * self.padding
        self.title_para.wrap(inner_width, availHeight)
        self.body_para.wrap(inner_width, availHeight)
        self.title_height = getattr(self.title_para, "height", 0.0)
        self.body_height = getattr(self.body_para, "height", 0.0)
        self.height = self.title_height + self.body_height + 2 * self.padding + 6
        self.width = usable_width
        return usable_width, self.height

    def draw(self):  # type: ignore[override]
        canvas = self.canv
        canvas.saveState()
        canvas.setFillColor(self.background_color)
        canvas.setStrokeColor(self.border_color)
        canvas.setLineWidth(1)
        canvas.roundRect(0, 0, self.width, self.height, self.radius, stroke=0, fill=1)
        canvas.setStrokeColor(self.border_color)
        canvas.roundRect(0, 0, self.width, self.height, self.radius, stroke=1, fill=0)

        y_position = self.height - self.padding
        self.title_para.drawOn(canvas, self.padding, y_position - self.title_height)
        y_position -= self.title_height + 6
        self.body_para.drawOn(canvas, self.padding, y_position - self.body_height)
        canvas.restoreState()


ONES = (
    "Zero",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
)
TEENS = (
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
)
TENS = (
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
)
SCALES = ("", "Thousand", "Million", "Billion", "Trillion")


def _hundreds_to_words(number: int) -> str:
    words: list[str] = []
    if number >= 100:
        words.append(ONES[number // 100])
        words.append("Hundred")
        number %= 100
    if number >= 20:
        words.append(TENS[number // 10])
        if number % 10:
            words.append(ONES[number % 10])
    elif number >= 10:
        words.append(TEENS[number - 10])
    elif number > 0:
        words.append(ONES[number])
    return " ".join(words)


def _number_to_words(number: int) -> str:
    if number == 0:
        return "Zero"
    words: list[str] = []
    scale_index = 0
    while number > 0 and scale_index < len(SCALES):
        chunk = number % 1000
        if chunk:
            chunk_words = _hundreds_to_words(chunk)
            scale = SCALES[scale_index]
            if scale:
                chunk_words = f"{chunk_words} {scale}"
            words.insert(0, chunk_words)
        number //= 1000
        scale_index += 1
    return " ".join(words)


def _convert_amount_to_words(amount: Decimal) -> str:
    quantized_amount = (amount or Decimal("0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    whole_part = int(quantized_amount)
    fractional_part = int((quantized_amount - Decimal(whole_part)) * 100)
    words = _number_to_words(abs(whole_part))
    if whole_part < 0:
        words = f"Negative {words}"
    if fractional_part:
        fraction_words = _number_to_words(fractional_part)
        return f"{words} and {fraction_words} Cents"
    return words


def _format_currency(value: Decimal, currency: str) -> str:
    normalized_value = (value or Decimal("0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{currency} {normalized_value:,.2f}"


def _format_po_number(identifier: Optional[int]) -> str:
    """Build a PO code like PO006_102025 based on identifier and current month/year."""
    month_year = datetime.utcnow().strftime("%m%Y")
    sequence = "000"
    if identifier is not None:
        try:
            sequence = f"{int(identifier):03d}"
        except (TypeError, ValueError):
            pass
    return f"PO{sequence}_{month_year}"


def _ensure_decimal(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if value is None:
        return Decimal("0")
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0")


def generate_purchase_order_pdf(
    rfq: RFQ,
    quotation: Quotation,
    supplier: SupplierProfile,
    company_settings: CompanySettings,
    po_number: Optional[str] = None,
) -> bytes:
    """
    Generate a professional Purchase Order PDF.

    Args:
        rfq: The RFQ object.
        quotation: The approved quotation.
        supplier: The supplier profile.
        company_settings: Company settings with logo and details.
        po_number: Purchase order number (auto-generated if not provided).

    Returns:
        PDF file as bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    def _draw_confidential(canvas_obj, doc_template):
        """Render a subtle CONFIDENTIAL watermark diagonally across the page."""
        canvas_obj.saveState()
        width, height = doc_template.pagesize
        try:
            canvas_obj.setFillColor(colors.Color(0.2, 0.2, 0.2, alpha=0.06))
        except TypeError:
            canvas_obj.setFillColor(colors.HexColor("#bbbbbb"))
        try:
            canvas_obj.setFillAlpha(0.06)
        except AttributeError:
            pass
        canvas_obj.setFont("Helvetica-Bold", 80)
        canvas_obj.translate(width / 2, height / 2)
        canvas_obj.rotate(45)
        canvas_obj.drawCentredString(0, 0, "CONFIDENTIAL")
        canvas_obj.restoreState()

    elements = []

    styles = getSampleStyleSheet()
    normal_style = styles["Normal"]
    normal_style.fontName = "Helvetica"
    normal_style.fontSize = 10
    normal_style.leading = 14
    normal_style.textColor = colors.black

    minor_label_style = ParagraphStyle(
        "MinorLabel",
        parent=normal_style,
        fontSize=9,
        textColor=colors.HexColor("#444444"),
    )
    section_heading_style = ParagraphStyle(
        "SectionHeading",
        parent=normal_style,
        fontName="Helvetica-Bold",
        fontSize=12,
        textColor=colors.black,
        spaceBefore=18,
        spaceAfter=8,
    )

    company_name = getattr(company_settings, "company_name", "Company Name")
    address_line1 = getattr(company_settings, "address_line1", "")
    address_line2 = getattr(company_settings, "address_line2", "")
    city = getattr(company_settings, "city", "")
    state = getattr(company_settings, "state", "")
    postal_code = getattr(company_settings, "postal_code", "")
    country = getattr(company_settings, "country", "")
    phone = getattr(company_settings, "phone", "")
    email = getattr(company_settings, "email", "")
    website = getattr(company_settings, "website", "")

    # Header content
    logo_path = getattr(company_settings, "logo_path", None)
    logo_flowable = None
    if logo_path:
        logo_full_path = settings.resolved_upload_dir / logo_path
        if logo_full_path.exists():
            try:
                logo_flowable = Image(str(logo_full_path), width=1.8 * inch, height=0.9 * inch, kind="proportional")
                logo_flowable.hAlign = "LEFT"
            except Exception:
                logo_flowable = None

    company_details_lines = [
        line
        for line in [
            address_line1,
            address_line2,
            ", ".join(filter(None, [city, state, postal_code])),
            country,
            f"Phone: {phone}" if phone else "",
            f"Email: {email}" if email else "",
            f"Website: {website}" if website else "",
        ]
        if line
    ]

    left_column_rows = []
    if logo_flowable:
        left_column_rows.append([logo_flowable])
    left_column_rows.append(
        [
            Paragraph(
                f"<font size=14><b>{company_name}</b></font>",
                ParagraphStyle(
                    name="CompanyName",
                    parent=normal_style,
                    fontName="Helvetica-Bold",
                    fontSize=14,
                ),
            )
        ]
    )
    if company_details_lines:
        left_column_rows.append(
            [Paragraph("<br/>".join(company_details_lines), minor_label_style)]
        )
    left_column_table = Table(
        left_column_rows,
        colWidths=[doc.width * 0.5],
        hAlign="LEFT",
    )
    left_column_table.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )

    default_po_identifier = getattr(quotation, "id", None) or getattr(rfq, "id", None)
    formatted_po_number = po_number or _format_po_number(default_po_identifier)

    right_header_text = f"""
    <para alignment="right">
    <font size=18><b>Purchase Order</b></font><br/>
    <font size=10 color="#444444">
    PO No: {formatted_po_number}<br/>
    Date: {datetime.utcnow().strftime('%B %d, %Y')}<br/>
    Reference ID: {getattr(rfq, 'id', None) and f"RFQ-{rfq.id}" or getattr(rfq, 'title', 'N/A')}
    </font>
    </para>
    """
    right_header_para = Paragraph(right_header_text, minor_label_style)

    header_table = Table(
        [[left_column_table, right_header_para]],
        colWidths=[doc.width * 0.5, doc.width * 0.5],
        hAlign="LEFT",
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    elements.append(header_table)
    elements.append(Spacer(1, 0.25 * inch))

    # Order details boxes
    supplier_name = getattr(supplier, "company_name", "N/A")
    supplier_email = getattr(supplier, "contact_email", "N/A")
    supplier_phone = getattr(supplier, "contact_phone", "")
    supplier_address = getattr(supplier, "address", "")

    supplier_lines = [
        supplier_name,
        supplier_address or "",
        f"Email: {supplier_email}" if supplier_email else "",
        f"Phone: {supplier_phone}" if supplier_phone else "",
    ]

    cleaned_supplier_info = "<br/>".join([line for line in supplier_lines if line])
    supplier_box = RoundedParagraphBox(
        doc.width,
        "Supplier Information",
        cleaned_supplier_info or "Information not provided",
    )
    elements.append(supplier_box)
    elements.append(Spacer(1, 0.15 * inch))

    # RFQ details
    elements.append(Paragraph("RFQ Details", section_heading_style))
    currency = getattr(quotation, "currency", getattr(rfq, "currency", "USD") or "USD")
    subtotal_amount = _ensure_decimal(getattr(quotation, "amount", Decimal("0")))

    rfq_title = getattr(rfq, "title", "N/A")
    rfq_category = getattr(getattr(rfq, "category", None), "name", None) or getattr(rfq, "category", "N/A")
    rfq_deadline = getattr(rfq, "deadline", None)
    rfq_details_lines = [
        f"<b>Title:</b> {rfq_title or 'N/A'}",
        f"<b>Category:</b> {rfq_category or 'N/A'}",
        f"<b>Delivery Timeframe:</b> {rfq_deadline.strftime('%B %d, %Y') if rfq_deadline else 'As per agreement'}",
    ]
    rfq_details_lines.append(f"<b>Awarded Amount:</b> {_format_currency(subtotal_amount, currency)}")

    elements.append(Paragraph("<br/>".join(rfq_details_lines), normal_style))

    rfq_description = getattr(rfq, "description", None)
    if rfq_description:
        elements.append(Spacer(1, 0.1 * inch))
        elements.append(Paragraph(f"<b>Description:</b><br/>{rfq_description}", normal_style))

    # Financial summary
    elements.append(Paragraph("Financial Summary", section_heading_style))
    
    # Get base amount and tax details
    base_amount = _ensure_decimal(getattr(quotation, "amount", Decimal("0")))
    tax_type = getattr(quotation, "tax_type", None)
    tax_amount = _ensure_decimal(getattr(quotation, "tax_amount", Decimal("0")))
    
    # Calculate totals
    subtotal = base_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total_amount = (subtotal + tax_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    summary_data = [
        ["Base Amount", _format_currency(subtotal, currency)],
    ]
    
    if tax_type and tax_amount > 0:
        tax_label = f"{tax_type} ({tax_type == 'VAT' and '16%' or '5%'})"
        summary_data.append([tax_label, _format_currency(tax_amount, currency)])
    
    summary_data.append(["Total Amount", _format_currency(total_amount, currency)])
    summary_table = Table(summary_data, colWidths=[doc.width * 0.6, doc.width * 0.4])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f4f4f4")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#d9d9d9")),
                ("INNERGRID", (0, 0), (-1, -2), 0.5, colors.HexColor("#d9d9d9")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("FONTNAME", (0, 0), (-1, -2), "Helvetica"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, -1), (-1, -1), 12),
            ]
        )
    )
    elements.append(summary_table)

    # Awarded amount highlight
    elements.append(Spacer(1, 0.15 * inch))
    awarded_amount_para = Paragraph(
        f"Awarded Amount: {_format_currency(total_amount, currency)}",
        ParagraphStyle(
            "AwardedAmount",
            parent=normal_style,
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
        ),
    )
    elements.append(awarded_amount_para)

    amount_in_words = Paragraph(
        f"<b>Amount in words:</b> {currency} {_convert_amount_to_words(total_amount)} Only",
        normal_style,
    )
    elements.append(Spacer(1, 0.1 * inch))
    elements.append(amount_in_words)

    # Additional notes
    elements.append(Spacer(1, 0.2 * inch))
    elements.append(Paragraph("Additional Notes", section_heading_style))
    elements.append(
        Paragraph(
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. "
            "Suspendisse vitae purus nec lacus eleifend semper in vel dolor.",
            normal_style,
        )
    )

    # Terms and conditions
    elements.append(Paragraph("Terms & Conditions", section_heading_style))
    terms_text = """
    1. Payment is due within 30 days of invoice receipt.<br/>
    2. Supplier invoices must reference the Purchase Order number provided.<br/>
    3. Goods and services must comply with agreed specifications and delivery timelines.<br/>
    4. Any variations require prior written approval from the procurement team.
    """
    elements.append(Paragraph(terms_text, normal_style))

    # Footer
    elements.append(Spacer(1, 0.3 * inch))
    footer_email = email or "procurement@example.com"
    footer_phone = phone or "+00 000 0000"
    footer_text = f"""
    <para alignment="center">
    <font size=9>Email: {footer_email} | Phone: {footer_phone}</font>
    </para>
    """
    elements.append(Paragraph(footer_text, minor_label_style))

    doc.build(
        elements,
        onFirstPage=_draw_confidential,
        onLaterPages=_draw_confidential,
    )

    pdf_bytes = buffer.getvalue()
    buffer.close()

    return pdf_bytes
