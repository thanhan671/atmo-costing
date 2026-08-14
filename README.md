# ATMO Costing - Supabase + GitHub Pages

Web quản lý giá sản phẩm in 3D, đồng bộ dữ liệu giữa PC/điện thoại thông qua Supabase.

## 1. Tạo Supabase project
1. Tạo project mới trong Supabase.
2. Mở **SQL Editor** và chạy toàn bộ `supabase/schema.sql`.
3. Vào **Project Settings → API** lấy:
   - Project URL
   - anon/public key
4. Điền hai giá trị vào `config.js`.

> Chỉ dùng **anon/public key** ở frontend. Không bao giờ đưa `service_role` key vào GitHub hoặc trình duyệt.

## 2. Authentication
Trong Supabase → Authentication → Providers → Email, bật Email. Có thể bật/tắt email confirmation tùy nhu cầu.

Nếu bật email confirmation, thêm URL GitHub Pages của bạn vào Authentication → URL Configuration → Redirect URLs.

## 3. Deploy GitHub Pages
1. Tạo repository GitHub và đưa toàn bộ thư mục này lên nhánh `main`.
2. Repository → Settings → Pages → Source: **GitHub Actions**.
3. Push lên `main`. Workflow `.github/workflows/pages.yml` sẽ deploy tự động.

## 4. Dữ liệu
- `materials`: nguyên vật liệu của từng user.
- `products`: công thức/mẻ PEI, nhựa/phụ kiện/bao bì và hậu xử lý.
- `app_settings`: giá điện, công suất, khấu hao máy, phí kênh, lợi nhuận.
- RLS đảm bảo mỗi user chỉ truy cập dữ liệu của chính mình.

## 5. Backup
Trong web có **Xuất JSON** và **Nhập JSON**. File JSON có thể dùng để backup hoặc chuyển dữ liệu từ bản local cũ.
