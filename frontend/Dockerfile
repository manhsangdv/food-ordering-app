# Stage 1: Build React App
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Build app
RUN npm run build

# Stage 2: Serve App với Nginx
FROM nginx:alpine
# Copy code đã build từ stage 1 vào thư mục public của Nginx
COPY --from=build /app/dist /usr/share/nginx/html
# Expose port 80 (default của Nginx)
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]