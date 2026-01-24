#pragma once

#include <string>
#include <vector>
#include <memory>
#include <onnxruntime_cxx_api.h>

namespace vms {
namespace ai {

struct Detection {
    std::string label;
    float confidence;
    float x, y, w, h;  // Normalized bbox [0,1]
    int class_id;
};

struct InferenceResult {
    std::vector<Detection> detections;
    int frame_width;
    int frame_height;
    int64_t frame_timestamp_ms;
    double infer_ms;
};

struct OnnxConfig {
    std::string model_path;
    std::string model_type = "YOLOV8";  // YOLOV5, YOLOV8
    int input_width = 640;
    int input_height = 640;
    float confidence_threshold = 0.6f;
    float nms_threshold = 0.45f;
    int max_detections = 20;
    int num_threads = 4;
};

class OnnxInference {
public:
    explicit OnnxInference(const OnnxConfig& config);
    ~OnnxInference();

    // Run inference on a BGR frame
    InferenceResult run(const uint8_t* bgr_data, int width, int height, int64_t timestamp_ms);

    // Get model info
    const std::vector<std::string>& getClassNames() const { return class_names_; }
    bool isLoaded() const { return loaded_; }

private:
    void loadModel();
    void preprocessToBuffer(const uint8_t* bgr_data, int width, int height); // Writes to input_buffer_
    std::vector<Detection> postprocess(const std::vector<float>& output, int orig_width, int orig_height);
    std::vector<Detection> nms(std::vector<Detection>& detections) const;

    OnnxConfig config_;
    bool loaded_ = false;

    // ONNX Runtime objects (pimpl pattern to hide Ort headers)
    std::unique_ptr<Ort::Env> env_;
    std::unique_ptr<Ort::Session> session_;
    std::unique_ptr<Ort::MemoryInfo> memory_info_;

    // Optimized Buffers
    std::vector<float> input_buffer_;
    std::vector<Ort::Value> input_tensors_;
    std::vector<Ort::Value> output_tensors_;

    std::vector<std::string> input_names_;
    std::vector<std::string> output_names_;
    std::vector<int64_t> input_shape_;
    std::vector<int64_t> output_shape_;

    // COCO class names (80 classes)
    std::vector<std::string> class_names_;
};

} // namespace ai
} // namespace vms
