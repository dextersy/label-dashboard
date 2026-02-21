#!/bin/bash
set -euo pipefail

# --- Configuration ---
CONTAINER_NAME="jgbc-db"
DUMP_DIR_IN_CONTAINER="/tmp/mongodump"
LOCAL_STAGING_DIR="/tmp/jgbc-db-backup"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARCHIVE_NAME="jgbc-db_${TIMESTAMP}.tar.gz"
ARCHIVE_PATH="/tmp/${ARCHIVE_NAME}"

REMOTE_HOST="user@your-server.example.com"   # PLACEHOLDER
REMOTE_PATH="/backups/"                        # PLACEHOLDER
SSH_KEY_PATH="/path/to/your/ssh/key.pem"      # PLACEHOLDER

# Optional MongoDB auth — leave blank if not required
MONGO_USER=""
MONGO_PASS=""

# --- Step 1: Run mongodump inside the container ---
echo "[1/4] Running mongodump inside container '${CONTAINER_NAME}'..."

# Build auth args only if credentials are set
MONGO_AUTH_ARGS=""
if [ -n "${MONGO_USER}" ] && [ -n "${MONGO_PASS}" ]; then
    MONGO_AUTH_ARGS="--username ${MONGO_USER} --password ${MONGO_PASS} --authenticationDatabase admin"
fi

# Clear any previous dump inside the container, then dump all databases
docker exec "${CONTAINER_NAME}" bash -c "rm -rf ${DUMP_DIR_IN_CONTAINER} && mongodump --db jgbc --out ${DUMP_DIR_IN_CONTAINER} ${MONGO_AUTH_ARGS}"

echo "      mongodump complete inside container."

# --- Step 2: Copy dump out of the container ---
echo "[2/4] Copying dump from container to host..."
rm -rf "${LOCAL_STAGING_DIR}"
mkdir -p "${LOCAL_STAGING_DIR}"

docker cp "${CONTAINER_NAME}:${DUMP_DIR_IN_CONTAINER}" "${LOCAL_STAGING_DIR}/"

echo "      Copied to ${LOCAL_STAGING_DIR}"

# --- Step 3: Compress into a tar.gz archive ---
echo "[3/4] Compressing to ${ARCHIVE_PATH}..."
tar -czf "${ARCHIVE_PATH}" -C "${LOCAL_STAGING_DIR}" .

echo "      Archive size: $(du -sh "${ARCHIVE_PATH}" | cut -f1)"

# --- Step 4: SFTP the archive to the remote server ---
echo "[4/4] Uploading ${ARCHIVE_NAME} to ${REMOTE_HOST}:${REMOTE_PATH}..."
sftp -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no "${REMOTE_HOST}" <<EOF
put ${ARCHIVE_PATH} ${REMOTE_PATH}${ARCHIVE_NAME}
bye
EOF

echo "      Upload complete."

# --- Cleanup ---
echo "Cleaning up local staging files..."
docker exec "${CONTAINER_NAME}" bash -c "rm -rf ${DUMP_DIR_IN_CONTAINER}" || true
rm -rf "${LOCAL_STAGING_DIR}"
rm -f "${ARCHIVE_PATH}"

echo "Done. Dump '${ARCHIVE_NAME}' successfully uploaded to ${REMOTE_HOST}:${REMOTE_PATH}"
