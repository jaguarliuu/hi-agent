# CNB Server Deploy Runbook Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Document the manual and repository steps needed to deploy Hi-Agent from CNB cloud-native builds to a Docker Compose service on a server.

**Architecture:** CNB builds and pushes a Docker image from the repository Dockerfile, then deploys by SSHing into the server and running `docker compose pull && docker compose up -d`. The server runs the app container on a localhost-only port, while the existing host Caddy reverse-proxies public HTTPS traffic to that local container port.

**Tech Stack:** CNB cloud-native build, Docker, Docker Compose, Caddy, OpenSSH, Next.js static export, existing Caddy-based container image

---

## Deployment Shape

The target flow is:

```txt
push main
  -> CNB runs tests/build
  -> CNB builds Docker image
  -> CNB pushes image to CNB artifact registry
  -> Manual or configured production deploy stage SSHs into the server
  -> Server pulls the new image
  -> Server restarts the Docker Compose service
  -> Host Caddy reverse-proxies the public domain to the local container port
```

Recommended runtime shape on the server:

```txt
Internet
  -> host Caddy :443
  -> reverse_proxy 127.0.0.1:8080
  -> Docker Compose service hi-agent
  -> container port 80
```

The container already uses the repository `Dockerfile` and `docker/Caddyfile` to serve the static export with WebContainer-required COOP/COEP headers.

## Files To Add Later

Repository deployment files should be added in a follow-up implementation task:

```txt
deploy/docker-compose.yml
deploy/README.md
.cnb.yml
```

Suggested `deploy/docker-compose.yml`:

```yaml
services:
  hi-agent:
    image: ${HI_AGENT_IMAGE}
    container_name: hi-agent
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:80"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1/"]
      interval: 30s
      timeout: 5s
      retries: 3
```

Suggested server `.env` file at `/opt/hi-agent/.env`:

```env
HI_AGENT_IMAGE=cnb.cool/jaguarliu.cool/hi-agent:latest
```

Replace the image value with the exact CNB artifact image name once the build pipeline is confirmed.

## Server Preparation

Run these commands on the server.

Create the deploy directory:

```bash
sudo mkdir -p /opt/hi-agent
sudo chown -R "$USER":"$USER" /opt/hi-agent
cd /opt/hi-agent
```

Create `/opt/hi-agent/docker-compose.yml` from the repository `deploy/docker-compose.yml` once that file exists.

Create `/opt/hi-agent/.env`:

```bash
cat > /opt/hi-agent/.env <<'EOF'
HI_AGENT_IMAGE=cnb.cool/jaguarliu.cool/hi-agent:latest
EOF
```

Verify Docker and Compose:

```bash
docker --version
docker compose version
```

Expected:

- Docker command exists.
- `docker compose version` prints a Compose v2 version.

## Host Caddy Configuration

The host Caddy should terminate HTTPS and proxy to the local container port.

Example Caddy site:

```caddyfile
your-domain.com {
  reverse_proxy 127.0.0.1:8080
}
```

After editing the host Caddyfile:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

If Caddy is managed by a panel, apply the equivalent validation/reload through the panel.

## Create The CNB Deploy SSH Key

Create a dedicated deploy key pair on your local machine. Do not reuse your personal daily SSH key.

```bash
ssh-keygen -t ed25519 -C "cnb-hi-agent-deploy" -f cnb_hi_agent_deploy
```

This creates:

```txt
cnb_hi_agent_deploy       # private key, copy into CNB secret only
cnb_hi_agent_deploy.pub   # public key, install on server
```

Show the public key:

```bash
cat cnb_hi_agent_deploy.pub
```

Copy the full output.

## Install The Public Key On The Server

Log in to the server as the deploy user.

Append the public key:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "PASTE_CNB_HI_AGENT_DEPLOY_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Optional but recommended: use a dedicated Linux user such as `deploy`.

If using a dedicated deploy user, make sure it can run Docker:

```bash
sudo usermod -aG docker deploy
```

Then log out and log back in for the group change to take effect.

Verify the deploy user can run:

```bash
docker ps
docker compose version
```

## Add CNB Secret Variables

Show the private key on your local machine:

```bash
cat cnb_hi_agent_deploy
```

Copy the complete private key, including:

