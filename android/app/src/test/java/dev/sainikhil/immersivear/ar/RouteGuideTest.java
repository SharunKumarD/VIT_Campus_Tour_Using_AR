package dev.sainikhil.immersivear.ar;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import dev.sainikhil.immersivear.ar.RouteGuide.Instruction;
import dev.sainikhil.immersivear.ar.RouteGuide.Mode;
import dev.sainikhil.immersivear.ar.RouteGuide.Point;

import java.util.Arrays;
import java.util.List;

import org.junit.Test;

public class RouteGuideTest {

    /** 0,0 -> 0,50 -> 30,50 on the ground floor. Total 80 m. */
    private static RouteGuide straightThenRight() {
        List<Point> pts = Arrays.asList(
            new Point("a", 0, 0, 0, "start"),
            new Point("b", 0, 50, 0, "corner"),
            new Point("c", 30, 50, 0, "door"));
        List<Instruction> ins = Arrays.asList(
            new Instruction("Head north", "a"),
            new Instruction("Turn right at corner", "b"),
            new Instruction("Arrive at door", "c"));
        return new RouteGuide(pts, ins);
    }

    /** Ground floor to a lift, ride to floor 1, then a corridor. */
    private static RouteGuide withLift() {
        List<Point> pts = Arrays.asList(
            new Point("lobby", 0, 0, 0, "lobby"),
            new Point("lift0", 0, 20, 0, "lift"),
            new Point("lift1", 0, 20, 1, "lift landing"),
            new Point("corr1", 0, 30, 1, "corridor"),
            new Point("lab", 10, 30, 1, "lab"));
        List<Instruction> ins = Arrays.asList(
            new Instruction("Walk 20 m", "lobby"),
            new Instruction("Take the lift", "lift0"),
            new Instruction("Walk 10 m", "lift1"),
            new Instruction("Turn right", "corr1"),
            new Instruction("Arrive", "lab"));
        return new RouteGuide(pts, ins);
    }

    @Test
    public void startsAlignedOnlyAfterAlign() {
        RouteGuide g = straightThenRight();
        assertEquals(Mode.ALIGNING, g.getMode());
        g.update(0, 1, true, 1, 100); // ignored until aligned
        assertEquals(Mode.ALIGNING, g.getMode());
        assertTrue(g.alignAt("a", 1000));
        assertEquals(Mode.GUIDING, g.getMode());
        assertEquals(80, g.getRemainingM(), 1e-9);
    }

    @Test
    public void rejectsAlignmentAtNodeNotOnRoute() {
        assertFalse(straightThenRight().alignAt("elsewhere", 0));
    }

    @Test
    public void tracksProgressAndNextInstruction() {
        RouteGuide g = straightThenRight();
        g.alignAt("a", 0);
        g.update(0.4, 20, true, 20, 1000);
        assertEquals(60, g.getRemainingM(), 1e-6);
        assertEquals("Turn right at corner", g.nextInstruction().text);
        assertEquals(30, g.distanceToNextInstruction(), 1e-6);
        assertEquals(0.4, g.getOffRouteM(), 1e-9);
        g.update(10, 50.5, true, 30, 2000); // past the corner
        assertEquals(1, g.getSegment());
        assertEquals("Arrive at door", g.nextInstruction().text);
    }

    @Test
    public void arrivesNearTheDestination() {
        RouteGuide g = straightThenRight();
        g.alignAt("a", 0);
        g.update(0, 30, true, 30, 1000);
        g.update(28.5, 50, true, 28, 2000);
        assertEquals(Mode.ARRIVED, g.getMode());
    }

    @Test
    public void briefTrackingBlipsDoNotHideArrows() {
        RouteGuide g = straightThenRight();
        g.alignAt("a", 0);
        g.update(0, 5, false, 0, 1000);
        g.update(0, 5, false, 0, 2000); // 1.0 s lost: still inside the grace period
        assertEquals(Mode.GUIDING, g.getMode());
        g.update(0, 5, true, 0, 2100);
        assertEquals(Mode.GUIDING, g.getMode());
    }

