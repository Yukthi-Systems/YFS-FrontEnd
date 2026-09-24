#!/bin/sh

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

# Writes runtime config from the container's environment so no URLs are baked into the image.
# The app reads it as window._env_.

cat > /app/dist/env-config.js <<EOF
window._env_ = {
  VITE_API_URL: "${VITE_API_URL:-}",
  VITE_SSO_URL: "${VITE_SSO_URL:-}",
  VITE_SSO_APP_ID: "${VITE_SSO_APP_ID:-}",
  VITE_STORAGE_URL: "${VITE_STORAGE_URL:-}",
  VITE_COLLABORA_URL: "${VITE_COLLABORA_URL:-}",
  VITE_COLLABORA_LOADER_URL: "${VITE_COLLABORA_LOADER_URL:-}",
};
EOF

exec "$@"
