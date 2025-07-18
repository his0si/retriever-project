@echo off
echo Starting Backend Services...

cd backend

REM Activate virtual environment
call venv\Scripts\activate

REM Install dependencies if needed
echo Installing dependencies...
pip install -r requirements.txt

REM Install Playwright browsers
echo Installing Playwright browsers...
playwright install chromium

REM Start FastAPI server
echo Starting FastAPI server...
python main.py