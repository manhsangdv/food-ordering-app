FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY package*.json ./
RUN npm install --only=production
COPY . .
ENV NODE_ENV=production
ENV PORT=4004
EXPOSE 4004
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","server.js"]
