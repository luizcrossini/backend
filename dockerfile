FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS=--dns-result-order=ipv4first

COPY package*.json ./
RUN npm install xlsx axios 

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/main.js"]
