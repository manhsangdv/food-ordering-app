FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY package*.json ./
RUN npm install --only=production
COPY . .
ENV NODE_ENV=production
ENV PORT=4001
EXPOSE 4001
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","server.js"]
