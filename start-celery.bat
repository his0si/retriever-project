@echo off
echo Starting Celery Worker...

cd backend

REM Activate virtual environment
call venv\Scripts\activate

REM Start Celery worker
echo Starting Celery worker...
celery -A celery_app worker --loglevel=info --pool=solo