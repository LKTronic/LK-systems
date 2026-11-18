"""
Complete generator for Ultra-Professional 16:9 Corporate Presentation Templates for LK Tronics
Resolution: 2560 x 1440
Outputs:
- public/template_assets/pptx_slides/brand_slide1_cover.png
- public/template_assets/pptx_slides/brand_slide2_intro.png
- public/template_assets/pptx_slides/brand_slide3_design.png
- public/template_assets/pptx_slides/brand_slide4_pricing.png
- public/template_assets/pptx_slides/brand_slide5_bank.png
- public/template_assets/pptx_slides/brand_slide6_terms.png
- public/template_assets/pptx_slides/brand_slide7_clients.png
- public/template_assets/pptx_slides/brand_slide8_partners.png
"""

import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 2560, 1440

LK_TEAL = (26, 91, 102)
LK_TEAL_DARK = (16, 62, 70)
LK_TEAL_LIGHT = (42, 132, 148)
LK_ORANGE = (234, 138, 26)
LK_ORANGE_DARK = (195, 110, 15)
LK_SLATE = (17, 24, 39)
LK_MUTED = (100, 116, 139)
BG_LIGHT = (248, 250, 252)
CARD_BG = (255, 255, 255)
BORDER_COLOR = (218, 226, 237)
BORDER_TEAL = (26, 91, 102)

FONT_DIR = "C:/Windows/Fonts"
font_cover_super = ImageFont.truetype(os.path.join(FONT_DIR, "arialbd.ttf"), 38)
font_cover_title = ImageFont.truetype(os.path.join(FONT_DIR, "arialbd.ttf"), 90)
font_title = ImageFont.truetype(os.path.join(FONT_DIR, "arialbd.ttf"), 52)
font_section = ImageFont.truetype(os.path.join(FONT_DIR, "arialbd.ttf"), 34)
font_body = ImageFont.truetype(os.path.join(FONT_DIR, "arial.ttf"), 28)
font_body_bold = ImageFont.truetype(os.path.join(FONT_DIR, "arialbd.ttf"), 28)
font_sm = ImageFont.truetype(os.path.join(FONT_DIR, "arial.ttf"), 22)
font_sm_bold = ImageFont.truetype(os.path.join(FONT_DIR, "arialbd.ttf"), 22)
font_badge = ImageFont.truetype(os.path.join(FONT_DIR, "arialbd.ttf"), 26)

# Load Source Assets
lk_logo = Image.open("public/template_assets/lk_tronics_logo.png").convert("RGBA")
client_crop = Image.open("Doc/client_logos_teal.png").convert("RGBA")
partner_crop = Image.open("Doc/partner_logos_teal.png").convert("RGBA")
warranty_badge = Image.open("Doc/test_img14.png").convert("RGBA")

OUT_DIR = "public/template_assets/pptx_slides"
os.makedirs(OUT_DIR, exist_ok=True)

def fit_logo(logo_img, max_w, max_h):
    lw, lh = logo_img.size
    ratio = min(max_w / lw, max_h / lh)
    nw = max(1, int(lw * ratio))
    nh = max(1, int(lh * ratio))
    return logo_img.resize((nw, nh), Image.Resampling.LANCZOS)

