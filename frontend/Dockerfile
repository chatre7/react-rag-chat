# frontend/Dockerfile
FROM node:20-slim

WORKDIR /app

COPY package.json vite.config.js ./
COPY index.html ./
COPY public ./public
COPY src ./src

RUN npm install && npm run build

EXPOSE 5173

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
