# GitHub Environments Setup

## Overview

This project uses GitHub Environments for storing deployment secrets per environment.

## Staging Environment

1. Go to Repository Settings → Environments
2. Click "New environment" → Name: `staging`
3. Add required secrets:

| Secret | Description | Example |
|--------|-------------|---------|
| STAGING_HOST | Server IP or domain | `staging.yourdomain.com` |
| STAGING_USER | SSH username | `deploy` |
| STAGING_SSH_KEY | Private SSH key | `-----BEGIN OPENSSH...` |
| STAGING_SSH_PORT | SSH port (optional) | `22` |
| STAGING_DATABASE_URL | MySQL connection | `mysql://user:pass@host:3306/db` |

## Production Environment

1. Go to Repository Settings → Environments
2. Click "New environment" → Name: `production`
3. Add required secrets:

| Secret | Description | Example |
|--------|-------------|---------|
| PRODUCTION_HOST | Server IP or domain | `yourdomain.com` |
| PRODUCTION_USER | SSH username | `deploy` |
| PRODUCTION_SSH_KEY | Private SSH key | `-----BEGIN OPENSSH...` |
| PRODUCTION_SSH_PORT | SSH port (optional) | `22` |
| PRODUCTION_DATABASE_URL | MySQL connection | `mysql://user:pass@host:3306/db` |

## SSH Key Setup

### 1. Generate SSH Key (on your local machine)

```bash
ssh-keygen -t ed25519 -C "deploy@github-actions" -f ~/.ssh/github_actions
```

### 2. Add public key to server

```bash
# Method 1: Using ssh-copy-id
ssh-copy-id -i ~/.ssh/github_actions.pub deploy@staging-server

# Method 2: Manual
cat ~/.ssh/github_actions.pub | ssh deploy@staging-server "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### 3. Add private key to GitHub Secrets

```bash
# View private key content -s
cat ~/.ssh/github_actions
```

Copy the entire output including:
- `-----BEGIN OPENSSH PRIVATE KEY-----`
- `-----END OPENSSH PRIVATE KEY-----`

Go to GitHub → Repository Settings → Secrets → Actions:
- Add new Secret: `STAGING_SSH_KEY` (paste private key content)
- Add new Secret: `PRODUCTION_SSH_KEY` (paste private key content)

### 4. Server Requirements

- SSH key authentication enabled
- User must have sudo access
- Supervisor installed
- App directory at `/opt/core-bridge-pos`

## Environment Variables on Server

Set these in `/etc/environment` or create `.env` file:

```bash
NODE_ENV=production
PORT=3000
RABBITMQ_URL=amqp://user:pass@host:5672
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASS=secret
WEBHOOK_TIMEOUT_MS=10000
WEBHOOK_RETRY_DELAYS=5000,15000,45000
WEBHOOK_MAX_RETRIES=3
TRUST_PROXY=true
allowedOrigins=https://your-domain.com
```

## Troubleshooting SSH Connection

### Test SSH Connection

```bash
# From your local machine
ssh -i ~/.ssh/github_actions deploy@staging-server
```

### Common Issues

1. **Connection refused**: Check firewall settings
2. **Permission denied**: Verify SSH key is added to server
3. **Connection timeout**: Check STAGING_HOST is correct

### Verify SSH Key Works

```bash
# Test without password
ssh -i ~/.ssh/github_actions -o BatchMode=yes deploy@staging-server "echo 'SSH works!'"
```

If successful, you should see "SSH works!" output.
