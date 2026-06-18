# ----------------------------------------------------------------------------
# Atlas Tekstil — Dockerfile
# Yengil va xavfsiz production image
# ----------------------------------------------------------------------------
FROM node:20-alpine

# Ishchi katalog
WORKDIR /usr/src/app

# Avval faqat package fayllarini ko'chiramiz (Docker layer keshidan foydalanish uchun)
COPY package*.json ./

# Faqat production bog'liqliklarini o'rnatamiz
RUN npm install --omit=dev

# Qolgan kodni ko'chiramiz
COPY . .

# root bo'lmagan foydalanuvchi ostida ishlaymiz (xavfsizlik)
RUN addgroup -S app && adduser -S app -G app \
    && chown -R app:app /usr/src/app
USER app

# Ilova porti
ENV PORT=3000
EXPOSE 3000

# Konteyner salomatligini tekshirish
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/health || exit 1

CMD ["node", "server.js"]