def create_base_canvas():
    img = Image.new("RGBA", (W, H), BG_LIGHT + (255,))
    draw = ImageDraw.Draw(img)

    # Subtle technical grid dots (every 64px)
    dot_color = (226, 232, 240, 200)
    for x in range(64, W, 64):
        for y in range(64, H, 64):
            draw.rectangle([x, y, x+2, y+2], fill=dot_color)

    # Top accent bar (Teal + Orange gradient)
    draw.rectangle([0, 0, W, 10], fill=LK_TEAL + (255,))
    draw.rectangle([W//3, 0, 2*W//3, 10], fill=LK_ORANGE + (255,))
    return img, draw

def draw_slide_header(draw, title_text, category_text="PROJECT ARCHITECTURE & SCOPE"):
    # Top sub-bar across width
    draw.rectangle([0, 10, W, 58], fill=(255, 255, 255, 230))
    draw.line([(0, 58), (W, 58)], fill=BORDER_COLOR + (255,), width=1)

    draw.text((90, 22), "LK TRONICS TRADING (PVT) LTD • R&D DIVISION", font=font_sm_bold, fill=LK_TEAL + (255,))
    draw.text((W - 90, 22), category_text, font=font_sm_bold, fill=LK_ORANGE + (255,), anchor="ra")

    # Center Title text (Deep Industrial Teal)
    draw.text((W//2, 70), title_text, font=font_title, fill=LK_TEAL + (255,), anchor="ma")

    # Tech Underline for Slide Title
    draw.line([(W//2 - 280, 134), (W//2 + 280, 134)], fill=LK_ORANGE + (255,), width=4)
    draw.ellipse([W//2 - 286, 129, W//2 - 274, 139], fill=LK_TEAL + (255,))
    draw.ellipse([W//2 + 274, 129, W//2 + 286, 139], fill=LK_TEAL + (255,))

def draw_slide_footer(img, draw, page_num=2):
    # Footer separator line
    draw.line([(80, H - 145), (W - 80, H - 145)], fill=BORDER_COLOR + (255,), width=2)
    draw.line([(80, H - 145), (280, H - 145)], fill=LK_ORANGE + (255,), width=4)
    draw.line([(W - 280, H - 145), (W - 80, H - 145)], fill=LK_TEAL + (255,), width=4)

    # Ecosystem individual logos footer
    footer_logos = ['lk_tronics', 'iot', 'nvidia_jetson', 'arduino', 'stm32', 'raspberry_pi']
    start_x = 90
    total_w = 1150
    slot_w = total_w / len(footer_logos)
    y_center = H - 75

    for i, name in enumerate(footer_logos):
        logo_path = f"public/template_assets/logos/footer/{name}.png"
        if os.path.exists(logo_path):
            l_img = Image.open(logo_path).convert("RGBA")
            max_h = 75 if name in ("lk_tronics", "iot", "lk_tronics_iot") else 65 if name == "nvidia_jetson" else 60
            scaled = fit_logo(l_img, slot_w - 35, max_h)
            sw, sh = scaled.size
            cx = int(start_x + i * slot_w + slot_w / 2)
            px = cx - sw // 2
            py = y_center - sh // 2
            img.paste(scaled, (px, py), scaled)

        if i < len(footer_logos) - 1:
            div_x = int(start_x + (i + 1) * slot_w)
            draw.line([(div_x, H - 110), (div_x, H - 40)], fill=BORDER_COLOR + (255,), width=1)

    # Confidentiality metadata right
    draw.text((W - 90, H - 85), "LK TRONICS (PVT) LTD • CONFIDENTIAL & PROPRIETARY", font=font_sm_bold, fill=LK_MUTED + (255,), anchor="ra")
    draw.text((W - 90, H - 55), f"Turnkey IoT & Automation Proposal • Slide {page_num} of 8", font=font_sm, fill=LK_MUTED + (255,), anchor="ra")

def draw_chamfered_card(draw, x1, y1, x2, y2, chamfer=24, fill=CARD_BG, stroke=BORDER_TEAL, width=3):
    pts = [
        (x1 + chamfer, y1),
        (x2 - chamfer, y1),
        (x2, y1 + chamfer),
        (x2, y2 - chamfer),
        (x2 - chamfer, y2),
        (x1 + chamfer, y2),
        (x1, y2 - chamfer),
        (x1, y1 + chamfer)
    ]
    draw.polygon(pts, fill=fill + (255,), outline=stroke + (255,))
    # Corner accent ticks in LK Tech Orange
    draw.line([(x1, y1 + chamfer), (x1 + chamfer, y1)], fill=LK_ORANGE + (255,), width=width+1)
    draw.line([(x2 - chamfer, y2), (x2, y2 - chamfer)], fill=LK_ORANGE + (255,), width=width+1)

# ==============================================================================
# SLIDE 1: COVER SLIDE
# ==============================================================================
def make_slide1():
    img, draw = create_base_canvas()

    # Top corporate category banner
    draw.rectangle([0, 10, W, 64], fill=(255, 255, 255, 230))
    draw.line([(0, 64), (W, 64)], fill=BORDER_COLOR + (255,), width=1)
    draw.text((90, 22), "LK TRONICS TRADING (PVT) LTD", font=font_sm_bold, fill=LK_TEAL + (255,))
    draw.text((W - 90, 22), "RESEARCH & DEVELOPMENT DIVISION • OFFICIAL PROPOSAL", font=font_sm_bold, fill=LK_ORANGE + (255,), anchor="ra")

    # Main "PROJECT PROPOSAL" Title - Perfectly centered horizontally
    draw.text((W // 2, 95), "PROJECT", font=font_cover_super, fill=LK_ORANGE + (255,), anchor="ma")
    draw.text((W // 2, 140), "PROPOSAL", font=font_cover_title, fill=LK_TEAL + (255,), anchor="ma")

    # Tech Underline for Cover
    draw.line([(W // 2 - 280, 252), (W // 2 + 280, 252)], fill=LK_ORANGE + (255,), width=4)
    draw.ellipse([W // 2 - 286, 247, W // 2 - 274, 257], fill=LK_TEAL + (255,))
    draw.ellipse([W // 2 + 274, 247, W // 2 + 286, 257], fill=LK_TEAL + (255,))

    # Note: Quotation Reference No is printed by jsPDF in the TOP-RIGHT (minimal, next line number, no box)

    # Project Title Container Frame (Where jsPDF prints the dynamic project title)
    draw_chamfered_card(draw, 240, 290, W - 240, 565, chamfer=28, fill=CARD_BG, stroke=LK_TEAL, width=3)
    draw.rectangle([248, 298, W - 248, 557], outline=(235, 240, 245, 255), width=2)

    # Quotation Reference Container (3 Columns)
    ref_y = 600
    ref_h = 425
    draw_chamfered_card(draw, 140, ref_y, W - 140, ref_y + ref_h, chamfer=20, fill=CARD_BG, stroke=BORDER_COLOR, width=2)

    # Left Column: Official Contact & Communication Channels (x from 180 to 920)
    font_comm_header = ImageFont.truetype(os.path.join(FONT_DIR, "arialbd.ttf"), 26)
    font_comm_text = ImageFont.truetype(os.path.join(FONT_DIR, "arial.ttf"), 32)
    draw.text((180, ref_y + 55), "COMMUNICATION CHANNELS:", font=font_comm_header, fill=LK_MUTED + (255,))
    draw.text((180, ref_y + 110), "Email: rad@lk-tronics.com", font=font_comm_text, fill=LK_SLATE + (255,))
    draw.text((180, ref_y + 168), "Hotline: (+94) 77 739 4782 / 0114 215 515", font=font_comm_text, fill=LK_SLATE + (255,))
    draw.text((180, ref_y + 226), "Web: https://www.lk-tronics.com", font=font_comm_text, fill=LK_TEAL_LIGHT + (255,))
    draw.text((180, ref_y + 284), "Address: High-Level Road, Homagama, Sri Lanka", font=font_comm_text, fill=LK_SLATE + (255,))

    # Divider 1
    draw.line([(920, ref_y + 30), (920, ref_y + ref_h - 30)], fill=BORDER_COLOR + (255,), width=2)

    # Center Column: Quotation To, Prepared Date & Validity Period (x from 960 to 1800)
    font_meta_header = ImageFont.truetype(os.path.join(FONT_DIR, "arialbd.ttf"), 26)
    font_meta_sub = ImageFont.truetype(os.path.join(FONT_DIR, "arial.ttf"), 24)
    draw.text((960, ref_y + 35), "QUOTATION TO / CLIENT DETAILS:", font=font_meta_header, fill=LK_MUTED + (255,))
    # (jsPDF prints dynamic data.quotationTo here in bold LK Slate at Y=137.5mm at 22pt)

    # Inner horizontal divider in Center Column
    draw.line([(960, ref_y + 225), (1780, ref_y + 225)], fill=BORDER_COLOR + (255,), width=1)

    # Sub-col A: Prepared Date
    draw.text((960, ref_y + 245), "PREPARED DATE:", font=font_meta_header, fill=LK_MUTED + (255,))
    draw.text((960, ref_y + 348), "Official Issue Date", font=font_meta_sub, fill=LK_MUTED + (255,))
    # (jsPDF prints dynamic data.preparedDate here at Y=180.0mm at 21pt)

    # Sub-col B: Validity Period
    draw.text((1380, ref_y + 245), "VALIDITY PERIOD:", font=font_meta_header, fill=LK_MUTED + (255,))
    draw.text((1380, ref_y + 348), "Commercial Validity Term", font=font_meta_sub, fill=LK_MUTED + (255,))
    # (jsPDF prints dynamic validity period here at Y=180.0mm at 21pt)

    # Divider 2
    draw.line([(1815, ref_y + 30), (1815, ref_y + ref_h - 30)], fill=BORDER_COLOR + (255,), width=2)

    # Right Column: Official LK Tronics Logo Badge
    logo_target_h = 340
    lw, lh = lk_logo.size
    logo_target_w = int(lw * (logo_target_h / lh))
    resized_logo = lk_logo.resize((logo_target_w, logo_target_h), Image.Resampling.LANCZOS)
    img.paste(resized_logo, (1870, ref_y + 42), resized_logo)

    # Bottom Partner Strip Container - Individual Logo Placement (Filling bottom space)
    draw.rounded_rectangle([140, 1060, W - 140, 1335], radius=16, fill=(255, 255, 255, 255), outline=BORDER_COLOR + (255,), width=2)
    draw.text((170, 1082), "INDUSTRY TECHNOLOGY PARTNERS & HARDWARE PLATFORMS", font=font_sm_bold, fill=LK_MUTED + (255,))
    draw.line([(160, 1118), (W - 160, 1118)], fill=BORDER_COLOR + (255,), width=1)

    cover_logos = ['acrel', 'lk_tronics_iot', 'raspberry_pi', 'stm32', 'mitsubishi_electric', 'airtac', 'samkoon', 'nvidia_jetson']
    start_x = 160
    total_w = (W - 160) - start_x
    slot_w = total_w / len(cover_logos)
    y_center = (1125 + 1325) // 2

    for i, name in enumerate(cover_logos):
        logo_path = f"public/template_assets/logos/cover/{name}.png"
        if os.path.exists(logo_path):
            l_img = Image.open(logo_path).convert("RGBA")
            if name == "lk_tronics_iot":
                target_h = 185
            elif name in ("raspberry_pi", "stm32"):
                target_h = 180
            elif name == "nvidia_jetson":
                target_h = 120
            else:
                target_h = 88
            scaled = fit_logo(l_img, slot_w - 20, target_h)
            sw, sh = scaled.size
            cx = int(start_x + i * slot_w + slot_w / 2)
            px = cx - sw // 2
            py = y_center - sh // 2
            img.paste(scaled, (px, py), scaled)

        if i < len(cover_logos) - 1:
            div_x = int(start_x + (i + 1) * slot_w)
            draw.line([(div_x, 1145), (div_x, 1310)], fill=BORDER_COLOR + (255,), width=1)

    # Bottom Disclaimer
    draw.text((W//2, 1380), "This document contains proprietary commercial and technical engineering information of LK Tronics Trading (Pvt) Ltd.", font=font_sm, fill=LK_MUTED + (255,), anchor="ma")

    out_path = os.path.join(OUT_DIR, "brand_slide1_cover.png")
    img.save(out_path, "PNG")
    print(f"Generated {out_path}")

# ==============================================================================
# SLIDE 2: SYSTEM OVERVIEW & INTRODUCTION
# ==============================================================================
def make_slide2():
    img, draw = create_base_canvas()
    draw_slide_header(draw, "SYSTEM OVERVIEW & OBJECTIVES", "PROJECT ARCHITECTURE & SCOPE")
    draw_slide_footer(img, draw, page_num=2)

    # Main Content Container Frame
    draw_chamfered_card(draw, 140, 160, W - 140, H - 170, chamfer=24, fill=CARD_BG, stroke=LK_TEAL, width=3)
    draw.rectangle([148, 168, W - 148, H - 178], outline=(241, 245, 249, 255), width=2)

    out_path = os.path.join(OUT_DIR, "brand_slide2_intro.png")
    img.save(out_path, "PNG")
    print(f"Generated {out_path}")

# ==============================================================================
# SLIDE 3: SYSTEM DESIGN & ARCHITECTURE
# ==============================================================================
def make_slide3():
    img, draw = create_base_canvas()
    draw_slide_header(draw, "SYSTEM DESIGN & ARCHITECTURE", "HARDWARE INTEGRATION & CIRCUIT TOPOLOGY")
    draw_slide_footer(img, draw, page_num=3)

    # Main Content Container Frame
    draw_chamfered_card(draw, 140, 160, W - 140, H - 170, chamfer=24, fill=CARD_BG, stroke=LK_TEAL, width=3)
    draw.rectangle([148, 168, W - 148, H - 178], outline=(241, 245, 249, 255), width=2)

    out_path = os.path.join(OUT_DIR, "brand_slide3_design.png")
    img.save(out_path, "PNG")
    print(f"Generated {out_path}")

# ==============================================================================
# SLIDE 4: BILL OF MATERIALS & COMMERCIAL INVESTMENT (Clean Canvas for jsPDF)
# ==============================================================================
def make_slide4():
    img, draw = create_base_canvas()
    draw_slide_header(draw, "BILL OF MATERIALS & COMMERCIAL INVESTMENT", "COST SCHEDULE & SPECIFICATIONS")
    draw_slide_footer(img, draw, page_num=4)

    # Main Content Container Frame
    draw_chamfered_card(draw, 140, 160, W - 140, H - 170, chamfer=24, fill=CARD_BG, stroke=LK_TEAL, width=3)
    draw.rectangle([148, 168, W - 148, H - 178], outline=(241, 245, 249, 255), width=2)

    out_path = os.path.join(OUT_DIR, "brand_slide4_pricing.png")
    img.save(out_path, "PNG")
    print(f"Generated {out_path}")

# ==============================================================================
# SLIDE 5: PAYMENT TERMS & BANKING INFORMATION
# ==============================================================================
def make_slide5():
    img, draw = create_base_canvas()
    draw_slide_header(draw, "PAYMENT TERMS & BANKING INFORMATION", "COMMERCIAL SETTLEMENT & ESCROW")
    draw_slide_footer(img, draw, page_num=5)

    # Main Content Container Frame
    draw_chamfered_card(draw, 140, 160, W - 140, H - 170, chamfer=24, fill=CARD_BG, stroke=LK_TEAL, width=3)

    # Left Box: Payment Terms & Credit Facility
    draw_chamfered_card(draw, 180, 200, 1440, 580, chamfer=16, fill=(248, 250, 252), stroke=BORDER_COLOR, width=2)
    font_po_title = ImageFont.truetype(os.path.join(FONT_DIR, "arialbd.ttf"), 30)
    font_po_body = ImageFont.truetype(os.path.join(FONT_DIR, "arial.ttf"), 36)
    draw.text((220, 230), "PURCHASE ORDER & ADVANCE TERMS", font=font_po_title, fill=LK_ORANGE + (255,))
    default_clause = (
        "The total value of the product or 60% of the total value\n"
        "should be payable together with your purchase order.\n\n"
        "(If only we are registered as your vendor, a one-month\n"
        "credit facility can be extended for your orders.\n"
        "To initiate this credit facility, kindly reach out to us.)"
    )
    draw.text((220, 285), default_clause, font=font_po_body, fill=LK_SLATE + (255,), spacing=10)

    # Right Box: Corporate Banking Card (Hatton National Bank)
    bank_x1, bank_y1, bank_x2, bank_y2 = 180, 630, W - 180, 1170
    draw_chamfered_card(draw, bank_x1, bank_y1, bank_x2, bank_y2, chamfer=20, fill=(255, 255, 255), stroke=LK_TEAL, width=3)

    # Left Blue Header Column in Bank Card
    draw.rectangle([bank_x1, bank_y1, bank_x1 + 600, bank_y2], fill=LK_TEAL + (255,))
    draw.text((bank_x1 + 300, bank_y1 + 50), "OFFICIAL CORPORATE", font=font_sm_bold, fill=LK_ORANGE + (255,), anchor="ma")
    draw.text((bank_x1 + 300, bank_y1 + 90), "BANK ACCOUNT", font=font_title, fill=(255, 255, 255, 255), anchor="ma")
    draw.line([(bank_x1 + 100, bank_y1 + 170), (bank_x1 + 500, bank_y1 + 170)], fill=LK_ORANGE + (255,), width=3)

    draw.text((bank_x1 + 300, bank_y1 + 220), "LK TRONICS TRADING PVT LTD", font=font_sm_bold, fill=(255, 255, 255, 255), anchor="ma")
    draw.text((bank_x1 + 300, bank_y1 + 260), "Commercial Escrow Account", font=font_sm, fill=(200, 220, 230, 255), anchor="ma")
    draw.text((bank_x1 + 300, bank_y1 + 440), "VERIFIED CORPORATE ENTITY", font=font_sm_bold, fill=LK_ORANGE + (255,), anchor="ma")

    # Right Content Area of Bank Card (Enlarged to match 22pt high-visibility standard)
    font_bank_label = ImageFont.truetype(os.path.join(FONT_DIR, "arialbd.ttf"), 38)
    font_bank_val = ImageFont.truetype(os.path.join(FONT_DIR, "arialbd.ttf"), 42)
    row_y = bank_y1 + 45
    fields = [
        ("Account Name", "LK TRONICS TRADING PVT LTD", LK_TEAL),
        ("Account Number", "047010021564", LK_ORANGE),
        ("Bank Name", "Hatton National Bank (HNB)", LK_SLATE),
        ("Bank Branch", "Biyagama Branch", LK_SLATE),
    ]

    for label, val, color in fields:
        draw.text((bank_x1 + 640, row_y + 12), label, font=font_bank_label, fill=LK_MUTED + (255,))
        draw.text((bank_x1 + 1160, row_y + 12), ":", font=font_bank_label, fill=LK_MUTED + (255,))
        draw.text((bank_x1 + 1210, row_y + 10), val, font=font_bank_val, fill=color + (255,))
        draw.line([(bank_x1 + 640, row_y + 88), (bank_x2 - 50, row_y + 88)], fill=BORDER_COLOR + (255,), width=1)
        row_y += 115

    out_path = os.path.join(OUT_DIR, "brand_slide5_bank.png")
    img.save(out_path, "PNG")
    print(f"Generated {out_path}")

# ==============================================================================
# SLIDE 6: TERMS AND CONDITIONS
# ==============================================================================
def make_slide6():
    img, draw = create_base_canvas()
    draw_slide_header(draw, "TERMS AND CONDITIONS", "LEGAL FRAMEWORK & WARRANTY CONDITIONS")
    draw_slide_footer(img, draw, page_num=6)

    # Main Content Container Frame
    draw_chamfered_card(draw, 140, 160, W - 140, H - 170, chamfer=24, fill=CARD_BG, stroke=LK_TEAL, width=3)
    draw.rectangle([148, 168, W - 148, H - 178], outline=(241, 245, 249, 255), width=2)

    out_path = os.path.join(OUT_DIR, "brand_slide6_terms.png")
    img.save(out_path, "PNG")
    print(f"Generated {out_path}")

# ==============================================================================
# SLIDE 7: OUR CLIENTS
# ==============================================================================
def make_slide7():
    img, draw = create_base_canvas()
    draw_slide_header(draw, "OUR VALUED CLIENTS", "INDUSTRY TRUST & PROVEN TRACK RECORD")
    draw_slide_footer(img, draw, page_num=7)

    # Main Content Container Frame
    draw_chamfered_card(draw, 140, 160, W - 140, H - 170, chamfer=24, fill=CARD_BG, stroke=LK_TEAL, width=3)

    # Paste the 16 genuine client logos (clean LK Teal brackets)
    cw, ch = client_crop.size
    target_ch = 960
    target_cw = int(cw * (target_ch / ch))
    resized_clients = client_crop.resize((target_cw, target_ch), Image.Resampling.LANCZOS)
    cx = (W - target_cw) // 2
    cy = 200
    img.paste(resized_clients, (cx, cy), resized_clients)

    out_path = os.path.join(OUT_DIR, "brand_slide7_clients.png")
    img.save(out_path, "PNG")
    print(f"Generated {out_path}")

# ==============================================================================
# SLIDE 8: BRAND PARTNERS
# ==============================================================================
def make_slide8():
    img, draw = create_base_canvas()
    draw_slide_header(draw, "TECHNOLOGY & BRAND PARTNERS", "GLOBAL OEM ECOSYSTEM & AUTHORIZED CHANNELS")
    draw_slide_footer(img, draw, page_num=8)

    # Main Content Container: Partner logos card fits container directly, eliminating double box & dead whitespace
    target_w = W - 280  # 2280 px (from 140 to 2420, matching all slide container cards)
    target_h = H - 330  # 1110 px (from 160 to 1270, matching all slide container cards)
    resized_partners = partner_crop.resize((target_w, target_h), Image.Resampling.LANCZOS)
    img.paste(resized_partners, (140, 160), resized_partners)

    out_path = os.path.join(OUT_DIR, "brand_slide8_partners.png")
    img.save(out_path, "PNG")
    print(f"Generated {out_path}")

if __name__ == "__main__":
    make_slide1()
    make_slide2()
    make_slide3()
    make_slide4()
    make_slide5()
    make_slide6()
    make_slide7()
    make_slide8()
    print("All 8 Ultra-Professional Brand Templates Generated Successfully!")
