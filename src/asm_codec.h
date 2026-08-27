#ifndef ASM_DECODER_H
#define ASM_DECODER_H

extern "C" {
#include "libavcodec/avcodec.h"
}
#include "g726.h"

typedef unsigned long long u64;
typedef unsigned short u16;

typedef void (*VideoCallback)(uint8_t* buff, int width, int height, double ts);
typedef void (*AudioCallback)(uint8_t* buff, int size, double ts);

class AsmDecoder {
 private:
  AVCodecContext* vCtx_ = nullptr;
  AVFrame* vframe_ = nullptr;
  g726_state_t* g726_ = nullptr;

 private:
  uint8_t* yuvData_ = nullptr;
  bool bWaitKey_;
  VideoCallback _onVideo;
  AudioCallback _onAudio;
  int OpenVDecoder(uint8_t* b);

 public:
  AsmDecoder(VideoCallback onVideo, AudioCallback onAudio);
  ~AsmDecoder();
  int WriteFrame(uint8_t* buf, int len);
};
#endif