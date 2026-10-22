package dev.sainikhil.immersivear.ar;

/**
 * Links the CAMPUS frame (x east, y north, metres) to the ARCore WORLD frame
 * (X, Y up, Z; gravity-aligned, arbitrary heading). Pure Java, unit-tested.
 *
 * It is created when the user stands at a surveyed checkpoint, facing the
 * checkpoint's marked direction, and taps Align:
 *   - the checkpoint's campus position  ->  the camera's position on the floor
 *   - the checkpoint's facing bearing   ->  the camera's horizontal forward direction
 *
 * Accuracy depends on how exactly the user stands and faces; an error of a
 * few degrees in facing grows to about 1 m of lateral error 15 m ahead. That
 * is why the guidance degrades with distance and asks for re-alignment.
 */
public final class Alignment {
    private final double anchorX, anchorZ, floorY;   // AR world
    private final double campusX, campusY;           // campus frame
    // Unit vectors: forward/right in AR (X,Z) and in campus (east,north).
    private final double fax, faz, rax, raz;
    private final double fcx, fcy, rcx, rcy;

    /**
     * @param cameraX,cameraZ     camera position in AR world
     * @param forwardX,forwardZ   camera forward (-Z of the camera pose) projected on the floor; need not be unit length
     * @param floorY              AR world height of the floor
     * @param facingDeg           compass bearing the checkpoint faces (0 = north, clockwise)
     */
    public Alignment(double cameraX, double cameraZ, double forwardX, double forwardZ, double floorY,
                     double checkpointX, double checkpointY, double facingDeg) {
        double len = Math.hypot(forwardX, forwardZ);
        if (len < 1e-6) throw new IllegalArgumentException("Hold the phone upright, pointing ahead, to align");
        anchorX = cameraX;
        anchorZ = cameraZ;
        this.floorY = floorY;
        campusX = checkpointX;
        campusY = checkpointY;
        fax = forwardX / len;
        faz = forwardZ / len;
        // Right of forward with Y up: forward (0,-1) [i.e. -Z] -> right (1,0) [+X].
        rax = -faz;
        raz = fax;
        double b = Math.toRadians(facingDeg);
        fcx = Math.sin(b);  // east component of the facing direction
        fcy = Math.cos(b);  // north component
        rcx = Math.cos(b);  // right of facing (clockwise 90 deg)
        rcy = -Math.sin(b);
    }

    public double floorY() {
        return floorY;
    }

    /** Campus (x, y) -> AR world {X, Z}. */
    public double[] toAr(double x, double y) {
        double dx = x - campusX, dy = y - campusY;
        double ahead = dx * fcx + dy * fcy;
        double right = dx * rcx + dy * rcy;
        return new double[] { anchorX + ahead * fax + right * rax, anchorZ + ahead * faz + right * raz };
    }

    /** AR world (X, Z) -> campus {x, y}. */
    public double[] toCampus(double arX, double arZ) {
        double vx = arX - anchorX, vz = arZ - anchorZ;
        double ahead = vx * fax + vz * faz;
        double right = vx * rax + vz * raz;
        return new double[] { campusX + ahead * fcx + right * rcx, campusY + ahead * fcy + right * rcy };
    }
}
