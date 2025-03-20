/**
 * Barcode scanning service for React PWA
 * Optimized for reliable EAN-13 detection
 */
class BarcodeService {
  constructor() {
    this.isInitialized = false;
    this.scanner = null;
    this.stream = null;
    this.scanInterval = null;
    this.lastResult = null;
    this.scanCallback = null;
    this.processingFrame = false;
  }

  /**
   * Initialize the barcode scanner
   * @returns {Promise<boolean>} - Success status
   */
  async initialize() {
    if (this.isInitialized) return true;

    try {
      // Import ZXing dynamically
      if (!window.ZXing) {
        await this.loadZXingLibrary();
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize barcode scanner:', error);
      return false;
    }
  }

  /**
   * Load ZXing library
   * @returns {Promise<void>}
   */
  loadZXingLibrary() {
    return new Promise((resolve, reject) => {
      if (window.ZXing) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = '/scripts/zxing.min.js';
      script.async = true;
      script.onload = () => {
        console.log('ZXing library loaded');
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load ZXing library'));
      document.head.appendChild(script);
    });
  }

  /**
   * Checks if the device has a camera
   * @returns {Promise<boolean>} - True if camera is available
   */
  async hasCamera() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('Error checking for camera:', error);
      return false;
    }
  }

  /**
   * Gets available cameras
   * @returns {Promise<MediaDeviceInfo[]>} - Array of camera devices
   */
  async getCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('Error getting cameras:', error);
      return [];
    }
  }

  /**
   * Start camera stream with optimal settings for barcode scanning
   * @param {HTMLVideoElement} videoElement - Video element to display the camera
   * @param {string|null} deviceId - Optional device ID for specific camera
   * @returns {Promise<MediaStream|null>} - Camera stream or null on error
   */
  async startCamera(videoElement, deviceId = null) {
    try {
      // Stop any existing stream
      this.stopCamera();

      // Define camera constraints optimized for barcode scanning
      const constraints = {
        video: {
          facingMode: 'environment', // Prefer back camera
          width: { min: 720, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          aspectRatio: { ideal: 4 / 3 },
          focusMode: 'continuous', // Keep focus continuous
          // Higher frame rate for better scanning chances
          frameRate: { min: 15, ideal: 30 }
        },
        audio: false
      };

      // If specific device ID is provided
      if (deviceId) {
        constraints.video = {
          ...constraints.video,
          deviceId: { exact: deviceId }
        };
      }

      // Get the media stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stream = stream;

      // Get video track for additional settings
      const videoTrack = stream.getVideoTracks()[0];

      // Apply advanced settings if available
      if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
        try {
          const capabilities = videoTrack.getCapabilities();
          const settings = {};

          // Enable torch if available (helps with low light scanning)
          if (capabilities.torch) {
            settings.torch = true;
          }

          // Set focus mode to continuous if available
          if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
            settings.focusMode = 'continuous';
          }

          // Set manual focus distance if supported (middle distance works well for barcodes)
          if (capabilities.focusDistance) {
            settings.focusDistance =
              (capabilities.focusDistance.max - capabilities.focusDistance.min) / 2 +
              capabilities.focusDistance.min;
          }

          // Apply settings if any were defined
          if (Object.keys(settings).length > 0) {
            await videoTrack.applyConstraints({ advanced: [settings] });
          }
        } catch (e) {
          console.warn('Could not apply advanced camera settings:', e);
        }
      }

      // Set the stream to the video element
      if (videoElement) {
        videoElement.srcObject = stream;

        // Make sure video plays automatically
        videoElement.setAttribute('playsinline', 'true');
        videoElement.setAttribute('autoplay', 'true');
        videoElement.setAttribute('muted', 'true');

        // Wait for video to be ready
        await new Promise((resolve) => {
          const onReady = () => {
            videoElement.play().then(resolve).catch(resolve);
          };

          videoElement.onloadedmetadata = onReady;

          // In case the video is already loaded
          if (videoElement.readyState >= 2) {
            onReady();
          }
        });
      }

      return stream;
    } catch (error) {
      console.error('Error starting camera:', error);

      if (error.name === 'NotAllowedError') {
        throw new Error('Camera access denied. Please grant camera permission.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No camera found on this device.');
      } else {
        throw new Error(`Camera error: ${error.message}`);
      }
    }
  }

  /**
   * Stop camera stream
   */
  stopCamera() {
    if (this.stream) {
      const tracks = this.stream.getTracks();
      tracks.forEach(track => track.stop());
      this.stream = null;
    }

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  /**
   * Start scanning for barcodes with special focus on EAN-13
   * @param {HTMLVideoElement} videoElement - Video element with the camera feed
   * @param {Function} callback - Function to call when a barcode is detected
   * @param {string|null} deviceId - Optional device ID for specific camera
   */
  async startScanning(videoElement, callback, deviceId = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Store callback
    this.scanCallback = callback;

    // Initialize last result
    this.lastResult = null;

    try {
      // Start camera
      await this.startCamera(videoElement, deviceId);

      // Create barcode reader if necessary
      if (!this.scanner && window.ZXing) {
        const hints = new Map();

        // Primary scan formats - EAN_13 as the first priority
        const formats = [
          ZXing.BarcodeFormat.EAN_13,
          ZXing.BarcodeFormat.UPC_A,     // UPC-A is a subset of EAN-13
          ZXing.BarcodeFormat.EAN_8,
          ZXing.BarcodeFormat.UPC_E,
          ZXing.BarcodeFormat.CODE_128,
          ZXing.BarcodeFormat.CODE_39,
          ZXing.BarcodeFormat.CODE_93,
          ZXing.BarcodeFormat.CODABAR,
          ZXing.BarcodeFormat.QR_CODE,
          ZXing.BarcodeFormat.DATA_MATRIX
        ];

        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

        // Add specific hints for EAN detection
        if (ZXing.DecodeHintType.ASSUME_EAN13_CHECK_DIGIT) {
          hints.set(ZXing.DecodeHintType.ASSUME_EAN13_CHECK_DIGIT, true);
        }
        if (ZXing.DecodeHintType.ASSUME_EAN13_EXTENSION) {
          hints.set(ZXing.DecodeHintType.ASSUME_EAN13_EXTENSION, true);
        }

        // Additional hints for better detection
        if (ZXing.DecodeHintType.CHARACTER_SET) {
          hints.set(ZXing.DecodeHintType.CHARACTER_SET, "ISO-8859-1");
        }
        if (ZXing.DecodeHintType.PURE_BARCODE) {
          hints.set(ZXing.DecodeHintType.PURE_BARCODE, true);
        }

        this.scanner = new ZXing.MultiFormatReader();
        this.scanner.setHints(hints);
      }

      // Start scanning interval - using a faster interval for better detection
      if (this.scanInterval) {
        clearInterval(this.scanInterval);
      }

      this.scanInterval = setInterval(() => {
        if (videoElement && videoElement.readyState === videoElement.HAVE_ENOUGH_DATA && !this.processingFrame) {
          this.scanBarcode(videoElement);
        }
      }, 100); // Scan every 100ms for better detection chance

    } catch (error) {
      console.error('Error starting barcode scanning:', error);
      throw error;
    }
  }

  /**
   * Scan for barcode in the current video frame with EAN-13 optimizations
   * @param {HTMLVideoElement} videoElement - Video element with the camera feed
   */
  scanBarcode(videoElement) {
    this.processingFrame = true;

    try {
      // Create temporary canvas to process the frame
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Set canvas size to match video
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;

      // Draw video frame to canvas
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      // Try multiple scanning approaches for better EAN-13 detection
      const scanApproaches = [
        // Standard scan
        () => this.performScan(canvas),

        // Try with enhanced contrast
        () => {
          const enhancedCanvas = this.enhanceImageForBarcode(canvas);
          return this.performScan(enhancedCanvas);
        },

        // Try scanning the middle strip of the image for horizontal barcodes
        () => {
          const middleStripCanvas = document.createElement('canvas');
          const stripCtx = middleStripCanvas.getContext('2d');
          const stripHeight = Math.floor(canvas.height / 5);
          const stripY = Math.floor(canvas.height / 2) - Math.floor(stripHeight / 2);

          middleStripCanvas.width = canvas.width;
          middleStripCanvas.height = stripHeight;

          stripCtx.drawImage(
            canvas,
            0, stripY, canvas.width, stripHeight,
            0, 0, canvas.width, stripHeight
          );

          return this.performScan(middleStripCanvas);
        }
      ];

      // Try each approach until one succeeds
      for (const approach of scanApproaches) {
        const result = approach();
        if (result) {
          // Process the result and exit
          this.processResult(result);
          return;
        }
      }
    } catch (error) {
      console.error('Error processing video frame:', error);
    } finally {
      this.processingFrame = false;
    }
  }

  /**
   * Enhance image for better barcode detection
   * @param {HTMLCanvasElement} canvas - Canvas with the source image
   * @returns {HTMLCanvasElement} - Canvas with enhanced image
   */
  enhanceImageForBarcode(sourceCanvas) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;

    // Draw the original image
    ctx.drawImage(sourceCanvas, 0, 0);

    // Get image data for processing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Enhance contrast
    const contrast = 1.5; // Increase contrast
    const brightness = 0;

    for (let i = 0; i < data.length; i += 4) {
      // Convert to grayscale
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;

      // Apply contrast and brightness
      const newValue = (avg - 128) * contrast + 128 + brightness;

      // Apply binary threshold for sharper barcode edges
      const thresholdValue = newValue > 120 ? 255 : 0;

      // Set RGB to the new value
      data[i] = thresholdValue;     // R
      data[i + 1] = thresholdValue; // G
      data[i + 2] = thresholdValue; // B
      // Don't modify alpha (i + 3)
    }

    // Put the modified data back on the canvas
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * Perform scan on a canvas with error handling
   * @param {HTMLCanvasElement} canvas - Canvas to scan
   * @returns {Object|null} - Scan result or null if none found
   */
  performScan(canvas) {
    try {
      // Create luminance source
      const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
      const binaryBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource));

      try {
        // Try to decode the image
        return this.scanner.decode(binaryBitmap);
      } catch (error) {
        // Try with pure luminance binarizer for EAN codes (sometimes works better)
        if (error instanceof ZXing.NotFoundException) {
          try {
            const pureBitmap = new ZXing.BinaryBitmap(new ZXing.GlobalHistogramBinarizer(luminanceSource));
            return this.scanner.decode(pureBitmap);
          } catch (e) {
            return null; // No code found with either binarizer
          }
        }
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Process a successful scan result
   * @param {Object} result - ZXing scan result
   */
  processResult(result) {
    if (!result || !result.text) return;

    // For EAN-13, validate the check digit
    if (result.format === ZXing.BarcodeFormat.EAN_13 || result.text.length === 13) {
      if (!this.validateEan13(result.text)) {
        console.log('Invalid EAN-13 check digit, ignoring scan');
        return;
      }
    }

    // If we got a result and it's different from the last one
    if (result.text !== this.lastResult) {
      this.lastResult = result.text;

      // Get format name if possible
      let format = 'Unknown';
      try {
        format = Object.keys(ZXing.BarcodeFormat)
          .find(key => ZXing.BarcodeFormat[key] === result.format) || 'Unknown';
      } catch (e) {
        // Determine format by length as fallback
        if (result.text.length === 13) format = 'EAN_13';
        else if (result.text.length === 8) format = 'EAN_8';
      }

      // Call callback with barcode text and format
      if (this.scanCallback) {
        this.scanCallback(result.text, format);
      }
    }
  }

  /**
   * Validate EAN-13 barcode using the check digit
   * @param {string} ean - EAN-13 barcode string
   * @returns {boolean} - Whether the check digit is valid
   */
  validateEan13(ean) {
    // Make sure it's a string with exactly 13 digits
    if (typeof ean !== 'string' || ean.length !== 13 || !/^\d+$/.test(ean)) {
      return false;
    }

    // Calculate check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(ean[i]) * (i % 2 === 0 ? 1 : 3);
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    const providedCheckDigit = parseInt(ean[12]);

    return checkDigit === providedCheckDigit;
  }

  /**
   * Stop scanning
   */
  stopScanning() {
    this.stopCamera();
    this.scanCallback = null;
  }
}

// Create a singleton instance
const barcodeService = new BarcodeService();

// Add React hook for easier integration
export const useBarcodeScanner = (videoRef, options = {}) => {
  const { enabled = false, onDetect = null, deviceId = null } = options;
  const [isScanning, setIsScanning] = React.useState(false);
  const [lastResult, setLastResult] = React.useState(null);

  React.useEffect(() => {
    // Handle scanning state changes
    if (enabled && videoRef.current && !isScanning) {
      const handleDetection = (text, format) => {
        setLastResult({ text, format });
        if (onDetect) onDetect(text, format);
      };

      barcodeService.startScanning(videoRef.current, handleDetection, deviceId)
        .then(() => setIsScanning(true))
        .catch(error => console.error('Barcode scanning error:', error));
    } else if (!enabled && isScanning) {
      barcodeService.stopScanning();
      setIsScanning(false);
    }

    // Cleanup on unmount
    return () => {
      if (isScanning) {
        barcodeService.stopScanning();
      }
    };
  }, [enabled, videoRef, deviceId, onDetect, isScanning]);

  return {
    isScanning,
    lastResult,
    stop: () => barcodeService.stopScanning(),
    getCameras: () => barcodeService.getCameras()
  };
};

export default barcodeService;