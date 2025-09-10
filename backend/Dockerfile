FROM python:3.11-slim

# Set timezone
ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app

# Install system dependencies including fonts
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    curl \
    tzdata \
    fonts-unifont \
    fonts-ubuntu \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (without deps since we installed them manually)
RUN playwright install chromium

# Copy application code
COPY . .

# Default command (can be overridden)
CMD ["python", "main.py"]