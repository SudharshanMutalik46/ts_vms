#!/bin/bash
# Run AI Engine (Linux)
# Expects binary at build/ai_engine

EXE_PATH="../../build/ai_engine"

if [ ! -f "$EXE_PATH" ]; then
    echo "Error: Binary not found at $EXE_PATH"
    echo "Please build the project first."
    exit 1
fi

export AI_ENGINE_HOST=0.0.0.0
export AI_ENGINE_PORT=50052
export LOG_LEVEL=info

echo "Starting AI Engine on port 50052..."
$EXE_PATH
