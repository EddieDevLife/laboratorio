#!/bin/bash
# Inicia o Backend do Browser Agent
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d ".venv" ]; then
  echo "Criando ambiente virtual..."
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt
fi

echo "Iniciando Backend em http://localhost:8000"
echo "WebSocket em ws://localhost:8000/ws/{session_id}"
echo ""
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
