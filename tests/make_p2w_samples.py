"""Builds PDF-to-Word samples: Vietnamese text + headings + table + image, English report, scanned (image-only) PDF. Usage: python3 make_p2w_samples.py OUTDIR"""
import sys,os,io
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,Image as RLImage,PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from PIL import Image,ImageDraw
O=sys.argv[1];os.makedirs(O,exist_ok=True)
pdfmetrics.registerFont(TTFont("DV","/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"));pdfmetrics.registerFont(TTFont("DVB","/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
N=ParagraphStyle("n",fontName="DV",fontSize=11,leading=15);H1=ParagraphStyle("h1",fontName="DVB",fontSize=22,leading=28,spaceAfter=10);H2=ParagraphStyle("h2",fontName="DVB",fontSize=16,leading=21,spaceBefore=8,spaceAfter=6)
def photo(p,w=600,h=400,seed=0):
    im=Image.new("RGB",(w,h));d=ImageDraw.Draw(im)
    for y in range(h):d.line([(0,y),(w,y)],fill=(30+y*200//h,120,200-y*150//h))
    d.ellipse([w//3,h//4,w//3+180,h//4+180],fill=(250,200,40));im.save(p,quality=90)
photo(O+"/_p.jpg")
VI=["Hợp đồng này được lập giữa Công ty TNHH Ánh Dương và ông Nguyễn Văn Đức, cư trú tại Thành phố Hồ Chí Minh. Hai bên thỏa thuận các điều khoản sau đây với tinh thần hợp tác, trung thực và cùng có lợi.",
"Bên B có trách nhiệm hoàn thành công việc đúng tiến độ, bảo đảm chất lượng và giữ bí mật thông tin của Bên A. Mọi thay đổi phải được lập thành văn bản và có chữ ký của cả hai bên."]
st=[Paragraph("Hợp đồng dịch vụ thiết kế",H1),Paragraph("Điều 1. Thông tin các bên",H2)]+[Paragraph(t,N) for t in VI]+[Paragraph("Điều 2. Bảng giá dịch vụ",H2)]
t=Table([["Hạng mục","Số lượng","Đơn giá (đ)","Thành tiền (đ)"],["Thiết kế logo","1","5.000.000","5.000.000"],["Bộ nhận diện","2","3.500.000","7.000.000"],["Ảnh sản phẩm","10","250.000","2.500.000"]],colWidths=[150,80,110,120])
t.setStyle(TableStyle([("FONT",(0,0),(-1,-1),"DV",10),("FONT",(0,0),(-1,0),"DVB",10),("GRID",(0,0),(-1,-1),0.5,colors.grey)]))
st+=[t,Spacer(1,12),Paragraph("Điều 3. Hình ảnh minh họa",H2),RLImage(O+"/_p.jpg",width=300,height=200),Paragraph("Ảnh trên chỉ mang tính chất minh họa cho sản phẩm được giao.",N),PageBreak(),Paragraph("Điều 4. Điều khoản chung",H2),Paragraph("Hợp đồng có hiệu lực kể từ ngày ký. Mọi tranh chấp sẽ được giải quyết bằng thương lượng; nếu không thành, sẽ đưa ra Tòa án có thẩm quyền.",N)]
SimpleDocTemplate(O+"/vi_contract.pdf",pagesize=A4).build(st)
EN=[Paragraph("Quarterly Report",H1),Paragraph("Summary",H2),Paragraph("Revenue grew 12% compared with the previous quarter, driven by strong demand for subscription plans and lower churn. Operating costs stayed flat.",N),Paragraph("Results by region",H2)]
t=Table([["Region","Q1","Q2","Change"],["North America","1,200","1,350","+12%"],["Europe","900","990","+10%"],["Asia","650","760","+17%"]]);t.setStyle(TableStyle([("FONT",(0,0),(-1,-1),"DV",10),("GRID",(0,0),(-1,-1),0.5,colors.grey)]))
SimpleDocTemplate(O+"/en_report.pdf",pagesize=A4).build(EN+[t,Spacer(1,10),RLImage(O+"/_p.jpg",width=240,height=160)])
# scan: page rendered to image, no text layer
sc=Image.new("RGB",(1240,1754),"white");d=ImageDraw.Draw(sc)
from PIL import ImageFont
f=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",34)
for i,l in enumerate(["BIÊN BẢN GIAO NHẬN","Ngày 30 tháng 10 năm 2026","Bên giao: Nguyễn Văn A","Bên nhận: Trần Thị B"]):d.text((120,150+i*70),l,fill="black",font=f)
sc.save(O+"/_scan.jpg",quality=85);from reportlab.pdfgen import canvas
c=canvas.Canvas(O+"/scan.pdf",pagesize=A4);c.drawImage(O+"/_scan.jpg",0,0,*A4);c.save()
for f in ("_p.jpg","_scan.jpg"):os.remove(O+"/"+f)
print("ok")