```txt
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

Create CNB secret variables:

```txt
DEPLOY_HOST=your.server.ip.or.domain
DEPLOY_USER=deploy
DEPLOY_SSH_KEY=<complete private key content>
```

Important:

- Never commit `cnb_hi_agent_deploy`.
- Never commit `cnb_hi_agent_deploy.pub` unless intentionally documenting a public key, which is not necessary here.
- Store `DEPLOY_SSH_KEY` only in CNB secrets or a CNB secret repository.

## Local SSH Verification

From your local machine, verify the dedicated key can log in:

```bash
ssh -i cnb_hi_agent_deploy DEPLOY_USER@DEPLOY_HOST "docker ps && cd /opt/hi-agent && docker compose config"
```

Expected:

- SSH login succeeds.
- `docker ps` succeeds.
- `docker compose config` prints the resolved Compose configuration.

If this fails, fix SSH, Docker group permissions, or `/opt/hi-agent` ownership before wiring CNB deployment.

## CNB Pipeline Shape

The future `.cnb.yml` deployment shape should have two parts:

1. `main.push`: test, build, Docker build, Docker push.
2. `tag_deploy.production` or a dedicated deploy stage: SSH to server and restart Compose.

Sketch:

```yaml
main:
  push:
    - name: build-and-push-image
      services:
        - docker
      stages:
        - name: docker build
          script: docker build -t "$IMAGE_TAG" .
        - name: docker push
          script: docker push "$IMAGE_TAG"

tag_deploy:
  production:
    - name: deploy-production
      docker:
        image: alpine:3.20
      stages:
        - name: install ssh
          script: apk add --no-cache openssh-client
        - name: deploy
          script: |
            mkdir -p ~/.ssh
            echo "$DEPLOY_SSH_KEY" > ~/.ssh/id_ed25519
            chmod 600 ~/.ssh/id_ed25519
            ssh -o StrictHostKeyChecking=no "$DEPLOY_USER@$DEPLOY_HOST" "
              cd /opt/hi-agent &&
              docker compose pull &&
              docker compose up -d &&
              docker image prune -f
            "
```

Use the exact CNB registry variables after confirming the CNB image tag format in the build logs.

## First Manual Deployment Test

After CNB has pushed an image, run this on the server:

```bash
cd /opt/hi-agent
docker compose pull
docker compose up -d
docker compose ps
curl -I http://127.0.0.1:8080
```

Expected:

- Compose service is running.
- `curl -I` returns HTTP 200 or a valid static route response.
- Headers include WebContainer requirements from the container Caddy:
  - `Cross-Origin-Embedder-Policy`
  - `Cross-Origin-Opener-Policy`

Then test the public domain:

```bash
curl -I https://your-domain.com
```

Expected:

- HTTPS works.
- Reverse proxy reaches the app.

## Rollback Strategy

For V1, keep rollback simple:

1. Tag images with both `latest` and commit SHA.
2. Keep the last known good commit SHA.
3. Change `/opt/hi-agent/.env`:

```env
HI_AGENT_IMAGE=cnb.cool/jaguarliu.cool/hi-agent:<previous-good-sha>
```

4. Restart:

```bash
cd /opt/hi-agent
docker compose pull
docker compose up -d
```

## Security Notes

- Use a dedicated deploy SSH key.
- Use a dedicated deploy user when possible.
- Do not expose container port publicly; bind to `127.0.0.1:8080`.
- Keep public HTTPS and certificates in host Caddy.
- Keep private key only in CNB secrets.
- Consider disabling password SSH login after key deployment works.

## Tomorrow Checklist

- [ ] Generate `cnb_hi_agent_deploy` key pair locally.
- [ ] Add `cnb_hi_agent_deploy.pub` to server deploy user's `authorized_keys`.
- [ ] Verify SSH login with `ssh -i cnb_hi_agent_deploy`.
- [ ] Create `/opt/hi-agent`.
- [ ] Add `/opt/hi-agent/docker-compose.yml`.
- [ ] Add `/opt/hi-agent/.env`.
- [ ] Configure host Caddy reverse proxy to `127.0.0.1:8080`.
- [ ] Add `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` to CNB.
- [ ] Add repository deployment files and update `.cnb.yml`.
- [ ] Run first CNB build and image push.
- [ ] Run first server deployment.
