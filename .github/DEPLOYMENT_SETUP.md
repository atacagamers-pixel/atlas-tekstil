# CI/CD Deployment Setup Guide

This guide walks you through setting up automated CI/CD deployment to AWS EC2 using GitHub Actions.

## Prerequisites

- GitHub repository with admin access
- AWS Account with EC2 instance
- Docker and Docker Compose installed on EC2
- GitHub CLI (`gh`) installed locally
- AWS CLI (`aws`) configured with credentials

## Step 1: Configure AWS

### Create ECR Repository

```bash
aws ecr create-repository \
  --repository-name atlas-tekstil \
  --region us-east-1
```

### Get AWS Credentials

1. Go to AWS IAM Console
2. Create a new IAM user for GitHub Actions with permissions:
   - `AmazonEC2ContainerRegistryPowerUser`
   - `AmazonEC2FullAccess` (or more restrictive policy)
3. Generate Access Key ID and Secret Access Key

## Step 2: Prepare EC2 Instance

### SSH into your EC2 instance

```bash
ssh -i /path/to/key.pem ec2-user@your-instance-ip
```

### Install Docker and Docker Compose

```bash
sudo yum update -y
sudo amazon-linux-extras install docker -y
sudo usermod -a -G docker ec2-user
sudo systemctl start docker
sudo systemctl enable docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Create Application Directory

```bash
mkdir -p /home/ec2-user/app
cd /home/ec2-user/app
```

## Step 3: Set GitHub Secrets

Use GitHub CLI or the GitHub web interface to add these secrets:

### Via GitHub CLI

```bash
cd /path/to/your/repo

# AWS Credentials
gh secret set AWS_ACCESS_KEY_ID --body "YOUR_ACCESS_KEY_ID"
gh secret set AWS_SECRET_ACCESS_KEY --body "YOUR_SECRET_ACCESS_KEY"

# EC2 Connection Details
gh secret set EC2_INSTANCE_IP --body "your.ec2.instance.ip"
gh secret set EC2_USER --body "ec2-user"  # or ubuntu depending on AMI
gh secret set EC2_SSH_KEY --body "$(cat /path/to/your/key.pem)"
```

### Via GitHub Web UI

1. Go to your repository on GitHub
2. Settings → Secrets and variables → Actions
3. Create new repository secrets with the values above

## Step 4: Update Workflow Configuration

Edit `.github/workflows/deploy.yml` and update:

- `AWS_REGION`: Your AWS region (default: us-east-1)
- `ECR_REPOSITORY`: Your ECR repository name
- `EC2_USER`: SSH user for your EC2 instance (ec2-user or ubuntu)

## Step 5: Configure docker-compose.yml

Update your `docker-compose.yml` to use ECR image:

```yaml
version: '3.8'

services:
  app:
    image: YOUR_ECR_REGISTRY/atlas-tekstil:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: always
    volumes:
      - ./data:/app/data
```

## Step 6: Test the Deployment

1. Make a small change to your code
2. Commit and push to main branch:
   ```bash
   git add .
   git commit -m "test: trigger CI/CD deployment"
   git push origin main
   ```

3. Go to GitHub → Actions to monitor the workflow
4. Check EC2 instance to verify deployment:
   ```bash
   ssh -i /path/to/key.pem ec2-user@your-instance-ip
   docker ps
   ```

## Monitoring and Troubleshooting

### View GitHub Actions Logs

```bash
gh run list --branch main
gh run view <RUN_ID> --log
```

### SSH into EC2 and Check Logs

```bash
ssh -i /path/to/key.pem ec2-user@your-instance-ip

# View running containers
docker ps

# View application logs
docker logs <container-id>

# View docker-compose logs
cd /home/ec2-user/app
docker-compose logs
```

### Common Issues

1. **ECR Authentication Failed**: Ensure AWS credentials in GitHub secrets are correct
2. **SSH Connection Failed**: Verify EC2 security group allows SSH (port 22) from GitHub Actions IPs
3. **Docker Build Failed**: Check Dockerfile and build context
4. **Deployment Failed**: Check EC2 logs and ensure Docker/Docker Compose are installed

## Security Best Practices

1. Use IAM roles instead of access keys when possible
2. Restrict ECR repository access to specific IAM users
3. Use security groups to limit EC2 access
4. Regularly rotate access keys
5. Monitor GitHub Actions logs for suspicious activity
6. Use branch protection rules to require reviews before deployment

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS ECR Documentation](https://docs.aws.amazon.com/ecr/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
