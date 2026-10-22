package dev.sainikhil.immersivear.ar;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Route-following logic for AR guidance. Pure Java (no Android classes) so it
 * can be unit-tested on a PC.
 *
 * Coordinates are in the CAMPUS frame: x = metres east, y = metres north.
 * The AR screen converts the camera position into this frame (see Alignment)
 * and calls update() every frame.
 *
 * Guidance modes, from most to least trusted:
 *   GUIDING       tracking is good and drift since the last alignment is small
 *   DEGRADED      still tracking, but drift may be growing: arrows shown with a warning
 *   LOST          tracking lost or drift too large: arrows HIDDEN, text/map fallback
 *   NEED_REALIGN  reached a floor change (lift/stairs): re-align on the new floor
 *   ARRIVED       within ARRIVE_M of the destination
 * plus ALIGNING before the first alignment.
 *
 * The thresholds are starting values to be calibrated in the field study;
 * they are deliberately named constants so the evaluation can report them.
 */
public final class RouteGuide {

    public enum Mode { ALIGNING, GUIDING, DEGRADED, LOST, NEED_REALIGN, ARRIVED }

    /** Drift budget: ARCore visual-inertial odometry drifts with distance walked. */
    public static final double DEGRADED_AFTER_M = 40;
    public static final double LOST_AFTER_M = 80;
    /** Camera tracking must be lost this long before arrows are hidden (brief blips are normal). */
    public static final long TRACKING_GRACE_MS = 1500;
    /** ...and back this long before arrows return (avoids flicker). */
    public static final long RECOVERY_MS = 1000;
    public static final double OFF_ROUTE_M = 5;
    public static final long OFF_ROUTE_MS = 3000;
    public static final double ARRIVE_M = 3;
    public static final double LEVEL_CHANGE_M = 3;

    public static final class Point {
        public final String nodeId;
        public final double x, y;
        public final int level;
        public final String landmark;

        public Point(String nodeId, double x, double y, int level, String landmark) {
            this.nodeId = nodeId;
            this.x = x;
            this.y = y;
            this.level = level;
            this.landmark = landmark;
        }
    }

    public static final class Instruction {
        public final String text;
        public final String atNodeId;
        /** Index into the route points where this instruction starts. */
        int pointIndex;

        public Instruction(String text, String atNodeId) {
            this.text = text;
            this.atNodeId = atNodeId;
        }
    }

    public static final class Event {
        public final long tMs;
        public final String type;
        public final String detail;

        Event(long tMs, String type, String detail) {
            this.tMs = tMs;
            this.type = type;
            this.detail = detail;
        }
    }

    private final List<Point> points;
    private final List<Instruction> instructions;
    private final double[] cumulative; // route distance from start to each point (vertical legs count 0)

    private Mode mode = Mode.ALIGNING;
    private String lostReason = "";
    private int segment;          // current segment: points[segment] -> points[segment+1]
    private int spanEnd;          // last point index on the current floor run
    private double alongM;        // distance along the route of the user's projected position
    private double offRouteM;
    private boolean offRoute;
    private long offRouteSinceMs = -1;
    private double sinceAlignM;
    private long trackingLostSinceMs = -1;
    private long trackingOkSinceMs = -1;
    private final List<Event> events = new ArrayList<>();
    private final long[] modeMs = new long[Mode.values().length];
    private long lastTickMs = -1;
    private long startMs = -1;
    private int realigns;

    public RouteGuide(List<Point> points, List<Instruction> instructions) {
        if (points == null || points.size() < 2) throw new IllegalArgumentException("A route needs at least two points");
        this.points = Collections.unmodifiableList(new ArrayList<>(points));
        this.instructions = new ArrayList<>(instructions);
        cumulative = new double[points.size()];
        for (int i = 1; i < points.size(); i++) {
            Point a = points.get(i - 1), b = points.get(i);
            cumulative[i] = cumulative[i - 1] + (a.level == b.level ? Math.hypot(b.x - a.x, b.y - a.y) : 0);
        }
        // Map each instruction to the first matching route point at or after the previous one.
        int from = 0;
        for (Instruction ins : this.instructions) {
            int idx = from;
            for (int i = from; i < points.size(); i++) {
                if (points.get(i).nodeId.equals(ins.atNodeId)) { idx = i; break; }
            }
            ins.pointIndex = idx;
            from = idx;
        }
    }

