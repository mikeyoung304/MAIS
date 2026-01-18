#!/bin/bash
# =============================================================================
# HANDLED AI Agents - GCP Setup Script
# =============================================================================
# This script sets up the Google Cloud infrastructure for the agent-v2 system.
# Run this after authenticating with: gcloud auth login
# =============================================================================

set -e  # Exit on error

# Configuration
export PROJECT_ID="handled-ai-agents"
export LOCATION="us-central1"

echo "============================================"
echo "HANDLED AI Agents - GCP Setup"
echo "============================================"
echo ""

# -----------------------------------------------------------------------------
# Step 1: Create or select project
# -----------------------------------------------------------------------------
echo "Step 1: Setting up project..."

# Check if project exists
if gcloud projects describe $PROJECT_ID &>/dev/null; then
    echo "✅ Project $PROJECT_ID already exists"
else
    echo "Creating project $PROJECT_ID..."
    gcloud projects create $PROJECT_ID --name="HANDLED AI Agents"
    echo "✅ Project created"
fi

# Set as active project
gcloud config set project $PROJECT_ID
echo "✅ Active project set to $PROJECT_ID"
echo ""

# -----------------------------------------------------------------------------
# Step 2: Enable required APIs
# -----------------------------------------------------------------------------
echo "Step 2: Enabling APIs (this may take 1-2 minutes)..."

gcloud services enable \
  aiplatform.googleapis.com \
  iam.googleapis.com \
  compute.googleapis.com \
  storage.googleapis.com \
  pubsub.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com

echo "✅ APIs enabled"
echo ""

# -----------------------------------------------------------------------------
# Step 3: Create service accounts
# -----------------------------------------------------------------------------
echo "Step 3: Creating service accounts..."

# Array of agents and their descriptions
declare -A AGENTS=(
    ["sa-orchestrator"]="HANDLED Orchestrator Agent|Concierge agent that delegates to specialists"
    ["sa-marketing-agent"]="Marketing Specialist Agent|Generates marketing copy and content"
    ["sa-research-agent"]="Research Specialist Agent|Gathers market intelligence"
    ["sa-image-agent"]="Image Generation Agent|Creates images with Imagen 3"
    ["sa-video-agent"]="Video Generation Agent|Creates videos with Veo 2"
    ["sa-storefront-agent"]="Storefront Editor Agent|Manages page layout and structure"
    ["sa-booking-agent"]="Customer Booking Agent|Customer-facing booking assistant"
    ["sa-projecthub-agent"]="Project Hub Mediator Agent|Mediates customer-tenant communication"
)

for SA_NAME in "${!AGENTS[@]}"; do
    IFS='|' read -r DISPLAY_NAME DESCRIPTION <<< "${AGENTS[$SA_NAME]}"

    if gcloud iam service-accounts describe "${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" &>/dev/null; then
        echo "  ✅ $SA_NAME already exists"
    else
        gcloud iam service-accounts create "$SA_NAME" \
            --display-name="$DISPLAY_NAME" \
            --description="$DESCRIPTION"
        echo "  ✅ Created $SA_NAME"
    fi
done

echo "✅ Service accounts created"
echo ""

# -----------------------------------------------------------------------------
# Step 4: Apply IAM bindings
# -----------------------------------------------------------------------------
echo "Step 4: Applying IAM role bindings..."

# Orchestrator gets special permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:sa-orchestrator@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user" \
    --quiet

# All agents get AI Platform user role
for AGENT in marketing research image video storefront booking projecthub; do
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:sa-${AGENT}-agent@${PROJECT_ID}.iam.gserviceaccount.com" \
        --role="roles/aiplatform.user" \
        --quiet
done

# Image/Video agents get storage access
for AGENT in image video; do
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:sa-${AGENT}-agent@${PROJECT_ID}.iam.gserviceaccount.com" \
        --role="roles/storage.objectAdmin" \
        --quiet
done

echo "✅ IAM bindings applied"
echo ""

# -----------------------------------------------------------------------------
# Step 5: Create storage buckets
# -----------------------------------------------------------------------------
echo "Step 5: Creating storage buckets..."

# Staging bucket for agent deployments
if gsutil ls -b gs://${PROJECT_ID}-agent-staging &>/dev/null; then
    echo "  ✅ Staging bucket already exists"
else
    gsutil mb -l $LOCATION gs://${PROJECT_ID}-agent-staging
    echo "  ✅ Created staging bucket"
fi

# Media bucket for generated images/videos
if gsutil ls -b gs://${PROJECT_ID}-media &>/dev/null; then
    echo "  ✅ Media bucket already exists"
else
    gsutil mb -l $LOCATION gs://${PROJECT_ID}-media
    echo "  ✅ Created media bucket"
fi

# Set lifecycle policy for media bucket (auto-delete orphaned drafts after 30 days)
cat > /tmp/lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 30,
          "matchesPrefix": ["drafts/"]
        }
      }
    ]
  }
}
EOF
gsutil lifecycle set /tmp/lifecycle.json gs://${PROJECT_ID}-media
rm /tmp/lifecycle.json

echo "✅ Storage buckets configured"
echo ""

# -----------------------------------------------------------------------------
# Step 6: Verify setup
# -----------------------------------------------------------------------------
echo "Step 6: Verifying setup..."
echo ""

echo "Project: $(gcloud config get-value project)"
echo ""

echo "Service Accounts:"
gcloud iam service-accounts list --filter="email:sa-" --format="table(email,displayName)"
echo ""

echo "Storage Buckets:"
gsutil ls -p $PROJECT_ID
echo ""

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo "============================================"
echo "✅ GCP Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Request quota increases at:"
echo "   https://console.cloud.google.com/iam-admin/quotas?project=$PROJECT_ID"
echo ""
echo "2. Add these to your server/.env file:"
echo "   GOOGLE_CLOUD_PROJECT=$PROJECT_ID"
echo "   GOOGLE_CLOUD_LOCATION=$LOCATION"
echo "   AGENT_STAGING_BUCKET=gs://${PROJECT_ID}-agent-staging"
echo "   MEDIA_BUCKET=gs://${PROJECT_ID}-media"
echo ""
echo "3. Set up Application Default Credentials for local development:"
echo "   gcloud auth application-default login"
echo ""
