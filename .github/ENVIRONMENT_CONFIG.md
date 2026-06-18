# Environment Configuration Guide

## Local Development

Use with: `docker-compose -f docker-compose.dev.yml up`

```bash
PORT=3000
NODE_ENV=development
ADMIN_USER=admin
ADMIN_PASS=admin123
TOKEN_SECRET=local-dev-secret-change-me
```

## Production (AWS EC2)

Use with: `docker-compose up` (CI/CD manages this)

### Required Environment Variables

```bash
PORT=3000
NODE_ENV=production
ADMIN_USER=<change-from-default>
ADMIN_PASS=<change-from-default>
TOKEN_SECRET=<generate-secure-random-string>
```

### Secure Token Secret Generation

Generate a secure token secret:

```bash
# Option 1: Using OpenSSL
openssl rand -base64 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

## Setting Environment Variables on EC2

### Method 1: Docker Compose Environment File

Create `.env` file in `/home/ec2-user/app/`:

```bash
PORT=3000
NODE_ENV=production
ADMIN_USER=myusername
ADMIN_PASS=mysecurepassword
TOKEN_SECRET=abc123...
```

Then in `docker-compose.yml`:

```yaml
services:
  shop:
    env_file:
      - .env
```

### Method 2: AWS Secrets Manager (Recommended)

Store secrets in AWS Secrets Manager and retrieve in EC2:

```bash
# Create secret in AWS
aws secretsmanager create-secret \
  --name atlas-tekstil/prod \
  --secret-string '{"ADMIN_USER":"user","ADMIN_PASS":"pass","TOKEN_SECRET":"secret"}'

# Retrieve in script
aws secretsmanager get-secret-value \
  --secret-id atlas-tekstil/prod \
  --query SecretString \
  --output text
```

### Method 3: GitHub Secrets + CI/CD (For Images)

If you want to bake secrets into the Docker image (NOT RECOMMENDED), you can pass them during build:

```dockerfile
ARG ADMIN_USER
ARG ADMIN_PASS
ENV ADMIN_USER=$ADMIN_USER
ENV ADMIN_PASS=$ADMIN_PASS
```

**⚠️ WARNING**: Never commit secrets to Docker images!

## EC2 Setup Script

After EC2 instance is running and Docker is installed:

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Create app directory
mkdir -p /home/ec2-user/app
cd /home/ec2-user/app

# Create .env file with secure values
cat > .env << EOF
PORT=3000
NODE_ENV=production
ADMIN_USER=$(openssl rand -hex 8)
ADMIN_PASS=$(openssl rand -base64 16)
TOKEN_SECRET=$(openssl rand -base64 32)
EOF

# Set permissions
chmod 600 .env

# Verify (won't show actual values)
cat .env
```

## GitHub Actions CI/CD Environment

The CI/CD workflow passes image tag to EC2:

```bash
# In deploy.yml
docker-compose.yml gets updated with:
ECR_REGISTRY/atlas-tekstil:SHA_COMMIT
```

## Switching Between Configurations

### For Development
```bash
# Use dev compose with local build
docker-compose -f docker-compose.dev.yml up

# Watch logs
docker-compose -f docker-compose.dev.yml logs -f
```

### For Testing Production Build Locally
```bash
# Build production image
docker build -t atlas-tekstil:latest .

# Update docker-compose.yml image reference
# Then run
docker-compose up
```

### For EC2 Production
```bash
# CI/CD automatically updates image to ECR
# Just run:
docker-compose pull
docker-compose up -d
```

## Debugging Environment Issues

### Check Current Environment
```bash
# Inside container
docker exec atlas-tekstil env | sort

# From host
docker-compose config
```

### Common Environment Issues

1. **Port Already in Use**
   ```bash
   # Change port mapping in docker-compose.yml
   ports:
     - "3001:3000"
   ```

2. **Missing Environment Variables**
   ```bash
   # Check .env file exists and is loaded
   docker-compose config | grep ADMIN_USER
   ```

3. **Secrets Exposed in Logs**
   ```bash
   # Redact sensitive output
   docker-compose logs | sed 's/[A-Za-z0-9]\{20,\}/***REDACTED***/g'
   ```

## Security Best Practices for Environment Variables

✅ **DO**:
- Use strong passwords (20+ characters, mixed case, numbers, symbols)
- Rotate secrets regularly
- Use AWS Secrets Manager for production
- Keep `.env` files out of git (add to .gitignore)
- Use environment variables for ALL secrets
- Log and monitor access to sensitive data

❌ **DON'T**:
- Hardcode secrets in application code
- Commit .env files to repository
- Use same secrets across environments
- Store secrets in Docker images
- Share secrets via email or chat
- Expose secrets in logs

## Example Production Setup

```bash
# Generate secure values
ADMIN_USER="admin_$(openssl rand -hex 8)"
ADMIN_PASS="$(openssl rand -base64 24)"
TOKEN_SECRET="$(openssl rand -base64 32)"

echo "User: $ADMIN_USER"
echo "Pass: $ADMIN_PASS"
echo "Token: $TOKEN_SECRET"

# Store securely
aws secretsmanager create-secret \
  --name atlas-tekstil-prod \
  --secret-string "{
    \"ADMIN_USER\": \"$ADMIN_USER\",
    \"ADMIN_PASS\": \"$ADMIN_PASS\",
    \"TOKEN_SECRET\": \"$TOKEN_SECRET\"
  }"
```

## References

- [Docker Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [Node.js Security](https://nodejs.org/en/docs/guides/security/)
