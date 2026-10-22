"""Printable checkpoint markers for the DEMO campus. One A4 page per checkpoint."""
import json, subprocess, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

SIGN = HexColor("#0e5a3c"); AMBER = HexColor("#f5b301"); DEMO = HexColor("#7a4f00"); DEMO_BG = HexColor("#fff1cc")
cps = json.loads(sys.argv[1]); out = sys.argv[2]
W, H = A4
c = canvas.Canvas(out, pagesize=A4)
c.setTitle("VIT ImmersiveAR demo checkpoint markers"); c.setAuthor("VIT ImmersiveAR")
COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]
for cp in cps:
    # Header band
    c.setFillColor(SIGN); c.rect(0, H - 40*mm, W, 40*mm, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("Helvetica-Bold", 30); c.drawString(18*mm, H - 22*mm, "Checkpoint marker")
    c.setFont("Helvetica", 15); c.drawString(18*mm, H - 32*mm, f"{cp['name'][0].upper() + cp['name'][1:]}" + (f"  (floor {cp['level']})" if cp['level'] else ""))
    # Demo warning
    c.setFillColor(DEMO_BG); c.rect(18*mm, H - 58*mm, W - 36*mm, 13*mm, stroke=0, fill=1)
    c.setFillColor(DEMO); c.setFont("Helvetica-Bold", 11)
    c.drawString(22*mm, H - 50*mm, "DEMO MARKER for the synthetic test campus. Not a VIT Vellore location.")
    # QR code, large, with quiet zone
    size = 95*mm
    widget = qr.QrCodeWidget(cp["marker"], barLevel="M")
    b = widget.getBounds(); bw, bh = b[2] - b[0], b[3] - b[1]
    d = Drawing(size, size, transform=[size / bw, 0, 0, size / bh, 0, 0]); d.add(widget)
    x0 = (W - size) / 2; y0 = H - 165*mm
    renderPDF.draw(d, c, x0, y0)
    c.setFillColor(black); c.setFont("Helvetica", 12); c.drawCentredString(W / 2, y0 - 7*mm, cp["marker"])
    # Facing arrow (points up the page)
    ax = W / 2; ay = 48*mm
    c.setFillColor(AMBER); c.setStrokeColor(HexColor("#5c4300")); c.setLineWidth(2)
    p = c.beginPath()
    p.moveTo(ax, ay + 40*mm); p.lineTo(ax - 22*mm, ay + 14*mm); p.lineTo(ax - 8*mm, ay + 14*mm)
    p.lineTo(ax - 8*mm, ay - 10*mm); p.lineTo(ax + 8*mm, ay - 10*mm); p.lineTo(ax + 8*mm, ay + 14*mm)
    p.lineTo(ax + 22*mm, ay + 14*mm); p.close(); c.drawPath(p, stroke=1, fill=1)
    face = COMPASS[round(cp["facingDeg"] / 45) % 8]
    c.setFillColor(black); c.setFont("Helvetica-Bold", 15)
    c.drawCentredString(W / 2, 30*mm, f"Face this way ({face} on the campus map)")
    c.setFont("Helvetica", 10.5)
    lines = [
        "Lay this sheet flat on the floor with the arrow pointing along the route, and tape the corners.",
        "In the app: Guide me with AR, then point the camera at this code. Then stand at the tail of",
        "the arrow, face the way it points, hold the phone upright and tap Align here.",
    ]
    for i, t in enumerate(lines): c.drawCentredString(W / 2, 22*mm - i * 5.2*mm, t)
    c.showPage()
c.save()
print("wrote", out)