    /** Start the clock when the AR screen opens (time spent aligning is measured too). */
    public synchronized void begin(long nowMs) {
        if (startMs >= 0) return;
        startMs = nowMs;
        lastTickMs = nowMs;
        log(nowMs, "STARTED", "");
    }

    // ---- Alignment ----

    /**
     * Mark the user as standing at route point `nodeId` (a checkpoint). Resets
     * the drift budget. Returns false if that node is not on the remaining route.
     */
    public synchronized boolean alignAt(String nodeId, long nowMs) {
        int idx = -1;
        for (int i = 0; i < points.size(); i++) {
            if (points.get(i).nodeId.equals(nodeId)) { idx = i; if (i >= segment) break; }
        }
        if (idx < 0) return false;
        begin(nowMs);
        tick(nowMs);
        segment = Math.min(idx, points.size() - 2);
        spanEnd = spanEndFrom(segment);
        alongM = cumulative[idx];
        sinceAlignM = 0;
        offRoute = false;
        offRouteSinceMs = -1;
        trackingLostSinceMs = -1;
        trackingOkSinceMs = nowMs;
        if (mode != Mode.ALIGNING) realigns++;
        log(nowMs, "ALIGNED", nodeId);
        setMode(idx == points.size() - 1 ? Mode.ARRIVED : Mode.GUIDING, nowMs, "");
        return true;
    }

    /** Checkpoints the user could re-align at next (route points on the next floor, or the current one). */
    public int levelAfterCurrentSpan() {
        return spanEnd + 1 < points.size() ? points.get(spanEnd + 1).level : points.get(spanEnd).level;
    }

    // ---- Per-frame update ----

    /**
     * @param x,y       camera position in the campus frame (metres)
     * @param tracking  ARCore camera tracking state is TRACKING
     * @param movedM    horizontal distance the camera moved since the last call
     */
    public synchronized void update(double x, double y, boolean tracking, double movedM, long nowMs) {
        tick(nowMs);
        if (mode == Mode.ALIGNING || mode == Mode.ARRIVED || mode == Mode.NEED_REALIGN) return;

        if (!tracking) {
            trackingOkSinceMs = -1;
            if (trackingLostSinceMs < 0) {
                trackingLostSinceMs = nowMs;
                log(nowMs, "TRACKING_LOST", "");
            }
            if (nowMs - trackingLostSinceMs >= TRACKING_GRACE_MS) setMode(Mode.LOST, nowMs, "tracking");
            return;
        }
        if (trackingLostSinceMs >= 0) {
            log(nowMs, "TRACKING_RECOVERED", String.valueOf(nowMs - trackingLostSinceMs));
            trackingLostSinceMs = -1;
            trackingOkSinceMs = nowMs;
        }
        if (trackingOkSinceMs < 0) trackingOkSinceMs = nowMs;
        if (movedM > 0.02) sinceAlignM += movedM; // ignore sensor jitter

        project(x, y);

        // Off-route warning (we can't re-route without a reliable position).
        if (offRouteM > OFF_ROUTE_M) {
            if (offRouteSinceMs < 0) offRouteSinceMs = nowMs;
            if (!offRoute && nowMs - offRouteSinceMs >= OFF_ROUTE_MS) {
                offRoute = true;
                log(nowMs, "OFF_ROUTE", String.format(java.util.Locale.ROOT, "%.1f", offRouteM));
            }
        } else {
            offRouteSinceMs = -1;
            offRoute = false;
        }

        boolean lastSpan = spanEnd == points.size() - 1;
        Point spanLast = points.get(spanEnd);
        double toSpanEnd = cumulative[spanEnd] - alongM;
        if (lastSpan && toSpanEnd <= ARRIVE_M && Math.hypot(x - spanLast.x, y - spanLast.y) <= ARRIVE_M + 2) {
            setMode(Mode.ARRIVED, nowMs, "");
            return;
        }
        if (!lastSpan && toSpanEnd <= LEVEL_CHANGE_M) {
            setMode(Mode.NEED_REALIGN, nowMs, "level " + levelAfterCurrentSpan());
            return;
        }

        Mode target;
        String reason = "";
        if (sinceAlignM >= LOST_AFTER_M) { target = Mode.LOST; reason = "drift"; }
        else if (sinceAlignM >= DEGRADED_AFTER_M) target = Mode.DEGRADED;
        else target = Mode.GUIDING;

        // Coming back from a tracking loss needs a short stable period.
        if (mode == Mode.LOST && "tracking".equals(lostReason) && target != Mode.LOST
            && nowMs - trackingOkSinceMs < RECOVERY_MS) {
            return;
        }
        setMode(target, nowMs, reason);
    }

