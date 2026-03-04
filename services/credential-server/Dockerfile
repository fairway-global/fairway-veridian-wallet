ARG TARGETPLATFORM=linux/amd64
FROM --platform=$TARGETPLATFORM node:21.5.0 AS builder
WORKDIR /app
RUN apt update -qq && apt install -y --no-install-recommends build-essential git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" \
    && git config --global url."https://github.com/".insteadOf "git@github.com:"
RUN npm config set fetch-retries 6 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 180000 \
    && npm config set fetch-timeout 300000
COPY package*.json ./
RUN set -eux; \
    success=0; \
    for attempt in 1 2 3; do \
      if npm ci --no-audit \
        --fetch-retries=6 \
        --fetch-retry-mintimeout=20000 \
        --fetch-retry-maxtimeout=180000 \
        --fetch-timeout=300000; then \
        success=1; \
        break; \
      fi; \
      echo "npm ci failed (attempt ${attempt}), retrying..."; \
      sleep $((attempt * 20)); \
    done; \
    test "$success" -eq 1
COPY . .
RUN npm run build
CMD [ "npm", "start" ]
