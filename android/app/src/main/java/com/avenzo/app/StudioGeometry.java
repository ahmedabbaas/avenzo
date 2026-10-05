package com.avenzo.app;

final class StudioGeometry {
  private StudioGeometry() {}
  static int alpha(float confidence, int sourceAlpha) {
    float amount = Math.max(0, Math.min(1, (confidence - .35f) / .55f));
    amount = amount * amount * (3 - 2 * amount);
    return Math.round(sourceAlpha * amount);
  }
  static int[] portraitCrop(int width, int height, float left, float top, float right, float bottom) {
    float neededHeight = Math.max((bottom - top) * 1.2f, (right - left) * 1.2f / .8f);
    int h = Math.max(5, Math.min(height, Math.round(neededHeight)));
    int w = Math.round(h * .8f);
    if (w > width) { w = width; h = Math.round(w / .8f); }
    w = Math.min(width, Math.max(1, w)); h = Math.min(height, Math.max(1, h));
    int x = Math.max(0, Math.min(width - w, Math.round((left + right - w) / 2)));
    int y = Math.max(0, Math.min(height - h, Math.round((top + bottom - h) / 2)));
    return new int[]{x, y, w, h};
  }
}
