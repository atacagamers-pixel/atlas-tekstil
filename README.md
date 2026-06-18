# Atlas Tekstil — Bulutda joylashtiriladigan ulgurji kiyim do‘koni

Ulgurji kiyim-kechak kompaniyasi uchun **do‘kon (shopping panel)** va **admin panel**ni o‘z ichiga olgan to‘liq veb-ilova. NodeJS (Express) backend, vanilla HTML/CSS/JS frontend, Docker konteyner va AWSga deploy uchun tayyor.

Bu loyiha bulut tarmoq topshirig‘ingizdagi *“dinamik veb-saytni bulutda joylashtirish”*, *“Load Balancer / auto-scaling”* va *“CI/CD”* talablarini amalda namoyish qilish uchun mo‘ljallangan.

---

## 1. Imkoniyatlar

**Do‘kon paneli (`/`)**
- Mahsulotlar katalogi, turkum bo‘yicha filtrlash
- Savatcha (qo‘shish, sonni o‘zgartirish, o‘chirish)
- Buyurtmani rasmiylashtirish (zaxira serverda tekshiriladi)

**Admin paneli (`/admin`)**
- Login orqali kirish (token asosida)
- Boshqaruv paneli: mahsulotlar soni, buyurtmalar, tushum, kam zaxira
- Mahsulot CRUD (qo‘shish, tahrirlash, o‘chirish)
- Buyurtmalarni ko‘rish va holatini yangilash

**Texnik**
- `GET /health` — AWS Load Balancer / ECS salomatlik tekshiruvi uchun
- Stateless HMAC token (qo‘shimcha kutubxonasiz, ko‘p instansiyada ishlaydi)
- Docker image `node:20-alpine` asosida, root bo‘lmagan foydalanuvchi ostida

---

## 2. Lokal ishga tushirish

### Node bilan
```bash
npm install
npm start
# Do‘kon:  http://localhost:3000/
# Admin:   http://localhost:3000/admin   (admin / admin123)
```

### Docker bilan
```bash
docker build -t atlas-shop .
docker run -p 3000:3000 atlas-shop
```

### Docker Compose bilan
```bash
docker compose up --build
```

---

## 3. Muhit o‘zgaruvchilari

| O‘zgaruvchi | Tavsif | Standart qiymat |
|---|---|---|
| `PORT` | Ilova porti | `3000` |
| `ADMIN_USER` | Admin login | `admin` |
| `ADMIN_PASS` | Admin parol | `admin123` |
| `TOKEN_SECRET` | Token imzolash siri | (o‘zgartiring) |

Production da `ADMIN_PASS` va `TOKEN_SECRET` ni albatta o‘zgartiring.

---

## 4. AWSga deploy qilish

Quyida ikki yo‘l keltirilgan. Topshiriq uchun **B variant (ECS Fargate + ALB)** load balancing va auto-scaling’ni ko‘rsatishga eng mos.

### A variant — eng tez yo‘l (AWS App Runner)
1. Kodni GitHub repozitoriyga yuklang.
2. AWS konsolida **App Runner → Create service → Source: GitHub** ni tanlang.
3. Build: `Dockerfile`, Port: `3000` deb belgilang.
4. Muhit o‘zgaruvchilarini (`ADMIN_PASS`, `TOKEN_SECRET`) qo‘shing.
5. Deploy. App Runner avtomatik HTTPS URL va auto-scaling beradi.

### B variant — ECR + ECS Fargate + Application Load Balancer

**1-qadam. Image’ni ECR ga yuklash**
```bash
# O'zgaruvchilar
export AWS_REGION=eu-central-1
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export REPO=atlas-shop

# ECR repozitoriy yaratish
aws ecr create-repository --repository-name $REPO --region $AWS_REGION

# ECR ga kirish
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Image qurish, teglash va push qilish
docker build -t $REPO .
docker tag $REPO:latest $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO:latest
docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO:latest
```

**2-qadam. Tarmoq (topshiriqdagi dizaynga mos)**
- VPC ichida ikkita **public subnet** (ALB uchun) va ikkita **private subnet** (vazifalar uchun) yarating.
- Internet Gateway va NAT Gateway ni sozlang.

**3-qadam. ECS klaster va xizmat**
- ECS klaster (Fargate) yarating.
- Task definition: image — yuqoridagi ECR URL, port — `3000`, muhit o‘zgaruvchilari qo‘shing.
- Service yarating va uni **Application Load Balancer** ga ulang.
  - Target group **health check path**: `/health`
  - Listener: 80 (yoki ACM sertifikati bilan 443)

**4-qadam. Auto-scaling (topshiriq uchun muhim)**
- ECS Service → **Auto Scaling** → Target tracking.
- Metrika: `ECSServiceAverageCPUUtilization`, maqsad: `70%`.
- Min: 2, Max: 6 vazifa.
- Yuklama testi (masalan, `hey` yoki `ab`) bilan auto-scaling’ni namoyish eting:
  ```bash
  hey -z 60s -c 100 http://<ALB-DNS-nomi>/
  ```

---

## 5. CI/CD (ixtiyoriy, topshiriq uchun)

`.github/workflows/deploy.yml` namunasi: kod push qilinganda image qurib, ECR ga yuklab, ECS xizmatini yangilash. README ning oxiridagi izohga qarang yoki GitHub Actions `aws-actions/amazon-ecs-deploy-task-definition` action’idan foydalaning.

---

## 6. Muhim eslatma — ma'lumotlarni saqlash

Bu demo mahsulot va buyurtmalarni **JSON fayllarda** (`data/`) saqlaydi. Bu bitta konteyner uchun yetarli, biroq:

- Ko‘p instansiyali (auto-scaling) muhitda har bir konteyner o‘z faylига ega bo‘ladi — holat birlashmaydi.
- Konteyner qayta ishga tushganda ma'lumot yo‘qoladi.

**Production / topshiriqdagi “yaxshilanish” bosqichi uchun tavsiya:** ma'lumotlarni **Amazon RDS (PostgreSQL)** yoki **DynamoDB** ga ko‘chiring. Shunda barcha instansiyalar umumiy, barqaror ma'lumotlar bazasidan foydalanadi. Bu aynan topshiriqdagi *“tarmoq yaxshilanishlari”* va *“kengayuvchanlik”* mezonlarini qoplaydi.

---

## 7. Loyiha tuzilmasi

```
clothing-cloud-shop/
├── server.js              # Express: API + statik fayllar + /health
├── package.json
├── data/
│   ├── db.js              # JSON fayl ombori
│   ├── products.json
│   └── orders.json
├── public/
│   ├── index.html         # Do‘kon
│   ├── admin.html         # Admin panel
│   ├── css/styles.css
│   └── js/{shop.js, admin.js}
├── Dockerfile
├── .dockerignore
├── docker-compose.yml
└── .env.example
```
