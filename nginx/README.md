# nginx — production reverse proxy

This directory holds the production nginx configuration and TLS material.

## Layout

```
nginx/
├── nginx.conf        # mounted into the container at /etc/nginx/nginx.conf
├── certs/            # mounted at /etc/nginx/certs (read-only)
│   ├── fullchain.pem # NOT in git — provide at deploy time
│   ├── privkey.pem   # NOT in git — provide at deploy time
│   └── .gitkeep
└── README.md
```

## Obtaining certificates

The container expects `fullchain.pem` and `privkey.pem` in `nginx/certs/`.
Anything that emits those two files works. The two paved paths:

1. **Let's Encrypt via [certbot](https://certbot.eff.org/)** — run
   `certbot certonly --webroot -w /var/www/certbot -d your.domain` on the host
   and symlink/copy the resulting `live/your.domain/{fullchain,privkey}.pem`
   into `nginx/certs/`. The HTTPS server includes an ACME challenge passthrough
   under `/.well-known/acme-challenge/`.
2. **Cloud-managed certs** (ACM, GCP, Cloudflare Origin) — drop the issued
   PEMs into `nginx/certs/` with the expected filenames.

For local production smoke-tests, generate a self-signed pair:

```sh
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout nginx/certs/privkey.pem \
  -out    nginx/certs/fullchain.pem \
  -subj "/CN=localhost"
```

Real certificates must never be committed; `nginx/certs/.gitkeep` keeps the
directory tracked while `*.pem` stays ignored.
