FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

RUN DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rtm_telecom_app \
    npx prisma generate --schema=prisma/schema.prisma

ENV NODE_ENV=production

EXPOSE 3001

CMD ["npm", "run", "start"]
