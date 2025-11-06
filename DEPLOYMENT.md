# Google Cloud Platform Deployment Guide

This guide will walk you through deploying your React application to Google Cloud Run.

## Prerequisites

1. A Google Cloud Platform account ([Sign up here](https://cloud.google.com/))
2. [Google Cloud SDK (gcloud CLI)](https://cloud.google.com/sdk/docs/install) installed on your machine
3. Docker installed locally (optional, for local testing)

## Step 1: Set Up Google Cloud Project

### 1.1 Create a New Project

```bash
# Set your project ID (choose a unique name)
export PROJECT_ID="your-project-id"

# Create the project
gcloud projects create $PROJECT_ID

# Set as default project
gcloud config set project $PROJECT_ID
```

### 1.2 Enable Required APIs

```bash
# Enable necessary APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 1.3 Link Billing Account

You need to link a billing account to your project. Do this via the [GCP Console](https://console.cloud.google.com/billing/linkedaccount).

## Step 2: Configure Environment Variables

### 2.1 Store Secrets in Secret Manager

```bash
# Store Supabase URL
echo -n "https://rwzzayktrijvkslegvol.supabase.co" | \
  gcloud secrets create VITE_SUPABASE_URL --data-file=-

# Store Supabase Anon Key
echo -n "your-supabase-anon-key" | \
  gcloud secrets create VITE_SUPABASE_ANON_KEY --data-file=-

# Grant Cloud Build access to secrets
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding VITE_SUPABASE_URL \
  --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding VITE_SUPABASE_ANON_KEY \
  --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Step 3: Set Up Artifact Registry

```bash
# Set your region (choose one close to your users)
export REGION="us-central1"

# Create Docker repository
gcloud artifacts repositories create my-app-repo \
  --repository-format=docker \
  --location=$REGION \
  --description="Docker repository for React app"

# Configure Docker authentication
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

## Step 4: Update cloudbuild.yaml

Edit `cloudbuild.yaml` and update the substitutions section:

```yaml
substitutions:
  _REGION: us-central1  # Your chosen region
  _REPOSITORY: my-app-repo  # Your repository name
  _SERVICE_NAME: my-react-app  # Your app name
```

## Step 5: Deploy Using Cloud Build

### Option A: Manual Deployment (Recommended for First Deploy)

```bash
# Build and deploy
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_VITE_SUPABASE_URL="https://rwzzayktrijvkslegvol.supabase.co",_VITE_SUPABASE_ANON_KEY="your-anon-key"
```

### Option B: Set Up Automated CI/CD

#### 5.1 Connect Repository

1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click "Connect Repository"
3. Select your source (GitHub, GitLab, etc.)
4. Authenticate and select your repository
5. Follow the connection wizard

#### 5.2 Create Build Trigger

```bash
# Create trigger for main branch
gcloud builds triggers create github \
  --repo-name=YOUR_REPO_NAME \
  --repo-owner=YOUR_GITHUB_USERNAME \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml \
  --substitutions=_VITE_SUPABASE_URL="https://rwzzayktrijvkslegvol.supabase.co",_VITE_SUPABASE_ANON_KEY="your-anon-key"
```

Now every push to the `main` branch will automatically trigger a deployment.

## Step 6: Configure Cloud Run Service

### 6.1 Set Resource Limits (Optional)

```bash
gcloud run services update my-react-app \
  --region=$REGION \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80
```

### 6.2 Get Service URL

```bash
gcloud run services describe my-react-app \
  --region=$REGION \
  --format="value(status.url)"
```

Your application is now live!

## Step 7: Set Up Custom Domain (Optional)

### 7.1 Verify Domain Ownership

```bash
# Map custom domain
gcloud run domain-mappings create \
  --service=my-react-app \
  --domain=yourdomain.com \
  --region=$REGION
```

### 7.2 Update DNS Records

Follow the instructions provided by the command above to update your DNS records.

## Step 8: Set Up Monitoring

### 8.1 Create Uptime Check

1. Go to [Cloud Monitoring](https://console.cloud.google.com/monitoring)
2. Click "Uptime checks" → "Create Uptime Check"
3. Enter your Cloud Run URL
4. Configure check frequency and alerts

### 8.2 Set Up Budget Alerts

```bash
# Create budget alert
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT_ID \
  --display-name="Monthly Budget" \
  --budget-amount=20 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

## Local Testing

Test the Docker container locally before deploying:

```bash
# Build the image
docker build -t my-react-app .

# Run locally
docker run -p 8080:8080 my-react-app

# Open browser to http://localhost:8080
```

## Deployment Commands Reference

```bash
# View logs
gcloud run services logs read my-react-app --region=$REGION

# List deployments
gcloud run services list --region=$REGION

# Delete service
gcloud run services delete my-react-app --region=$REGION

# Rollback to previous revision
gcloud run services update-traffic my-react-app \
  --to-revisions=REVISION_NAME=100 \
  --region=$REGION
```

## Cost Optimization Tips

1. **Use minimum instances = 0**: Service scales to zero when not in use
2. **Enable Cloud CDN**: Reduces bandwidth costs and improves performance
3. **Set appropriate memory limits**: Default 512Mi is usually sufficient for React apps
4. **Use budget alerts**: Get notified before unexpected costs
5. **Clean up old images**: Regularly delete unused container images

```bash
# List and delete old images
gcloud artifacts docker images list ${REGION}-docker.pkg.dev/${PROJECT_ID}/my-app-repo
gcloud artifacts docker images delete IMAGE_PATH
```

## Estimated Monthly Costs

For a typical low-traffic application:
- **Request charges**: ~$0.40 per million requests
- **CPU time**: ~$0.00002400 per vCPU-second
- **Memory**: ~$0.00000250 per GiB-second
- **Networking**: First 1GB egress free per month

**Estimated total for moderate traffic**: $5-20/month

For more details: [Cloud Run Pricing](https://cloud.google.com/run/pricing)

## Troubleshooting

### Build Fails

```bash
# Check build logs
gcloud builds log --region=$REGION $(gcloud builds list --limit=1 --format="value(id)")
```

### Service Not Accessible

```bash
# Check service status
gcloud run services describe my-react-app --region=$REGION

# Ensure service allows unauthenticated access
gcloud run services add-iam-policy-binding my-react-app \
  --region=$REGION \
  --member="allUsers" \
  --role="roles/run.invoker"
```

### Environment Variables Not Working

Ensure environment variables are set in the Cloud Run service:

```bash
gcloud run services update my-react-app \
  --region=$REGION \
  --set-env-vars="VITE_SUPABASE_URL=your-url,VITE_SUPABASE_ANON_KEY=your-key"
```

## Security Best Practices

1. Never commit `.env` files to version control
2. Always use Secret Manager for sensitive values
3. Enable Cloud Armor for DDoS protection (production)
4. Set up VPC Service Controls for additional security
5. Regularly update dependencies and base images
6. Use least privilege IAM roles

## Support and Documentation

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Artifact Registry Documentation](https://cloud.google.com/artifact-registry/docs)
- [GCP Support](https://cloud.google.com/support)

## Next Steps

1. Set up staging environment with separate Cloud Run service
2. Configure Cloud CDN for global content delivery
3. Implement Cloud Armor WAF rules
4. Set up log aggregation and analysis
5. Create automated backup strategy for Supabase data
