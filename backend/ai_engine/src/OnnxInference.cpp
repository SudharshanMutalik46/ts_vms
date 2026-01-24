#include "OnnxInference.h"
#include "Logger.h"

#include <onnxruntime_cxx_api.h>
#include <algorithm>
#include <chrono>
#include <cmath>

namespace vms {
namespace ai {

// COCO 80-class names
static const std::vector<std::string> COCO_NAMES = {
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
    "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
    "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
    "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
    "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
    "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
    "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake",
    "chair", "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop",
    "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
    "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
};

OnnxInference::OnnxInference(const OnnxConfig& config) : config_(config) {
    class_names_ = COCO_NAMES;
    loadModel();
}

OnnxInference::~OnnxInference() = default;

void OnnxInference::loadModel() {
    try {
        env_ = std::make_unique<Ort::Env>(ORT_LOGGING_LEVEL_WARNING, "ai_engine");
        
        Ort::SessionOptions session_options;
        session_options.SetIntraOpNumThreads(config_.num_threads);
        session_options.SetGraphOptimizationLevel(GraphOptimizationLevel::ORT_ENABLE_ALL);

        // Create session
#ifdef _WIN32
        std::wstring wpath(config_.model_path.begin(), config_.model_path.end());
#else
        std::string wpath = config_.model_path;
#endif

// Helper to append CUDA provider
#ifdef USE_CUDA
        try {
            LOG_INFO("Attempting to enable CUDA Execution Provider...");
            OrtCUDAProviderOptions cuda_options;
            cuda_options.device_id = 0;
            // Removed advanced options causing build failure
            
            // Use the convenience wrapper if available, or generic Append
            // Recent ORT C++ APIs have AppendExecutionProvider_CUDA
            session_options.AppendExecutionProvider_CUDA(cuda_options);
            LOG_INFO("CUDA Execution Provider enabled successfully");
        } catch (const std::exception& e) {
            LOG_ERROR("Failed to enable CUDA, falling back to CPU: {}", e.what());
        } catch (...) {
            LOG_ERROR("Failed to enable CUDA (unknown error), falling back to CPU");
        }
#endif


        
        session_ = std::make_unique<Ort::Session>(*env_, wpath.c_str(), session_options);

        // Verify which providers are actually enabled
        // Verify which providers are actually enabled
        // std::vector<std::string> providers = session_->GetProviders();
        // std::string provider_list = "";
        // for (size_t i = 0; i < providers.size(); i++) {
        //     provider_list += providers[i] + " ";
        // }
        // LOG_INFO("ONNX Runtime Active Providers: {}", provider_list);

        memory_info_ = std::make_unique<Ort::MemoryInfo>(
            Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault)
        );

        // Get input info
        Ort::AllocatorWithDefaultOptions allocator;
        auto input_name = session_->GetInputNameAllocated(0, allocator);
        input_names_.push_back(input_name.get());

        auto input_info = session_->GetInputTypeInfo(0);
        auto tensor_info = input_info.GetTensorTypeAndShapeInfo();
        input_shape_ = tensor_info.GetShape();

        // Fix dynamic dimensions and override config if model has fixed size
        if (input_shape_[2] != -1) config_.input_height = static_cast<int>(input_shape_[2]);
        else input_shape_[2] = config_.input_height;

        if (input_shape_[3] != -1) config_.input_width = static_cast<int>(input_shape_[3]);
        else input_shape_[3] = config_.input_width;

        // Get output info
        auto output_name = session_->GetOutputNameAllocated(0, allocator);
        output_names_.push_back(output_name.get());

        auto output_info = session_->GetOutputTypeInfo(0);
        output_shape_ = output_info.GetTensorTypeAndShapeInfo().GetShape();

        // loaded_ = true moved to end
        // LOG_INFO moved to end

        // --- OPTIMIZATION: Prepare persistent buffers ---
        
        // 1. Allocate host buffer ONCE
        input_buffer_.resize(3 * config_.input_width * config_.input_height);

        // 2. Create persistent Input Tensor wrapping the host buffer
        // Note: The memory_info is CPU. We bind this CPU tensor to the model input.
        std::vector<int64_t> input_shape = {1, 3, config_.input_height, config_.input_width};
        
        input_tensors_.clear();
        input_tensors_.push_back(Ort::Value::CreateTensor<float>(
            *memory_info_, input_buffer_.data(), input_buffer_.size(),
            input_shape.data(), input_shape.size()
        ));

        // Initialize persistent output tensor container (size 1)
        output_tensors_.clear();

        // Fix dynamic dimensions in output_shape_ (Batch size usually -1)
        for (auto& dim : output_shape_) {
            if (dim == -1) dim = 1; 
        }

        // Now safe to allocate
        // Allocator already declared at top of function
        
        output_tensors_.push_back(Ort::Value::CreateTensor<float>(allocator, output_shape_.data(), output_shape_.size()));

        loaded_ = true;
        LOG_INFO("ONNX model loaded: {} (input: {}x{})", 
                 config_.model_path, config_.input_width, config_.input_height);
    } catch (const Ort::Exception& e) {
        LOG_ERROR("Failed to load ONNX model: {}", e.what());
        loaded_ = false;
    }


}

void OnnxInference::preprocessToBuffer(const uint8_t* bgr_data, int width, int height) {
    int target_w = config_.input_width;
    int target_h = config_.input_height;
    
    // Ensure buffer is correct size (should be already from loadModel)
    if (input_buffer_.size() != 3 * target_w * target_h) {
        input_buffer_.resize(3 * target_w * target_h);
    }

    // Simple resize + normalize (bilinear for better quality, but nearest for speed)
    float scale_x = (float)width / target_w;
    float scale_y = (float)height / target_h;

    for (int y = 0; y < target_h; y++) {
        for (int x = 0; x < target_w; x++) {
            int src_x = std::min((int)(x * scale_x), width - 1);
            int src_y = std::min((int)(y * scale_y), height - 1);
            int src_idx = (src_y * width + src_x) * 3;

            // BGR to RGB + normalize to [0,1]
            float b = bgr_data[src_idx + 0] / 255.0f;
            float g = bgr_data[src_idx + 1] / 255.0f;
            float r = bgr_data[src_idx + 2] / 255.0f;

            // CHW format (R, G, B planes)
            int offset = y * target_w + x;
            input_buffer_[0 * target_h * target_w + offset] = r;
            input_buffer_[1 * target_h * target_w + offset] = g;
            input_buffer_[2 * target_h * target_w + offset] = b;
        }
    }
}

std::vector<Detection> OnnxInference::postprocess(const std::vector<float>& output, int orig_width, int orig_height) {
    std::vector<Detection> detections;

    // YOLOv8 output format: [1, 84, 8400] where 84 = 4 (bbox) + 80 (classes)
    // Transpose to [8400, 84] for easier processing
    
    int num_classes = 80;
    int channels = 4 + num_classes;
    
    if (output.size() % channels != 0) {
        LOG_WARN("Unexpected output size: {} (not divisible by {})", output.size(), channels);
        return detections;
    }
    
    int num_detections = output.size() / channels;

    for (int i = 0; i < num_detections; i++) {
        // Get bbox (center_x, center_y, width, height)
        float cx = output[0 * num_detections + i];
        float cy = output[1 * num_detections + i];
        float w  = output[2 * num_detections + i];
        float h  = output[3 * num_detections + i];

        // Find best class
        float max_conf = 0;
        int max_class = 0;
        for (int c = 0; c < num_classes; c++) {
            float conf = output[(4 + c) * num_detections + i];
            if (conf > max_conf) {
                max_conf = conf;
                max_class = c;
            }
        }

        if (max_conf < config_.confidence_threshold) continue;

        // Convert to normalized coords [0,1]
        Detection det;
        det.x = (cx - w / 2) / config_.input_width;
        det.y = (cy - h / 2) / config_.input_height;
        det.w = w / config_.input_width;
        det.h = h / config_.input_height;
        det.confidence = max_conf;
        det.class_id = max_class;
        det.label = (max_class < (int)class_names_.size()) ? class_names_[max_class] : "unknown";

        // Clamp to [0,1]
        det.x = std::max(0.0f, std::min(1.0f, det.x));
        det.y = std::max(0.0f, std::min(1.0f, det.y));
        det.w = std::min(det.w, 1.0f - det.x);
        det.h = std::min(det.h, 1.0f - det.y);

        detections.push_back(det);
    }

    return nms(detections);
}

std::vector<Detection> OnnxInference::nms(std::vector<Detection>& detections) const {
    if (detections.empty()) return {};

    // Sort by confidence
    std::sort(detections.begin(), detections.end(),
              [](const Detection& a, const Detection& b) { return a.confidence > b.confidence; });

    std::vector<Detection> result;
    std::vector<bool> suppressed(detections.size(), false);

    for (size_t i = 0; i < detections.size() && (int)result.size() < config_.max_detections; i++) {
        if (suppressed[i]) continue;
        
        result.push_back(detections[i]);

        const Detection& a = detections[i];
        for (size_t j = i + 1; j < detections.size(); j++) {
            if (suppressed[j]) continue;
            
            const Detection& b = detections[j];
            if (a.class_id != b.class_id) continue;

            // Calculate IoU
            float x1 = std::max(a.x, b.x);
            float y1 = std::max(a.y, b.y);
            float x2 = std::min(a.x + a.w, b.x + b.w);
            float y2 = std::min(a.y + a.h, b.y + b.h);

            float inter = std::max(0.0f, x2 - x1) * std::max(0.0f, y2 - y1);
            float area_a = a.w * a.h;
            float area_b = b.w * b.h;
            float iou = inter / (area_a + area_b - inter + 1e-6f);

            if (iou > config_.nms_threshold) {
                suppressed[j] = true;
            }
        }
    }

    return result;
}

InferenceResult OnnxInference::run(const uint8_t* bgr_data, int width, int height, int64_t timestamp_ms) {
    InferenceResult result;
    result.frame_width = width;
    result.frame_height = height;
    result.frame_timestamp_ms = timestamp_ms;
    result.infer_ms = 0;

    if (!loaded_ || !session_) {
        return result;
    }

    // Variable declarations for timing
    auto t1 = std::chrono::steady_clock::now();
    auto t2 = t1;
    auto t3 = t1;
    auto t4 = t1;
    auto t5 = t1;
    auto t6 = t1;

    try {
        // Preprocess directly into pre-allocated input_buffer_
        // This updates the data pointed to by *input_tensor_
        t1 = std::chrono::steady_clock::now();
        preprocessToBuffer(bgr_data, width, height);
        t2 = std::chrono::steady_clock::now();

        // Explicitly prepare arguments for Run to resolve overload ambiguity
        Ort::RunOptions run_options{nullptr};
        
        const char* input_names_arr[] = { input_names_[0].c_str() };
        const char* output_names_arr[] = { output_names_[0].c_str() };
        
        // Void Run() overload: inputs and outputs are pre-allocated objects
        // output_tensors_.data() points to Ort::Value array.
        session_->Run(
            run_options,
            input_names_arr, input_tensors_.data(), 1,
            output_names_arr, output_tensors_.data(), 1
        );
        t4 = std::chrono::steady_clock::now();

        // Get output from persistent tensor
        float* output_data = output_tensors_[0].GetTensorMutableData<float>();
        auto output_info = output_tensors_[0].GetTensorTypeAndShapeInfo();
        auto output_shape = output_info.GetShape();
        
        size_t output_size = 1;
        for (auto dim : output_shape) output_size *= dim;

        std::vector<float> output(output_data, output_data + output_size);

        // Postprocess
        t5 = std::chrono::steady_clock::now();
        result.detections = postprocess(output, width, height);
        t6 = std::chrono::steady_clock::now();

    } catch (const Ort::Exception& e) {
        LOG_ERROR("Inference error: {}", e.what());
    }

    auto end = std::chrono::steady_clock::now();
    result.infer_ms = std::chrono::duration<double, std::milli>(end - t1).count();

    // Log breakdown if slow (>100ms)
    // Only log every 30 frames to avoid spamming console
    return result;
}

} // namespace ai
} // namespace vms
