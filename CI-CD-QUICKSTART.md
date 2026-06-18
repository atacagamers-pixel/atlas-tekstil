# Quick Start: CI/CD Deployment to AWS EC2

## Installation Complete ✓

GitHub CLI (`gh`), AWS CLI (`aws`), and Git are now available.

## What Was Set Up

### Files Created:
- `.github/workflows/deploy.yml` - GitHub Actions CI/CD workflow
- `.github/DEPLOYMENT_SETUP.md` - Detailed setup guide
- `.github/setup-cicd.sh` - Automated setup script
- `docker-compose.dev.yml` - Development Docker Compose config
- `docker-compose.yml` - Production Docker Compose config (updated)

## Quick Setup (3 Steps)

### Step 1: Login with GitHub CLI
```bash
gh auth login
```
Follow the prompts to authenticate with GitHub.

### Step 2: Verify AWS Configuration
```bash
aws configure  # If not already configured
aws sts get-caller-identity  # Verify your credentials
```

### Step 3: Run Automated Setup Script
```bash
chmod +x .github/setup-cicd.sh
./.github/setup-cicd.sh
```

The script will:
1. Create ECR repository
2. Configure GitHub secrets (AWS credentials, EC2 details, SSH key)
3. Test EC2 connection
4. Setup application directory on EC2
5. Update workflow configuration

## Manual Setup (If Preferred)

### Create ECR Repository
```bash
aws ecr create-repository \
  --repository-name atlas-tekstil \
  --region us-east-1
```

### Set GitHub Secrets via CLI
```bash
# AWS Credentials (get from IAM)
gh secret set AWS_ACCESS_KEY_ID --body "YOUR_KEY_ID"
gh secret set AWS_SECRET_ACCESS_KEY --body "YOUR_SECRET"

# EC2 Details
gh secret set EC2_INSTANCE_IP --body "your.ec2.ip"
gh secret set EC2_USER --body "ec2-user"  # or ubuntu
gh secret set EC2_SSH_KEY --body "$(cat ~/.ssh/your-key.pem)"
```

### Or Set via GitHub Web UI
1. Go to Repository → Settings → Secrets and variables → Actions
2. Add these secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `EC2_INSTANCE_IP`
   - `EC2_USER`
   - `EC2_SSH_KEY`

## After Setup

### 1. Commit and Push
```bash
git add .
git commit -m "chore: add CI/CD setup for AWS deployment"
git push origin main
```

### 2. Trigger First Deployment
Any push to `main` branch will automatically trigger the workflow.

### 3. Monitor Deployment
```bash
# View all workflows
gh run list

# View specific run details
gh run view <RUN_ID> --log

# Watch in real-time
gh run watch
```

### 4. Check EC2 Deployment
```bash
# SSH into EC2
ssh -i /path/to/key.pem ec2-user@your.ec2.ip

# View running containers
docker ps

# Check logs
docker logs <container-id>
cd /home/ec2-user/app && docker-compose logs
```

## Workflow Process

1. **Trigger**: Push to `main` branch
2. **Build**: Docker image built and tested
3. **Push**: Image pushed to AWS ECR
4. **Deploy**: Image deployed to EC2 via Docker Compose
5. **Verify**: Application running and healthy

## Development Workflow

For local development with hot-reload:
```bash
docker-compose -f docker-compose.dev.yml up
```

For production-like local testing:
```bash
docker-compose up
```

## Common Commands

### GitHub CLI
```bash
gh auth login              # Authenticate
gh run list                # List workflows
gh run view <RUN_ID>       # View run details
gh run view <RUN_ID> --log # View logs
gh secret list             # View secrets
gh secret set KEY --body VALUE  # Set secret
```

### AWS CLI
```bash
aws ecr describe-repositories           # List ECR repos
aws ecr describe-images --repository-name atlas-tekstil
aws ec2 describe-instances              # List EC2 instances
```

### Docker
```bash
docker build -t atlas-tekstil .        # Build image
docker-compose up -d                   # Start services
docker-compose logs -f                 # View logs
docker-compose down                    # Stop services
docker ps                              # List containers
```

## Troubleshooting

### GitHub Actions Workflow Fails
- Check logs: `gh run view <RUN_ID> --log`
- Verify secrets are set correctly: `gh secret list`
- Check AWS credentials and permissions

### SSH Connection Fails
- Verify EC2 security group allows port 22
- Check SSH key permissions: `chmod 600 ~/.ssh/your-key.pem`
- Verify correct EC2 user (ec2-user for Amazon Linux, ubuntu for Ubuntu)

### ECR Push Fails
- Verify AWS credentials
- Check IAM permissions include ECR access
- Verify ECR repository exists

### Docker Container Won't Start
- SSH into EC2 and check: `docker-compose logs`
- Verify image pulled correctly: `docker images`
- Check environment variables and ports

## Next Steps

1. ✅ Install CLI tools (DONE)
2. 🔄 Run setup script
3. 🔄 Login with GitHub
4. 🔄 Configure AWS
5. 🔄 Commit and push changes
6. 🔄 Monitor first deployment
7. 🔄 Verify running on EC2

## Documentation

For detailed information, see:
- `.github/DEPLOYMENT_SETUP.md` - Comprehensive setup guide
- `.github/workflows/deploy.yml` - Workflow configuration
- GitHub Actions: https://docs.github.com/en/actions
- AWS ECR: https://docs.aws.amazon.com/ecr/

## Security Notes

⚠️ **Important**: Before production use, ensure:
- Change default admin password
- Use environment variables for secrets
- Implement proper HTTPS certificates
- Use IAM roles instead of access keys when possible
- Restrict EC2 security groups appropriately
- Keep secrets out of version control
- Use AWS Secrets Manager for sensitive data
