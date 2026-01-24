from ultralytics import YOLO
import os

print("Downloading YOLOv8m (Medium)...")
model = YOLO("yolov8m.pt")

print("Exporting to ONNX...")
path = model.export(format="onnx")

print(f"Success! Model exported to: {path}")
