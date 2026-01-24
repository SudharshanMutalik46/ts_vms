from ultralytics import YOLO
import sys

model_name = sys.argv[1] if len(sys.argv) > 1 else "yolov8s"
print(f"Exporting {model_name} at 640x640...")

model = YOLO(f"{model_name}.pt")
# Export with fixed 640x640 size
path = model.export(format="onnx", imgsz=640, dynamic=False)

print(f"Success! Exported to {path}")
