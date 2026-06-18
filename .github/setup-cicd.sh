#!/bin/bash

# CI/CD Setup Script for GitHub Actions + AWS EC2
# This script helps automate the setup process

set -e

echo "=========================================="
echo "CI/CD Setup Script"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo -e "\n${BLUE}Checking prerequisites...${NC}"
    
    if ! command -v gh &> /dev/null; then
        echo "❌ GitHub CLI (gh) not found. Install it first."
        exit 1
    fi
    
    if ! command -v aws &> /dev/null; then
        echo "❌ AWS CLI (aws) not found. Install it first."
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        echo "❌ Git not found. Install it first."
        exit 1
    fi
    
    echo -e "${GREEN}✓ All prerequisites found${NC}"
}

# Get user input
get_user_input() {
    echo -e "\n${BLUE}Configuration:${NC}"
    
    read -p "Enter AWS Region [us-east-1]: " AWS_REGION
    AWS_REGION=${AWS_REGION:-us-east-1}
    
    read -p "Enter ECR Repository Name [atlas-tekstil]: " ECR_REPO
    ECR_REPO=${ECR_REPO:-atlas-tekstil}
    
    read -p "Enter EC2 Instance IP: " EC2_IP
    
    read -p "Enter EC2 SSH User [ec2-user]: " EC2_USER
    EC2_USER=${EC2_USER:-ec2-user}
    
    read -p "Enter path to EC2 SSH Private Key: " SSH_KEY_PATH
    
    echo -e "\n${BLUE}Configuration Summary:${NC}"
    echo "AWS Region: $AWS_REGION"
    echo "ECR Repository: $ECR_REPO"
    echo "EC2 Instance IP: $EC2_IP"
    echo "EC2 SSH User: $EC2_USER"
    echo "SSH Key Path: $SSH_KEY_PATH"
}

# Create ECR repository
create_ecr_repo() {
    echo -e "\n${BLUE}Creating ECR repository...${NC}"
    
    if aws ecr describe-repositories \
        --repository-names "$ECR_REPO" \
        --region "$AWS_REGION" &> /dev/null; then
        echo "✓ ECR Repository already exists"
    else
        aws ecr create-repository \
            --repository-name "$ECR_REPO" \
            --region "$AWS_REGION"
        echo -e "${GREEN}✓ ECR Repository created${NC}"
    fi
}

# Set GitHub secrets
set_github_secrets() {
    echo -e "\n${BLUE}Setting GitHub secrets...${NC}"
    
    # Check if user is authenticated with gh
    if ! gh auth status &> /dev/null; then
        echo -e "${YELLOW}Please authenticate with GitHub CLI:${NC}"
        gh auth login
    fi
    
    # Get repository name
    REPO=$(git config --get remote.origin.url | sed 's/.*\///' | sed 's/\.git$//')
    OWNER=$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\/.*/\1/')
    
    echo "Setting secrets for $OWNER/$REPO..."
    
    # AWS Credentials
    read -sp "Enter AWS Access Key ID: " AWS_ACCESS_KEY
    echo
    gh secret set AWS_ACCESS_KEY_ID --body "$AWS_ACCESS_KEY" -R "$OWNER/$REPO"
    
    read -sp "Enter AWS Secret Access Key: " AWS_SECRET_KEY
    echo
    gh secret set AWS_SECRET_ACCESS_KEY --body "$AWS_SECRET_KEY" -R "$OWNER/$REPO"
    
    # EC2 Details
    gh secret set EC2_INSTANCE_IP --body "$EC2_IP" -R "$OWNER/$REPO"
    gh secret set EC2_USER --body "$EC2_USER" -R "$OWNER/$REPO"
    
    # SSH Key
    gh secret set EC2_SSH_KEY --body "$(cat "$SSH_KEY_PATH")" -R "$OWNER/$REPO"
    
    echo -e "${GREEN}✓ GitHub secrets configured${NC}"
}

# Test SSH connection
test_ec2_connection() {
    echo -e "\n${BLUE}Testing EC2 connection...${NC}"
    
    if ssh -i "$SSH_KEY_PATH" \
        -o StrictHostKeyChecking=no \
        -o ConnectTimeout=5 \
        "$EC2_USER@$EC2_IP" "echo 'Connection successful'" &> /dev/null; then
        echo -e "${GREEN}✓ SSH connection successful${NC}"
    else
        echo -e "${YELLOW}⚠ SSH connection failed. Please check:${NC}"
        echo "  - EC2 instance is running"
        echo "  - Security group allows SSH from your IP"
        echo "  - SSH key has correct permissions (chmod 600)"
        echo "  - Correct EC2 user for your AMI (ec2-user for Amazon Linux, ubuntu for Ubuntu)"
    fi
}

# Create app directory on EC2
setup_ec2_directory() {
    echo -e "\n${BLUE}Setting up application directory on EC2...${NC}"
    
    ssh -i "$SSH_KEY_PATH" \
        -o StrictHostKeyChecking=no \
        "$EC2_USER@$EC2_IP" << 'EOF'
mkdir -p ~/app
cd ~/app
echo "Application directory created at ~/app"
EOF
    echo -e "${GREEN}✓ EC2 directory setup complete${NC}"
}

# Update workflow file with user values
update_workflow() {
    echo -e "\n${BLUE}Updating workflow configuration...${NC}"
    
    WORKFLOW_FILE=".github/workflows/deploy.yml"
    
    if [ -f "$WORKFLOW_FILE" ]; then
        sed -i.bak "s/AWS_REGION: .*/AWS_REGION: $AWS_REGION/" "$WORKFLOW_FILE"
        sed -i.bak "s/ECR_REPOSITORY: .*/ECR_REPOSITORY: $ECR_REPO/" "$WORKFLOW_FILE"
        echo -e "${GREEN}✓ Workflow updated${NC}"
        rm -f "$WORKFLOW_FILE.bak"
    else
        echo -e "${YELLOW}⚠ Workflow file not found at $WORKFLOW_FILE${NC}"
    fi
}

# Main execution
main() {
    check_prerequisites
    get_user_input
    
    read -p "Proceed with setup? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled"
        exit 0
    fi
    
    create_ecr_repo
    set_github_secrets
    test_ec2_connection
    setup_ec2_directory
    update_workflow
    
    echo -e "\n${GREEN}=========================================="
    echo "✓ Setup Complete!"
    echo "==========================================${NC}"
    echo -e "\n${BLUE}Next steps:${NC}"
    echo "1. Commit and push your changes to GitHub:"
    echo "   git add . && git commit -m 'chore: add CI/CD setup'"
    echo "   git push origin main"
    echo ""
    echo "2. Monitor the deployment at:"
    echo "   gh run list --branch main"
    echo ""
    echo "3. For detailed logs:"
    echo "   gh run view <RUN_ID> --log"
}

main
