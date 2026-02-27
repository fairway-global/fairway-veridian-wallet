ARG TARGETPLATFORM=linux/amd64
FROM --platform=$TARGETPLATFORM node:21.5.0 AS builder
WORKDIR /app
RUN apt update -qq && apt install -y build-essential && apt clean
COPY . .
RUN npm install --no-audit \
    --fetch-retries=6 \
    --fetch-retry-mintimeout=20000 \
    --fetch-retry-maxtimeout=180000 \
    --fetch-timeout=300000
RUN npm run build
CMD [ "npm", "start" ]
