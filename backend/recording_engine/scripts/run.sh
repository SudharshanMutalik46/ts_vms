#!/bin/bash
# Run Recording Engine (Linux)
# Expects binary at build/recording_engine

EXE_PATH="../../build/recording_engine"

if [ ! -f "$EXE_PATH" ]; then
    echo "Error: Binary not found at $EXE_PATH"
    echo "Please build the project first."
    exit 1
fi

export RECORDING_ENGINE_PORT=50051
export RECORDINGS_PATH="../../backend/api_gateway/src/runtime/recordings"

echo "Starting Recording Engine on port 50051..."
$EXE_PATH
