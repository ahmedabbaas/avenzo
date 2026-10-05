package com.avenzo.app;
import org.junit.Test;
import static org.junit.Assert.*;

public class StudioGeometryTest {
  @Test public void framesStayInsideSmallAndExtremeImages() {
    for (int[] size : new int[][]{{1,1},{10,200},{200,10},{1080,1920},{2048,2048}}) {
      int[] crop = StudioGeometry.portraitCrop(size[0], size[1], 0, 0, size[0]-1, size[1]-1);
      assertTrue(crop[0] >= 0 && crop[1] >= 0 && crop[2] > 0 && crop[3] > 0);
      assertTrue(crop[0] + crop[2] <= size[0]);
      assertTrue(crop[1] + crop[3] <= size[1]);
    }
  }
  @Test public void portraitRatioAndSubjectCenterArePreserved() {
    int[] crop = StudioGeometry.portraitCrop(1200, 1600, 400, 200, 700, 1100);
    assertEquals(.8, (double) crop[2]/crop[3], .002);
    assertEquals(550, crop[0]+crop[2]/2, 1);
    assertTrue(crop[1] <= 200 && crop[1]+crop[3] >= 1100);
  }
  @Test public void cutoutKeepsExistingTransparencyAndSoftEdges() {
    assertEquals(0, StudioGeometry.alpha(.1f, 255));
    assertEquals(128, StudioGeometry.alpha(.95f, 128));
    assertEquals(0, StudioGeometry.alpha(1f, 0));
    assertTrue(StudioGeometry.alpha(.65f,255) > 0 && StudioGeometry.alpha(.65f,255) < 255);
    int previous = 0;
    for (int i = 0; i <= 100; i++) {
      int next = StudioGeometry.alpha(i/100f, 255);
      assertTrue(next >= previous && next <= 255); previous = next;
    }
  }
}
