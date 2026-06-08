# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build project
RUN npm run build


# Stage 2: Production image
FROM node:22-alpine

WORKDIR /app

# Install static server
RUN npm install -g serve
RUN apk add --no-cache wget

# Copy build output
COPY --from=builder /app/dist /app/dist

# Copy env script
COPY env.sh /app/env.sh
RUN chmod +x /app/env.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:3000 || exit 1

ENTRYPOINT ["/app/env.sh"]

CMD ["serve", "-s", "dist", "-l", "3000"]
