import { CameraAvStreamManagement } from "@matter/main/clusters";
import { CameraDevice } from "@matter/main/devices";
import { StreamUsage } from "@matter/types";
import { CameraAvStreamServer } from "./av-stream-server.js";
import type { WebRtcBridge } from "./webrtc-bridge.js";
import { CameraWebRtcProviderServer } from "./webrtc-provider-server.js";

// Video sensor geometry the Matter cluster wants up front. Mandatory under the
// Video feature, so it has to be set or the endpoint fails conformance on init.
export interface CameraSensorParams {
  sensorWidth: number;
  sensorHeight: number;
  maxFps: number;
}

export const defaultSensorParams: CameraSensorParams = {
  sensorWidth: 1920,
  sensorHeight: 1080,
  maxFps: 30,
};

// Builds the Matter Camera (0x0142) endpoint and injects the bridge + entity id.
// The capability defaults below are sane guesses, not verified on a controller.
export function createCameraEndpointType(
  bridge: WebRtcBridge,
  entityId: string,
  sensor: CameraSensorParams = defaultSensorParams,
) {
  return CameraDevice.with(
    CameraAvStreamServer,
    CameraWebRtcProviderServer,
  ).set({
    webRtcTransportProvider: {
      bridge,
      entityId,
      currentSessions: [],
    },
    cameraAvStreamManagement: {
      bridge,
      entityId,
      supportedStreamUsages: [StreamUsage.LiveView],
      streamUsagePriorities: [StreamUsage.LiveView],
      allocatedVideoStreams: [],
      allocatedAudioStreams: [],
      allocatedSnapshotStreams: [],
      maxConcurrentEncoders: 1,
      maxEncodedPixelRate: 3840 * 2160 * 30,
      maxNetworkBandwidth: 20_000_000, // 20 Mbps, attribute is bits per second
      currentFrameRate: 0,
      videoSensorParams: {
        sensorWidth: sensor.sensorWidth,
        sensorHeight: sensor.sensorHeight,
        maxFps: sensor.maxFps,
      },
      viewport: {
        x1: 0,
        y1: 0,
        x2: sensor.sensorWidth,
        y2: sensor.sensorHeight,
      },
      minViewportResolution: { width: 64, height: 64 },
      rateDistortionTradeOffPoints: [
        {
          codec: CameraAvStreamManagement.VideoCodec.H264,
          resolution: {
            width: sensor.sensorWidth,
            height: sensor.sensorHeight,
          },
          minBitRate: 10_000,
        },
      ],
      maxContentBufferSize: 1_048_576, // one snapshot jpeg in flight
      // HA's audio relayed as is. werift offers HA Opus first, then PCMU,
      // which has no Matter AudioCodec. Opus runs at 8, 12, 16, 24 and 48 kHz
      // (RFC 6716) with up to two channels on RTP (RFC 7587). Opus has no bit
      // depth of its own; 24 and 32 are what the CHIP example camera lists.
      microphoneCapabilities: {
        maxNumberOfChannels: 2,
        supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus],
        supportedSampleRates: [48_000, 24_000, 16_000, 12_000, 8_000],
        supportedBitDepths: [16, 24, 32],
      },
      microphoneMuted: false,
      // The relay cannot change the gain. Min equal to max is how a camera
      // says so, SmartThings then hides the volume control.
      microphoneVolumeLevel: 254,
      microphoneMaxLevel: 254,
      microphoneMinLevel: 254,
      // ImageControl attributes: matter.js conformance (since 0.17.5) forces the
      // feature. Controllers can write these but the proxied HA media path
      // never applies a transform.
      imageRotation: 0,
      imageFlipHorizontal: false,
      imageFlipVertical: false,
      snapshotCapabilities: [
        {
          resolution: {
            width: sensor.sensorWidth,
            height: sensor.sensorHeight,
          },
          maxFrameRate: 1,
          imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg,
          requiresEncodedPixels: false,
        },
      ],
      nextVideoStreamId: 1,
      nextSnapshotStreamId: 1,
    },
  });
}
