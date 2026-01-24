# YOLOv8n ONNX Model

Place the YOLOv8n ONNX model file here.

## Download

Download from Ultralytics or export from PyTorch:

```bash
# Option 1: Using yolov8 pip package
pip install ultralytics
yolo export model=yolov8n.pt format=onnx

# Option 2: Direct download (check Ultralytics releases)
# https://github.com/ultralytics/ultralytics/releases
```

## Expected Files

- `yolov8n.onnx` - YOLOv8 Nano model (~6MB)

## Model Specifications

| Property | Value |
|----------|-------|
| Input Size | 640x640 |
| Input Format | NCHW, float32, [0,1] |
| Output Format | [1, 84, 8400] |
| Classes | 80 (COCO) |
| Inference Time | ~50ms (CPU, 4 threads) |
