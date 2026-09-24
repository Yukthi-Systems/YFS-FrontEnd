# Copyright (C) 2026 Yukthi Systems Private Limited
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License version 3
# as published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# version 3 along with this program. If not, see
# <https://www.gnu.org/licenses/>.

# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy the whole workspace (npm workspaces needs every package.json to resolve)
COPY . .

# Install dependencies for all workspaces
RUN npm install

# Build only the web app. URLs are injected at container start by env.sh, not baked in.
RUN npm run build -w @yfs/web


# Stage 2: Production image
FROM node:22-alpine

WORKDIR /app

# Install static server
RUN npm install -g serve
RUN apk add --no-cache wget

# Copy build output
COPY --from=builder /app/apps/web/dist /app/dist

# Writes dist/env-config.js from the container environment on start
COPY env.sh /app/env.sh
RUN chmod +x /app/env.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:3000 || exit 1

ENTRYPOINT ["/app/env.sh"]

CMD ["serve", "-s", "dist", "-l", "3000"]
