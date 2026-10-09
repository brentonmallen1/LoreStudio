# The Linux desktop app, built on any machine with Docker: `just desktop-linux`.
# Ubuntu 22.04, as CI's runner: its older glibc means the AppImage runs on more distributions.
# The machine's own architecture (an Apple silicon Mac builds for arm64, CI for x64).
FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential curl wget file ca-certificates git pkg-config xz-utils python3 \
      libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
      libpango-1.0-0 libpangoft2-1.0-0 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
RUN arch=$(uname -m | sed 's/aarch64/arm64/;s/x86_64/x64/') && \
    curl -fsSL https://nodejs.org/dist/v26.11.0/node-v26.11.0-linux-$arch.tar.xz | tar -xJ -C /usr/local --strip-components=1
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
ENV PATH=/root/.cargo/bin:/root/.local/bin:$PATH