    @Test
    public void sustainedTrackingLossHidesArrowsThenRecoversAfterStablePeriod() {
        RouteGuide g = straightThenRight();
        g.alignAt("a", 0);
        g.update(0, 5, false, 0, 1000);
        g.update(0, 5, false, 0, 2600); // 1.6 s lost
        assertEquals(Mode.LOST, g.getMode());
        assertEquals("tracking", g.getLostReason());
        g.update(0, 5, true, 0, 3000);  // back, but not yet stable
        assertEquals(Mode.LOST, g.getMode());
        g.update(0, 5, true, 0, 4100);  // stable for 1.1 s
        assertEquals(Mode.GUIDING, g.getMode());
        assertTrue(g.getEvents().stream().anyMatch(e -> e.type.equals("TRACKING_RECOVERED")));
    }

    @Test
    public void driftBudgetDegradesThenLoses() {
        RouteGuide g = straightThenRight();
        g.alignAt("a", 0);
        long t = 0;
        for (int i = 1; i <= 45; i++) g.update(0, Math.min(i, 49), true, 1, t += 100);
        assertEquals(Mode.DEGRADED, g.getMode());
        for (int i = 0; i < 40; i++) g.update(0, 10, true, 1, t += 100); // pacing back and forth
        assertEquals(Mode.LOST, g.getMode());
        assertEquals("drift", g.getLostReason());
        // Re-aligning at a checkpoint on the route restores guidance.
        assertTrue(g.alignAt("b", t += 100));
        assertEquals(Mode.GUIDING, g.getMode());
        assertEquals(0, g.getSinceAlignM(), 1e-9);
        assertEquals(1, g.getRealigns());
    }

    @Test
    public void jitterDoesNotConsumeTheDriftBudget() {
        RouteGuide g = straightThenRight();
        g.alignAt("a", 0);
        for (int i = 1; i <= 5000; i++) g.update(0, 1, true, 0.01, i);
        assertEquals(0, g.getSinceAlignM(), 1e-9);
        assertEquals(Mode.GUIDING, g.getMode());
    }

    @Test
    public void offRouteIsFlaggedOnlyAfterItPersists() {
        RouteGuide g = straightThenRight();
        g.alignAt("a", 0);
        g.update(8, 10, true, 1, 1000);
        assertFalse(g.isOffRoute());
        g.update(8, 10, true, 0, 4100);
        assertTrue(g.isOffRoute());
        g.update(0.5, 12, true, 1, 4200);
        assertFalse(g.isOffRoute());
    }

    @Test
    public void floorChangeAsksForRealignmentOnTheNewFloor() {
        RouteGuide g = withLift();
        g.alignAt("lobby", 0);
        g.update(0, 18, true, 18, 1000);
        assertEquals(Mode.NEED_REALIGN, g.getMode());
        assertEquals(1, g.levelAfterCurrentSpan());
        // Arrows stay hidden while waiting, whatever the camera reports.
        g.update(0, 19, true, 1, 2000);
        assertEquals(Mode.NEED_REALIGN, g.getMode());
        assertTrue(g.alignAt("corr1", 3000));
        assertEquals(Mode.GUIDING, g.getMode());
        assertEquals(10, g.getRemainingM(), 1e-9);
        g.update(9, 30, true, 9, 4000);
        assertEquals(Mode.ARRIVED, g.getMode());
    }

    @Test
    public void verticalLegsAddNoWalkingDistance() {
        RouteGuide g = withLift();
        g.alignAt("lobby", 0);
        assertEquals(40, g.getRemainingM(), 1e-9);
    }

    @Test
    public void timeIsAccountedPerMode() {
        RouteGuide g = straightThenRight();
        g.begin(0);
        g.alignAt("a", 1000);
        g.update(0, 1, true, 1, 3000);
        g.update(0, 1, false, 0, 4000);
        g.update(0, 1, false, 0, 6000);
        assertEquals(Mode.LOST, g.getMode());
        g.update(0, 1, false, 0, 7000);
        assertEquals(1000, g.getModeMs(Mode.ALIGNING), 0);
        assertEquals(5000, g.getModeMs(Mode.GUIDING), 0);
        assertEquals(1000, g.getModeMs(Mode.LOST), 0);
        assertEquals("STARTED", g.getEvents().get(0).type);
        assertEquals(1000, g.getEvents().get(1).tMs); // ALIGNED, relative to start
    }
}
