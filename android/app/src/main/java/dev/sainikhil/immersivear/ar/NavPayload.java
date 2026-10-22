package dev.sainikhil.immersivear.ar;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * The route sent from the web app (src/lib/native/nav-payload.ts), parsed and
 * validated. Anything malformed is rejected with a message; the AR screen
 * never guesses missing data.
 */
final class NavPayload {
    static final int VERSION = 1;

    static final class Checkpoint {
        final String id, nodeId, name;
        final double x, y, facingDeg;
        final int level;

        Checkpoint(String id, String nodeId, String name, double x, double y, int level, double facingDeg) {
            this.id = id;
            this.nodeId = nodeId;
            this.name = name;
            this.x = x;
            this.y = y;
            this.level = level;
            this.facingDeg = facingDeg;
        }
    }

    final String destinationName;
    final List<RouteGuide.Point> points;
    final List<RouteGuide.Instruction> instructions;
    final List<Checkpoint> checkpoints;
    final Checkpoint start;

    private NavPayload(String destinationName, List<RouteGuide.Point> points, List<RouteGuide.Instruction> instructions,
                       List<Checkpoint> checkpoints, Checkpoint start) {
        this.destinationName = destinationName;
        this.points = points;
        this.instructions = instructions;
        this.checkpoints = checkpoints;
        this.start = start;
    }

    static NavPayload parse(String json) throws IllegalArgumentException {
        if (json == null || json.isEmpty()) throw new IllegalArgumentException("No route was provided");
        try {
            JSONObject o = new JSONObject(json);
            if (o.getInt("version") != VERSION) throw new IllegalArgumentException("Unsupported route format version");

            JSONArray nodes = o.getJSONArray("nodes");
            if (nodes.length() < 2) throw new IllegalArgumentException("Route is too short");
            List<RouteGuide.Point> points = new ArrayList<>();
            Set<String> ids = new HashSet<>();
            for (int i = 0; i < nodes.length(); i++) {
                JSONObject n = nodes.getJSONObject(i);
                double x = finite(n.getDouble("x"), "x");
                double y = finite(n.getDouble("y"), "y");
                String id = n.getString("id");
                ids.add(id);
                points.add(new RouteGuide.Point(id, x, y, n.getInt("level"), n.optString("landmark", "")));
            }

            JSONArray ins = o.getJSONArray("instructions");
            List<RouteGuide.Instruction> instructions = new ArrayList<>();
            for (int i = 0; i < ins.length(); i++) {
                JSONObject in = ins.getJSONObject(i);
                instructions.add(new RouteGuide.Instruction(in.getString("text"), in.getString("atNodeId")));
            }

            JSONArray cps = o.getJSONArray("checkpoints");
            List<Checkpoint> checkpoints = new ArrayList<>();
            Checkpoint start = null;
            String startId = o.getString("startCheckpointId");
            for (int i = 0; i < cps.length(); i++) {
                JSONObject c = cps.getJSONObject(i);
                String nodeId = c.getString("nodeId");
                if (!ids.contains(nodeId)) continue; // only checkpoints on this route are useful
                double facing = finite(c.getDouble("facingDeg"), "facingDeg");
                if (facing < 0 || facing >= 360) throw new IllegalArgumentException("Checkpoint facing must be 0-359 degrees");
                Checkpoint cp = new Checkpoint(c.getString("id"), nodeId, c.getString("name"),
                    finite(c.getDouble("x"), "x"), finite(c.getDouble("y"), "y"), c.getInt("level"), facing);
                checkpoints.add(cp);
                if (cp.id.equals(startId)) start = cp;
            }
            if (start == null) throw new IllegalArgumentException("The starting checkpoint is not on this route");
            if (!start.nodeId.equals(points.get(0).nodeId)) throw new IllegalArgumentException("The route must start at the starting checkpoint");

            return new NavPayload(o.optString("destinationName", "your destination"),
                Collections.unmodifiableList(points), instructions, Collections.unmodifiableList(checkpoints), start);
        } catch (JSONException e) {
            throw new IllegalArgumentException("Route data is malformed: " + e.getMessage());
        }
    }

    private static double finite(double v, String field) {
        if (Double.isNaN(v) || Double.isInfinite(v)) throw new IllegalArgumentException("Invalid number in " + field);
        return v;
    }
}
