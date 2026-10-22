package dev.sainikhil.immersivear.ar;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class AlignmentTest {
    private static final double EPS = 1e-9;

    @Test
    public void checkpointMapsToCameraPosition() {
        Alignment a = new Alignment(2, -3, 0, -1, -1.4, 100, 200, 0);
        double[] p = a.toAr(100, 200);
        assertEquals(2, p[0], EPS);
        assertEquals(-3, p[1], EPS);
        assertEquals(-1.4, a.floorY(), EPS);
    }

    @Test
    public void facingNorthWhileLookingDownMinusZ() {
        // Camera looks along AR -Z; checkpoint faces north. Then north = -Z and east = +X.
        Alignment a = new Alignment(0, 0, 0, -1, 0, 0, 0, 0);
        double[] tenNorth = a.toAr(0, 10);
        assertEquals(0, tenNorth[0], EPS);
        assertEquals(-10, tenNorth[1], EPS);
        double[] fiveEast = a.toAr(5, 0);
        assertEquals(5, fiveEast[0], EPS);
        assertEquals(0, fiveEast[1], EPS);
    }

    @Test
    public void facingEastRotatesTheWholeMap() {
        // Checkpoint faces east (90 deg) and camera looks along +X. Then east = +X, north = -Z.
        Alignment a = new Alignment(0, 0, 1, 0, 0, 0, 0, 90);
        double[] east = a.toAr(10, 0);
        assertEquals(10, east[0], EPS);
        assertEquals(0, east[1], EPS);
        double[] north = a.toAr(0, 10);
        assertEquals(0, north[0], EPS);
        assertEquals(-10, north[1], EPS);
    }

    @Test
    public void roundTripIsExact() {
        Alignment a = new Alignment(1.5, -0.25, 0.3, -0.9, 0, -120, 300, 37);
        double[][] pts = { { -120, 300 }, { 0, 0 }, { 150, 250 }, { -140.5, 350.25 } };
        for (double[] p : pts) {
            double[] ar = a.toAr(p[0], p[1]);
            double[] back = a.toCampus(ar[0], ar[1]);
            assertEquals(p[0], back[0], 1e-9);
            assertEquals(p[1], back[1], 1e-9);
        }
    }

    @Test
    public void distancesArePreserved() {
        Alignment a = new Alignment(0, 0, 0.6, 0.8, 0, 0, 0, 213);
        double[] p = a.toAr(3, 4);
        assertEquals(5, Math.hypot(p[0], p[1]), 1e-9);
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectsPhonePointingStraightDown() {
        new Alignment(0, 0, 0, 0, 0, 0, 0, 0);
    }
}
