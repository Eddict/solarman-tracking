FROM node:24-bookworm-slim

# Install system dependencies, Microsoft SQL Server tools, and Python (for mssql-scripter)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     gzip \
     ca-certificates \
     curl \
     unzip \
     gnupg2 \
     python3 \
     python3-pip \
     python3-venv \
  # 1. Add Microsoft Package Repository for sqlcmd and ODBC Drivers
  && curl -fsSL https://microsoft.com | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
  && curl -fsSL https://microsoft.com -o /etc/apt/sources.list.d/mssql-release.list \
  && apt-get update \
  # ACCEPT_EULA=Y is required to automatically install the MS SQL CLI tools
  && ACCEPT_EULA=Y apt-get install -y --no-install-recommends mssql-tools18 unixodbc-dev \
  && ln -s /opt/mssql-tools18/bin/sqlcmd /usr/local/bin/sqlcmd \
  # 2. Install mssql-scripter via pip globally or explicitly exposed
  && pip3 install --no-cache-dir --break-system-packages mssql-scripter \
  # 3. Download and Install Rclone
  && curl -fsSL "https://downloads.rclone.org/rclone-current-linux-$(dpkg --print-architecture).zip" -o /tmp/rclone.zip \
  && unzip -q /tmp/rclone.zip -d /tmp \
  && install /tmp/rclone-*-linux-*/rclone /usr/local/bin/rclone \
  # 4. Clean up unnecessary setup tools to keep image size slim
  && rm -rf /tmp/rclone* \
  && apt-get purge -y curl unzip gnupg2 \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm-store-v2,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

COPY . .

EXPOSE 3000

CMD ["pnpm", "dev", "--host", "0.0.0.0"]
