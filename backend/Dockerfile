FROM continuumio/miniconda3:24.7.1-0

# Set timezone
ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app

# Configure bash as default shell for RUN so we can source conda env
SHELL ["/bin/bash", "-lc"]

# Configurable Python version via build-arg
ARG PYTHON_VERSION=3.11

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    curl \
    tzdata \
    fonts-unifont \
    fonts-liberation \
    # Playwright dependencies
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
    && rm -rf /var/lib/apt/lists/*

# Create dedicated conda environment
RUN conda update -n base -c defaults -y conda \
    && conda create -y -n appenv python=${PYTHON_VERSION} \
    && conda clean -afy

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN source activate appenv \
    && pip install --no-cache-dir -r requirements.txt \
    && playwright install chromium

# Copy application code
COPY . .

# Default command (can be overridden)
CMD ["bash", "-lc", "source activate appenv && python main.py"]