    /** Project the position onto the current floor's segments, near the last known progress. */
    private void project(double x, double y) {
        int spanStart = spanStartFrom(segment);
        int lo = Math.max(spanStart, segment - 1);
        int hi = Math.min(spanEnd - 1, segment + 6);
        if (hi < lo) { // standing at the end of a floor run: nothing to project onto
            offRouteM = 0;
            return;
        }
        double best = Double.MAX_VALUE;
        int bestSeg = segment;
        double bestAlong = alongM;
        for (int i = lo; i <= hi; i++) {
            Point a = points.get(i), b = points.get(i + 1);
            double dx = b.x - a.x, dy = b.y - a.y;
            double len2 = dx * dx + dy * dy;
            double t = len2 == 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
            double px = a.x + t * dx, py = a.y + t * dy;
            double d = Math.hypot(x - px, y - py);
            if (d < best - 1e-9) {
                best = d;
                bestSeg = i;
                bestAlong = cumulative[i] + t * Math.sqrt(len2);
            }
        }
        segment = bestSeg;
        alongM = bestAlong;
        offRouteM = best;
    }

    private int spanEndFrom(int seg) {
        int i = seg;
        while (i + 1 < points.size() && points.get(i + 1).level == points.get(seg).level) i++;
        return i;
    }

    private int spanStartFrom(int seg) {
        int i = seg;
        while (i - 1 >= 0 && points.get(i - 1).level == points.get(seg).level) i--;
        return i;
    }

    private void setMode(Mode m, long nowMs, String reason) {
        if (m == mode) return;
        log(nowMs, "MODE", mode.name() + "->" + m.name() + (reason.isEmpty() ? "" : " (" + reason + ")"));
        mode = m;
        lostReason = m == Mode.LOST ? reason : "";
    }

    private void tick(long nowMs) {
        if (lastTickMs >= 0 && nowMs > lastTickMs) modeMs[mode.ordinal()] += nowMs - lastTickMs;
        lastTickMs = nowMs;
    }

    private void log(long nowMs, String type, String detail) {
        events.add(new Event(startMs < 0 ? 0 : nowMs - startMs, type, detail));
    }

    /** Close the time accounting (call once when the screen ends). */
    public synchronized void close(long nowMs) {
        tick(nowMs);
        log(nowMs, "ENDED", mode.name());
    }

    // ---- Read-only state for the screen ----

    public Mode getMode() { return mode; }
    public String getLostReason() { return lostReason; }
    public boolean isOffRoute() { return offRoute; }
    public double getOffRouteM() { return offRouteM; }
    public double getSinceAlignM() { return sinceAlignM; }
    public double getRemainingM() { return Math.max(0, cumulative[points.size() - 1] - alongM); }
    public int getSegment() { return segment; }
    public int getSpanEnd() { return spanEnd; }
    public double getAlongM() { return alongM; }
    public List<Point> getPoints() { return points; }
    public List<Event> getEvents() { return Collections.unmodifiableList(events); }
    public int getRealigns() { return realigns; }
    public long getModeMs(Mode m) { return modeMs[m.ordinal()]; }
    public double cumulativeAt(int pointIndex) { return cumulative[pointIndex]; }

    /** The next instruction ahead of the user, or the final one. */
    public Instruction nextInstruction() {
        for (Instruction ins : instructions) {
            if (ins.pointIndex > segment) return ins;
        }
        return instructions.isEmpty() ? null : instructions.get(instructions.size() - 1);
    }

    /** Metres along the route from the user to where the next instruction starts. */
    public double distanceToNextInstruction() {
        Instruction ins = nextInstruction();
        return ins == null ? 0 : Math.max(0, cumulative[ins.pointIndex] - alongM);
    }
}
