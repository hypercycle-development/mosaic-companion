FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY dist/ ./dist/
RUN npm install --production 2>/dev/null || true
ENV NODE_ENV=production
EXPOSE 8080
ENTRYPOINT ["node", "./dist/index.js"]
