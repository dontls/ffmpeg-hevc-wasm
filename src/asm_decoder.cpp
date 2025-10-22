
#ifdef __cplusplus
extern "C" {
#endif

typedef unsigned long long u64;
typedef unsigned short u16;

#include "libavcodec/avcodec.h"
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef void (*CallVideo)(uint8_t* buff, int width, int height, double ts);
typedef void (*CallAudio)(uint8_t* buff, int size);

// 媒体数据头
#pragma pack(4)
struct MediaHeader_t {
  u16 frame;      // 帧类型 howenDriver::enums::e_frame_type
  u16 channel;    // 通道编号，从1开始
  u64 timestamp;  // 时间戳
};
#pragma pack()

class AsmDecoder {
 private:
  AVCodecContext* vCtx_ = nullptr;
  AVFrame* vframe_ = nullptr;
  AVPacket* vpkt_ = nullptr;

 private:
  uint8_t* yuvData_ = nullptr;
  bool bWaitKey_;
  CallVideo vcall_;
  CallAudio acall_;

 public:
  AsmDecoder(long onVideo, long onAudio);
  ~AsmDecoder();
  int OpenVDecoder(uint8_t* b);
  int WriteFrame(uint8_t* buf, int len);
};

AsmDecoder::AsmDecoder(long onVideo, long onAudio) : bWaitKey_(true) {
  vcall_ = (CallVideo)onVideo;
  acall_ = (CallAudio)onAudio;
}

AsmDecoder::~AsmDecoder() {
  if (vCtx_) {
    avcodec_free_context(&vCtx_);
    vCtx_ = NULL;
  }
  if (vframe_) {
    av_frame_free(&vframe_);
    vframe_ = NULL;
  }

  if (yuvData_) {
    delete[] yuvData_;
    yuvData_ = NULL;
  }
  if (vpkt_) {
    av_packet_free(&vpkt_);
    vpkt_ = NULL;
  }
}

int AsmDecoder::OpenVDecoder(uint8_t* b) {
  AVDictionary* opts = NULL;
  auto codeId = (b[4] & 0xf0) == 0x60 ? AV_CODEC_ID_H264
                                      : AV_CODEC_ID_H265;  // 这里解析视频流格式
  printf("video 0x%02x format %d\n", b[4], codeId);
  const AVCodec* pDecoder = avcodec_find_decoder(codeId);
  if (NULL == pDecoder) {
    return -1;
  }
  vCtx_ = avcodec_alloc_context3(pDecoder);
  // vCtx_->pix_fmt = AV_PIX_FMT_YUV420P;
  av_dict_set(&opts, "refcounted_frames", "0", 0);
  if (avcodec_open2(vCtx_, pDecoder, NULL) < 0) {
    return -2;
  }
  vframe_ = av_frame_alloc();
  vpkt_ = av_packet_alloc();
  bWaitKey_ = false;
  return 0;
}

int AsmDecoder::WriteFrame(uint8_t* frame, int len) {
  int retCode = 0;
  MediaHeader_t* h = (MediaHeader_t*)frame;
  uint8_t* data = frame + 12;
  if (bWaitKey_) {
    // printf("frame %d channel %d\n", h->frame, h->channel);
    if (h->frame != 1) {
      return -1;
    }
    if ((retCode = this->OpenVDecoder(data)) < 0) {
      return retCode;
    }
  }
  if (h->frame < 3) {
    vpkt_->data = data;
    vpkt_->size = len - 12;
    int ret = avcodec_send_packet(vCtx_, vpkt_);
    if (ret < 0 && ret != AVERROR(EAGAIN) && ret != AVERROR_EOF) {
      return ret;
    }
    if ((ret = avcodec_receive_frame(vCtx_, vframe_)) < 0) {
      return ret;
    }
    size_t y_size = vCtx_->width * vCtx_->height;
    if (yuvData_ == nullptr) {
      yuvData_ = new uint8_t[y_size * 3 / 2];
    }
    size_t uv_size = y_size / 4;
    memcpy(yuvData_, vframe_->data[0], y_size);                      // Y
    memcpy(yuvData_ + y_size, vframe_->data[1], uv_size);            // U
    memcpy(yuvData_ + y_size + uv_size, vframe_->data[2], uv_size);  // V
    // // 解码数据回调
    this->vcall_(yuvData_, vCtx_->width, vCtx_->height,
                 double(h->timestamp / 1000));
    // printf("retcode %d length %d, w %d, h %d\n", retCode, len, vCtx_->width,
    //        vCtx_->height);
  }
  // g726 decode
  return retCode;
}

AsmDecoder* _decoder = nullptr;

AsmDecoder* jsNewDecoder(long onVideo, long onAudio) {
  _decoder = new AsmDecoder(onVideo, onAudio);
  return _decoder;
}

int jsDecodec(uint8_t* frame, int len) {
  if (NULL == _decoder) {
    return -1;
  }
  return _decoder->WriteFrame(frame, len);
}

void jsReleaseDecoder() {
  if (_decoder) {
    delete _decoder;
    _decoder = NULL;
  }
}

#ifdef __cplusplus
}
#endif
