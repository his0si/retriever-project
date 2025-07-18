@echo off
echo Starting School RAG Chatbot Services...

REM Start Docker containers
echo Starting Docker containers...
docker-compose up -d

REM Wait for services to be ready
echo Waiting for services to start...
timeout /t 10

REM Open services in browser
echo Opening monitoring dashboards...
start http://localhost:15672
start http://localhost:6333/dashboard

echo.
echo Services are starting up!
echo.
echo RabbitMQ Management: http://localhost:15672 (admin/admin123)
echo Qdrant Dashboard: http://localhost:6333/dashboard
echo API Docs: http://localhost:8000/docs (will be available after starting backend)
echo Frontend: http://localhost:3000 (will be available after starting frontend)
echo.
echo Next steps:
echo 1. Add your OpenAI API key to .env file
echo 2. Start backend: cd backend ^&^& python main.py
echo 3. Start Celery: cd backend ^&^& celery -A celery_app worker --loglevel=info
echo 4. Start frontend: cd frontend ^&^& npm install ^&^& npm run dev
echo.