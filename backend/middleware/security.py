from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import re
import structlog
from typing import List, Pattern
import time
from collections import defaultdict
from datetime import datetime, timedelta

logger = structlog.get_logger()


class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Security middleware to protect against malicious requests including:
    - Command injection attempts
    - Path traversal attacks
    - SQL injection attempts
    - XSS attempts
    - Rate limiting
    """
    
    def __init__(self, app, rate_limit_requests: int = 100, rate_limit_window: int = 60):
        super().__init__(app)
        self.rate_limit_requests = rate_limit_requests
        self.rate_limit_window = rate_limit_window
        self.request_counts = defaultdict(list)
        
        # Patterns for detecting malicious requests
        self.malicious_patterns: List[Pattern] = [
            # Shell command injection patterns
            re.compile(r'[;&|`$]|\bsh\b|\bbash\b|\bcmd\b|powershell', re.IGNORECASE),
            re.compile(r'\b(rm|del|format|wget|curl|nc|netcat)\s+', re.IGNORECASE),
            re.compile(r'/tmp;|/temp;|/var/tmp;', re.IGNORECASE),
            re.compile(r'shell\?cd\+|shell%3[Ff]cd%2[Bb]', re.IGNORECASE),
            
            # Path traversal patterns
            re.compile(r'\.\./|\.\.\\|%2e%2e%2f|%252e%252e%252f'),
            re.compile(r'/etc/passwd|/etc/shadow|/windows/system32'),
            
            # SQL injection patterns
            re.compile(r"('\s*(or|and)\s*'?1'?\s*=\s*'?1|union\s+select|drop\s+table)", re.IGNORECASE),
            re.compile(r'(;|\s)(drop|delete|truncate|update|insert|exec|execute)\s', re.IGNORECASE),
            
            # XSS patterns
            re.compile(r'<script[^>]*>|javascript:|onerror\s*=|onload\s*=', re.IGNORECASE),
            re.compile(r'alert\s*\(|eval\s*\(|expression\s*\(', re.IGNORECASE),
            
            # Other dangerous patterns
            re.compile(r'\.\.\./', re.IGNORECASE),
            re.compile(r'/proc/|/sys/|/dev/', re.IGNORECASE),
        ]
        
        # Whitelist of allowed characters in URLs and parameters
        self.allowed_url_chars = re.compile(r'^[a-zA-Z0-9\-._~:/?#\[\]@!$&\'()*+,;=%]*$')
        
    def is_rate_limited(self, client_ip: str) -> bool:
        """Check if the client has exceeded the rate limit"""
        now = datetime.now()
        window_start = now - timedelta(seconds=self.rate_limit_window)
        
        # Clean old requests
        self.request_counts[client_ip] = [
            req_time for req_time in self.request_counts[client_ip]
            if req_time > window_start
        ]
        
        # Check if limit exceeded
        if len(self.request_counts[client_ip]) >= self.rate_limit_requests:
            return True
            
        # Add current request
        self.request_counts[client_ip].append(now)
        return False
        
    def is_malicious_request(self, request: Request) -> bool:
        """Check if the request contains malicious patterns"""
        # Check URL path
        url_path = str(request.url.path)
        
        # Check for malicious patterns in URL
        for pattern in self.malicious_patterns:
            if pattern.search(url_path):
                logger.warning(
                    "Malicious pattern detected in URL",
                    pattern=pattern.pattern,
                    url=url_path,
                    client=request.client.host if request.client else "unknown"
                )
                return True
                
        # Check query parameters
        for param_name, param_value in request.query_params.items():
            # Check parameter name
            if not self.allowed_url_chars.match(param_name):
                logger.warning(
                    "Invalid characters in parameter name",
                    param_name=param_name,
                    client=request.client.host if request.client else "unknown"
                )
                return True
                
            # Check parameter value
            param_str = str(param_value)
            for pattern in self.malicious_patterns:
                if pattern.search(param_str):
                    logger.warning(
                        "Malicious pattern detected in parameter",
                        pattern=pattern.pattern,
                        param_name=param_name,
                        param_value=param_value,
                        client=request.client.host if request.client else "unknown"
                    )
                    return True
                    
        # Check headers for injection attempts
        suspicious_headers = ['user-agent', 'referer', 'x-forwarded-for']
        for header_name in suspicious_headers:
            header_value = request.headers.get(header_name, '')
            if header_value:
                for pattern in self.malicious_patterns[:5]:  # Only check injection patterns
                    if pattern.search(header_value):
                        logger.warning(
                            "Malicious pattern detected in header",
                            pattern=pattern.pattern,
                            header=header_name,
                            value=header_value[:100],  # Truncate for logging
                            client=request.client.host if request.client else "unknown"
                        )
                        return True
                        
        return False
        
    async def dispatch(self, request: Request, call_next):
        """Process the request through security checks"""
        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"
        
        # Rate limiting check
        if self.is_rate_limited(client_ip):
            logger.warning(
                "Rate limit exceeded",
                client=client_ip,
                path=request.url.path
            )
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."}
            )
            
        # Malicious request check
        if self.is_malicious_request(request):
            logger.error(
                "Blocked malicious request",
                client=client_ip,
                method=request.method,
                path=request.url.path,
                query_params=dict(request.query_params)
            )
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid request"}
            )
            
        # Process the request
        try:
            response = await call_next(request)
            
            # Log successful request
            process_time = time.time() - start_time
            logger.info(
                "Request processed",
                client=client_ip,
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                process_time=process_time
            )
            
            return response
            
        except Exception as e:
            logger.error(
                "Request processing error",
                client=client_ip,
                method=request.method,
                path=request.url.path,
                error=str(e)
            )
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"}
            )


class InputSanitizer:
    """Utility class for sanitizing user inputs"""
    
    @staticmethod
    def sanitize_url(url: str) -> str:
        """Sanitize URL to prevent injection attacks"""
        # Remove any control characters
        url = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', url)
        
        # Remove shell metacharacters
        url = re.sub(r'[;&|`$<>]', '', url)
        
        # Ensure URL starts with http/https
        if not url.startswith(('http://', 'https://')):
            raise ValueError("URL must start with http:// or https://")
            
        return url
        
    @staticmethod
    def sanitize_text(text: str, max_length: int = 1000) -> str:
        """Sanitize text input"""
        # Remove control characters except newlines and tabs
        text = re.sub(r'[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f-\x9f]', '', text)
        
        # Limit length
        text = text[:max_length]
        
        # Remove potential script tags
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r'javascript:', '', text, flags=re.IGNORECASE)
        
        return text.strip()