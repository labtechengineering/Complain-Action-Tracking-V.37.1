แก้ HTML_PAGE_MISMATCH และ Dashboard ไม่โหลดข้อมูล

อัปโหลดทับที่ ROOT ของ GitHub Repository เดิมเฉพาะ 4 ไฟล์:
- supabase-api.js
- dashboard.html
- index.html
- create.html

สิ่งที่แก้:
1. หน้าแรก index.html เปิด Dashboard ตาม V38
2. QA.pageUrl(create) เปิด create.html ไม่ย้อนกลับ index.html
3. เปิดหน้าแรกในชื่อ / หรือ index.html ให้ตรงกับ Dashboard
4. Dashboard และหน้าแจ้งงานโหลด API รุ่นใหม่เพื่อเลี่ยงแคชเก่า

ไม่ได้เปลี่ยน Supabase, SQL, LINE, ฟอร์ม หรือ Dashboard chart logic
หลัง Commit กด Ctrl+Shift+R แล้วเปิด dashboard.html อีกครั้ง
ถ้าตัวเลขยังว่าง ให้ส่งข้อความ Error ที่เห็น ไม่ต้องรัน SQL เพิ่ม
