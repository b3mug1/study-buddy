#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="psychic-timing-458320-n5"
ZONE="${GCP_ZONE:-europe-west1-b}"
INSTANCE_NAME="study-buddy-vm"
MACHINE_TYPE="e2-small"

echo "=========================================================="
echo "  Deploying Study Buddy to Google Cloud (Compute Engine)   "
echo "  Project ID: $PROJECT_ID                                 "
echo "  Zone:       $ZONE                                       "
echo "  Machine:    $MACHINE_TYPE                               "
echo "=========================================================="

# 1. Set active GCP project
echo "--> Setting active GCP project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

# 2. Enable Compute Engine API
echo "--> Enabling Compute Engine API..."
gcloud services enable compute.googleapis.com

# 3. Configure firewall rules for HTTP & HTTPS
echo "--> Configuring firewall rules..."
if ! gcloud compute firewall-rules describe allow-study-buddy-web &>/dev/null; then
  gcloud compute firewall-rules create allow-study-buddy-web \
    --project="$PROJECT_ID" \
    --direction=INGRESS \
    --priority=1000 \
    --network=default \
    --action=ALLOW \
    --rules=tcp:80,tcp:443 \
    --target-tags=http-server,https-server \
    --description="Allow HTTP and HTTPS traffic for Study Buddy"
  echo "Firewall rule created."
else
  echo "Firewall rule already exists."
fi

# 4. Create Compute Engine VM
echo "--> Checking VM instance: $INSTANCE_NAME..."
if ! gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" &>/dev/null; then
  echo "Creating VM instance in $ZONE..."
  gcloud compute instances create "$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --network-interface=network-tier=PREMIUM,stack-type=IPV4_ONLY,subnet=default \
    --maintenance-policy=MIGRATE \
    --provisioning-model=STANDARD \
    --service-account=default \
    --scopes=https://www.googleapis.com/auth/cloud-platform \
    --tags=http-server,https-server \
    --create-disk=auto-delete=yes,boot=yes,image=projects/ubuntu-os-cloud/global/images/family/ubuntu-2404-lts-amd64,size=20,type=pd-standard \
    --metadata=startup-script='#!/usr/bin/env bash
set -euo pipefail
echo "=== [Study Buddy] Starting VM initialization ==="
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg git

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

PROJECT_DIR="/opt/study-buddy"
mkdir -p "$PROJECT_DIR"
git clone https://github.com/b3mug1/study-buddy.git "$PROJECT_DIR" || (cd "$PROJECT_DIR" && git pull origin master)
cd "$PROJECT_DIR"

EXTERNAL_IP=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip || curl -s ifconfig.me)

if [ ! -f .env ]; then
  DB_PASSWORD=$(openssl rand -hex 16)
  JWT_SECRET_KEY=$(openssl rand -hex 32)
  cat <<EOF > .env
DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET_KEY=${JWT_SECRET_KEY}
FRONTEND_URL=http://${EXTERNAL_IP}
VITE_API_URL=http://${EXTERNAL_IP}
CORS_ORIGINS=["http://${EXTERNAL_IP}"]
COOKIE_SECURE=false
EOF
fi

docker compose -f docker-compose.prod.yml up -d --build
echo "=== [Study Buddy] Deployment completed! ==="
'
  echo "VM instance created successfully!"
else
  echo "VM instance $INSTANCE_NAME already exists."
fi

# 5. Fetch External IP
echo "--> Retrieving VM External IP..."
EXTERNAL_IP=$(gcloud compute instances describe "$INSTANCE_NAME" \
  --zone="$ZONE" \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo ""
echo "=========================================================="
echo "  [SUCCESS] VM is running!                               "
echo "  VM External IP: $EXTERNAL_IP                           "
echo "  Application URL: http://$EXTERNAL_IP                   "
echo "=========================================================="
echo ""
echo "Docker is building and starting containers (takes ~2-3 min on first run)."
echo "To monitor the build progress live, run:"
echo "  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command=\"sudo journalctl -u google-startup-scripts.service -f\""
echo ""
