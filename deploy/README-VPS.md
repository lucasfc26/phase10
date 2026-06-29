# Deploy Phase 10 — cards.maselcorp.com.br

## Arquitetura

```
Internet → Nginx (443) → /        → frontend :5173
                       → /api/    → backend  :3001
                       → /socket.io/ → backend :3001 (WebSocket)
```

## 1. DNS

No painel do domínio `maselcorp.com.br`, crie:

| Tipo | Nome  | Valor        | TTL |
|------|-------|--------------|-----|
| A    | cards | IP_DO_VPS    | 300 |

Exemplo: `cards.maselcorp.com.br` → `2.24.99.211`

Aguarde alguns minutos e teste: `ping cards.maselcorp.com.br`

## 2. VPS — dependências

```bash
apt update && apt upgrade -y
apt install -y git nginx certbot python3-certbot-nginx docker.io docker-compose-plugin
systemctl enable docker nginx
```

## 3. Clonar e subir o projeto

```bash
cd /opt
git clone <URL_DO_SEU_REPO> phase10
cd phase10
docker compose up -d --build
```

Opcional (recomendado): exponha só em localhost editando `docker-compose.yml`:

```yaml
ports:
  - "127.0.0.1:3001:3001"   # backend
  - "127.0.0.1:5173:5173"   # frontend
```

## 4. Nginx

```bash
cp /opt/phase10/deploy/nginx/cards.maselcorp.com.br.conf /etc/nginx/sites-available/cards.maselcorp.com.br
ln -sf /etc/nginx/sites-available/cards.maselcorp.com.br /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## 5. SSL (Let's Encrypt)

```bash
certbot --nginx -d cards.maselcorp.com.br
```

O Certbot ajusta o bloco HTTPS automaticamente.

## 6. Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

Não é necessário abrir 5173/3001 publicamente se o nginx faz proxy.

## 7. Testar

- Site: https://cards.maselcorp.com.br
- API: https://cards.maselcorp.com.br/api/rooms
- Multiplayer online: criar sala e verificar WebSocket no DevTools (Network → WS)

## Atualizar após git pull

```bash
cd /opt/phase10
git pull
docker compose up -d --build
```

## Produção (opcional, mais performático)

Trocar Vite dev por build estático:

```bash
cd phase10-frontend
npm ci && npm run build
```

Sirva `dist/` pelo nginx (`root /opt/phase10/phase10-frontend/dist; try_files $uri /index.html;`) em vez de proxy para :5173.

Backend: use `npm run start:prod` no Dockerfile em vez de `start:dev`.
