# Managed by Veridian deployment automation.
map $http_upgrade $connection_upgrade___ENVIRONMENT__ {
  default upgrade;
  '' close;
}

include /etc/nginx/snippets/veridian___ENVIRONMENT___active_upstreams.conf;

server {
  listen 80;
  listen [::]:80;
  server_name
    keria.__PUBLIC_DOMAIN__
    keria-ext.__PUBLIC_DOMAIN__
    keria-boot.__PUBLIC_DOMAIN__
    cred-issuance.__PUBLIC_DOMAIN__
    cred-issuance-ui.__PUBLIC_DOMAIN__
    witness-0.__PUBLIC_DOMAIN__
    witness-1.__PUBLIC_DOMAIN__
    witness-2.__PUBLIC_DOMAIN__
    witness-3.__PUBLIC_DOMAIN__
    witness-4.__PUBLIC_DOMAIN__
    witness-5.__PUBLIC_DOMAIN__;

  location / {
    return 301 https://$host$request_uri;
  }
}

# Shared proxy headers
# TLS protocol/cipher policy is expected to come from the base nginx.conf.

add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header X-XSS-Protection "1; mode=block" always;

proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade___ENVIRONMENT__;
proxy_read_timeout 300s;

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name keria.__PUBLIC_DOMAIN__;

  ssl_certificate /etc/letsencrypt/live/__CERT_DOMAIN__/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/__CERT_DOMAIN__/privkey.pem;

  location / {
    proxy_pass http://keria_api___ENVIRONMENT__;
  }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name keria-ext.__PUBLIC_DOMAIN__;

  ssl_certificate /etc/letsencrypt/live/__CERT_DOMAIN__/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/__CERT_DOMAIN__/privkey.pem;

  location / {
    proxy_pass http://keria_ext___ENVIRONMENT__;
  }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name keria-boot.__PUBLIC_DOMAIN__;

  ssl_certificate /etc/letsencrypt/live/__CERT_DOMAIN__/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/__CERT_DOMAIN__/privkey.pem;

  location / {
    proxy_pass http://keria_boot___ENVIRONMENT__;
  }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name cred-issuance.__PUBLIC_DOMAIN__;

  ssl_certificate /etc/letsencrypt/live/__CERT_DOMAIN__/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/__CERT_DOMAIN__/privkey.pem;

  location / {
    proxy_pass http://cred_api___ENVIRONMENT__;
  }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name cred-issuance-ui.__PUBLIC_DOMAIN__;

  ssl_certificate /etc/letsencrypt/live/__CERT_DOMAIN__/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/__CERT_DOMAIN__/privkey.pem;

  location / {
    proxy_pass http://cred_ui___ENVIRONMENT__;
  }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name witness-0.__PUBLIC_DOMAIN__;

  ssl_certificate /etc/letsencrypt/live/__CERT_DOMAIN__/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/__CERT_DOMAIN__/privkey.pem;

  location / {
    proxy_pass http://witness_0___ENVIRONMENT__;
  }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name witness-1.__PUBLIC_DOMAIN__;

  ssl_certificate /etc/letsencrypt/live/__CERT_DOMAIN__/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/__CERT_DOMAIN__/privkey.pem;

  location / {
    proxy_pass http://witness_1___ENVIRONMENT__;
  }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name witness-2.__PUBLIC_DOMAIN__;

  ssl_certificate /etc/letsencrypt/live/__CERT_DOMAIN__/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/__CERT_DOMAIN__/privkey.pem;

  location / {
    proxy_pass http://witness_2___ENVIRONMENT__;
  }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name witness-3.__PUBLIC_DOMAIN__;

  ssl_certificate /etc/letsencrypt/live/__CERT_DOMAIN__/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/__CERT_DOMAIN__/privkey.pem;

  location / {
    proxy_pass http://witness_3___ENVIRONMENT__;
  }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name witness-4.__PUBLIC_DOMAIN__;

  ssl_certificate /etc/letsencrypt/live/__CERT_DOMAIN__/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/__CERT_DOMAIN__/privkey.pem;

  location / {
    proxy_pass http://witness_4___ENVIRONMENT__;
  }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name witness-5.__PUBLIC_DOMAIN__;

  ssl_certificate /etc/letsencrypt/live/__CERT_DOMAIN__/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/__CERT_DOMAIN__/privkey.pem;

  location / {
    proxy_pass http://witness_5___ENVIRONMENT__;
  }
}
