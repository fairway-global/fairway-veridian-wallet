ARG TARGETPLATFORM=linux/amd64
FROM --platform=$TARGETPLATFORM node:21.5.0 AS builder
ARG NPM_REGISTRY=https://registry.npmjs.org/
WORKDIR /app
RUN set -eux; \
    apt-get update -qq; \
    apt-get install -y --no-install-recommends build-essential git ca-certificates; \
    rm -rf /var/lib/apt/lists/*
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" \
    && git config --global url."https://github.com/".insteadOf "git@github.com:"
RUN npm config set registry "${NPM_REGISTRY}" \
    && npm config set fetch-retries 2 \
    && npm config set fetch-retry-mintimeout 3000 \
    && npm config set fetch-retry-maxtimeout 20000 \
    && npm config set fetch-timeout 120000
COPY package*.json ./
RUN set -eux; \
    npm ping --registry="${NPM_REGISTRY}"; \
    git ls-remote https://github.com/WebOfTrust/signify-ts.git HEAD >/dev/null; \
    success=0; \
    for attempt in 1 2; do \
      if npm ci --no-audit \
        --fetch-retries=2 \
        --fetch-retry-mintimeout=3000 \
        --fetch-retry-maxtimeout=20000 \
        --fetch-timeout=120000; then \
        success=1; \
        break; \
      fi; \
      echo "npm ci failed (attempt ${attempt}) using ${NPM_REGISTRY}; retrying in 10s..."; \
      sleep 10; \
    done; \
    test "$success" -eq 1
COPY . .
RUN npm run build
CMD [ "npm", "start" ]
