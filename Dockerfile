# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy the whole workspace (npm workspaces needs every package.json to resolve)
COPY . .

# Install dependencies for all workspaces
RUN npm install

# Build only the web app
RUN npm run build -w @yfs/web


# Stage 2: Production image
FROM node:22-alpine

WORKDIR /app

# Install static server
RUN npm install -g serve
RUN apk add --no-cache wget

# Copy build output
COPY --from=builder /app/apps/web/dist /app/dist

# Copy env script
COPY env.sh /app/env.sh
RUN chmod +x /app/env.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:3000 || exit 1

ENTRYPOINT ["/app/env.sh"]

CMD ["serve", "-s", "dist", "-l", "3000"]
