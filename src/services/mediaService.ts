
/**
 * Compresses a video file by downsampling it using Canvas and MediaRecorder.
 * This is a client-side only solution to fit videos into Firestore's 1MB limit.
 */
export async function compressVideo(
  file: File, 
  onProgress: (progress: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('crossOrigin', 'anonymous');

    video.onloadedmetadata = async () => {
      // Set target resolution (e.g., 360p)
      const targetWidth = 360;
      const targetHeight = (video.videoHeight / video.videoWidth) * targetWidth;
      
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { alpha: false });
      
      if (!ctx) {
        reject(new Error("Could not initialize canvas context"));
        return;
      }

      // Check for supported mime types
      const types = [
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4'
      ];
      const mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || '';

      const stream = canvas.captureStream(24); // 24 FPS
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 120000 // 120kbps - very aggressive to ensure <1MB
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          URL.revokeObjectURL(video.src);
          // Final safety check: if result is still too big, we might need to alert
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      };

      try {
        await video.play();
        recorder.start();

        const duration = video.duration;
        const processFrame = () => {
          if (video.paused || video.ended) {
            if (recorder.state !== 'inactive') recorder.stop();
            return;
          }

          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          onProgress((video.currentTime / duration) * 100);
          requestAnimationFrame(processFrame);
        };

        requestAnimationFrame(processFrame);
      } catch (err) {
        URL.revokeObjectURL(video.src);
        reject(err);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Error loading video file"));
    };
  });
}

/**
 * Compresses an image file by resizing it and lowering quality to fit constraints.
 */
export async function compressImage(base64Str: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_DIMENSION = 1600; 
      let width = img.width;
      let height = img.height;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height *= MAX_DIMENSION / width;
          width = MAX_DIMENSION;
        } else {
          width *= MAX_DIMENSION / height;
          height = MAX_DIMENSION;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      
      let quality = 0.8;
      let result = canvas.toDataURL('image/jpeg', quality);
      
      while (result.length > 900000 && quality > 0.1) {
        quality -= 0.1;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      
      resolve(result);
    };
  });
}

/**
 * Checks if a video duration is within limits.
 */
export async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      resolve(0);
    };
    video.src = URL.createObjectURL(file);
  });
}
