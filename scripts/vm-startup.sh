#!/usr/bin/env bash
set -euo pipefail

echo "=== [Study Buddy] Starting VM initialization ==="
export DEBIAN_FRONTEND=noninteractive

# 1. Install prerequisites and Docker
apt-get update
apt-get install -y ca-certificates curl gnupg git

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

# 2. Setup project folder
PROJECT_DIR="/opt/study-buddy"
if [ ! -d "$PROJECT_DIR" ]; then
  mkdir -p "$PROJECT_DIR"
  git clone https://github.com/b3mug1/study-buddy.git "$PROJECT_DIR"
else
  cd "$PROJECT_DIR"
  git pull origin master || true
fi

cd "$PROJECT_DIR"

# 3. Detect external IP
EXTERNAL_IP=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip || curl -s ifconfig.me)
echo "Detected external IP: $EXTERNAL_IP"

# 4. Generate secrets if not already configured
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
  echo "Created .env configuration."
fi

# 5. Build and launch containers
docker compose -f docker-compose.prod.yml down --remove-orphans || true
docker compose -f docker-compose.prod.yml up -d --build

echo "=== [Study Buddy] Deployment completed successfully! ==="
echo "Access the app at: http://${EXTERNAL_IP}"
