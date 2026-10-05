package com.avenzo.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.pose.Pose;
import com.google.mlkit.vision.pose.PoseDetection;
import com.google.mlkit.vision.pose.PoseDetector;
import com.google.mlkit.vision.pose.PoseLandmark;
import com.google.mlkit.vision.pose.accurate.AccuratePoseDetectorOptions;
import com.google.mlkit.vision.segmentation.Segmentation;
import com.google.mlkit.vision.segmentation.SegmentationMask;
import com.google.mlkit.vision.segmentation.Segmenter;
import com.google.mlkit.vision.segmentation.selfie.SelfieSegmenterOptions;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import java.io.ByteArrayOutputStream;
import java.nio.FloatBuffer;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;

/** User-triggered on-device tools. No image leaves this worker. */
final class OfflinePhotoStudio {
  interface Sink { void deliver(String callback, String result); }
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final AtomicBoolean busy = new AtomicBoolean();
  private volatile boolean closed;
  private final Sink sink;
  OfflinePhotoStudio(Sink sink) { this.sink = sink; }
  // Let an active inference finish before recycling its input bitmap. The web
  // request times out independently; shutdown must never interrupt model reads.
  void close() { closed = true; worker.shutdown(); }
  private void reply(String callback, JSONObject value) {
    if (!closed) sink.deliver(callback, value.toString());
  }
  private JSONObject error(String value) {
    JSONObject result = new JSONObject();
    try { result.put("ok", false).put("error", value); } catch (Exception ignored) {}
    return result;
  }
  void process(String dataUrl, String action, String callback) {
    if (callback == null || !callback.matches("[A-Za-z0-9_$]{1,100}")) return;
    if (closed) return;
    if (dataUrl == null || dataUrl.length() > 12000000 ||
        !dataUrl.matches("(?s)^data:image/(jpeg|png|webp);base64,.*") ||
        action == null || !action.matches("frame|cutout|codes")) {
      reply(callback, error("INVALID_IMAGE")); return;
    }
    if (!busy.compareAndSet(false, true)) { reply(callback, error("BUSY")); return; }
    try {
      worker.execute(() -> {
        Bitmap bitmap = null, output = null;
        try {
          byte[] bytes = Base64.decode(dataUrl.substring(dataUrl.indexOf(',') + 1), Base64.DEFAULT);
          BitmapFactory.Options bounds = new BitmapFactory.Options();
          bounds.inJustDecodeBounds = true;
          BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
          if (bounds.outWidth <= 0 || bounds.outHeight <= 0 ||
              (long) bounds.outWidth * bounds.outHeight > 200000000L) throw new IllegalArgumentException();
          BitmapFactory.Options options = new BitmapFactory.Options();
          options.inSampleSize = 1;
          while (Math.max(bounds.outWidth, bounds.outHeight) / options.inSampleSize > 2048) options.inSampleSize *= 2;
          options.inPreferredConfig = Bitmap.Config.ARGB_8888;
          bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
          if (bitmap == null) throw new IllegalArgumentException();
          InputImage input = InputImage.fromBitmap(bitmap, 0);
          JSONObject result = new JSONObject().put("ok", true);
          if (action.equals("codes")) {
            BarcodeScanner scanner = BarcodeScanning.getClient();
            try {
              JSONArray values = new JSONArray();
              for (Barcode code : Tasks.await(scanner.process(input))) {
                String value = code.getRawValue();
                if (value != null && value.length() <= 4096 && values.length() < 10)
                  values.put(new JSONObject().put("value", value).put("format", code.getFormat()));
              }
              result.put("codes", values);
            } finally { scanner.close(); }
          } else if (action.equals("frame")) {
            PoseDetector detector = PoseDetection.getClient(new AccuratePoseDetectorOptions.Builder()
              .setDetectorMode(AccuratePoseDetectorOptions.SINGLE_IMAGE_MODE).build());
            try {
              Pose pose = Tasks.await(detector.process(input));
              float left = bitmap.getWidth(), top = bitmap.getHeight(), right = 0, bottom = 0;
              int count = 0;
              for (PoseLandmark point : pose.getAllPoseLandmarks()) {
                if (point.getInFrameLikelihood() < .65f) continue;
                float x = point.getPosition().x, y = point.getPosition().y;
                if (x < 0 || y < 0 || x >= bitmap.getWidth() || y >= bitmap.getHeight()) continue;
                left = Math.min(left, x); right = Math.max(right, x);
                top = Math.min(top, y); bottom = Math.max(bottom, y); count++;
              }
              if (count < 5) { reply(callback, error("NO_PERSON")); return; }
              int[] crop = StudioGeometry.portraitCrop(bitmap.getWidth(), bitmap.getHeight(), left, top, right, bottom);
              output = Bitmap.createBitmap(bitmap, crop[0], crop[1], crop[2], crop[3]);
            } finally { detector.close(); }
          } else {
            Segmenter segmenter = Segmentation.getClient(new SelfieSegmenterOptions.Builder()
              .setDetectorMode(SelfieSegmenterOptions.SINGLE_IMAGE_MODE).build());
            try {
              SegmentationMask mask = Tasks.await(segmenter.process(input));
              FloatBuffer probabilities = mask.getBuffer().asFloatBuffer();
              int w = bitmap.getWidth(), h = bitmap.getHeight();
              if (mask.getWidth() != w || mask.getHeight() != h || probabilities.remaining() != w * h)
                throw new IllegalArgumentException();
              int[] pixels = new int[w * h];
              bitmap.getPixels(pixels, 0, w, 0, 0, w, h);
              int foreground = 0;
              for (int i = 0; i < pixels.length; i++) {
                float confidence = probabilities.get();
                int alpha = StudioGeometry.alpha(confidence, pixels[i] >>> 24);
                if (alpha > 200) foreground++;
                pixels[i] = (pixels[i] & 0x00ffffff) | (alpha << 24);
              }
              if (foreground < pixels.length / 100) { reply(callback, error("NO_PERSON")); return; }
              output = Bitmap.createBitmap(pixels, w, h, Bitmap.Config.ARGB_8888);
            } finally { segmenter.close(); }
          }
          if (output != null) {
            ByteArrayOutputStream encoded = new ByteArrayOutputStream();
            output.compress(Bitmap.CompressFormat.PNG, 100, encoded);
            if (encoded.size() > 8500000) { reply(callback, error("OUTPUT_TOO_LARGE")); return; }
            result.put("image", "data:image/png;base64," + Base64.encodeToString(encoded.toByteArray(), Base64.NO_WRAP));
          }
          reply(callback, result);
        } catch (InterruptedException interrupted) {
          Thread.currentThread().interrupt(); reply(callback, error("CANCELLED"));
        } catch (Exception failed) { reply(callback, error("PROCESSING_FAILED")); }
        finally {
          if (output != null && output != bitmap) output.recycle();
          if (bitmap != null) bitmap.recycle();
          busy.set(false);
        }
      });
    } catch (java.util.concurrent.RejectedExecutionException stopped) {
      busy.set(false); reply(callback, error("CANCELLED"));
    }
  }
}
