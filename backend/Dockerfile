FROM continuumio/miniconda3:24.7.1-0

# Set timezone
ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app

# Configure bash as default shell for RUN so we can source conda env
SHELL ["/bin/bash", "-lc"]

# Configurable Python version via build-arg
ARG PYTHON_VERSION=3.11

# Install system dependencies for Playwright and Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    curl \
    tzdata \
    fonts-unifont \
    fonts-liberation \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-tlwg-loma-otf \
    fonts-freefont-ttf \
    fonts-noto-color-emoji \
    # Playwright/Chromium dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libexpat1 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    libgtk-3-0 \
    libglib2.0-0 \
    libxshmfence1 \
    libgl1 \
    xvfb \
    xfonts-scalable \
    xfonts-utils \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated conda environment
RUN conda update -n base -c defaults -y conda \
    && conda create -y -n appenv python=${PYTHON_VERSION} \
    && conda clean -afy

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN source activate appenv \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for running applications
RUN groupadd -r appuser && useradd -r -g appuser -u 1000 -m appuser \
    && chown -R appuser:appuser /app \
    && chown -R appuser:appuser /opt/conda

# Initialize conda for appuser
RUN echo ". /opt/conda/etc/profile.d/conda.sh" >> /home/appuser/.bashrc \
    && echo "conda activate appenv" >> /home/appuser/.bashrc

# Switch to non-root user
USER appuser

# Install Playwright browsers as appuser
RUN source activate appenv \
    && playwright install chromium \
    && echo "Playwright Chromium installed successfully"

# Verify Playwright installation
RUN source activate appenv \
    && python -c "from playwright.sync_api import sync_playwright; print('Playwright verification successful')"

# Default command (can be overridden)
CMD ["bash", "-lc", "source activate appenv && python main.py"]