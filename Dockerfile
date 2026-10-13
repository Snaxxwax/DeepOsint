FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 poppler-utils tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && mkdir -p /app/data && chown -R node:node /app
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data
EXPOSE 3000
CMD ["npm", "start"]
