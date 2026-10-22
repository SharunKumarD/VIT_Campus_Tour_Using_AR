package dev.sainikhil.immersivear.ar;

import android.opengl.GLES20;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;

/** Small OpenGL ES 2.0 helpers. Errors throw, so they reach the activity's error handler. */
final class GlUtil {
    private GlUtil() {}

    static int program(String vertexSrc, String fragmentSrc) {
        int vs = shader(GLES20.GL_VERTEX_SHADER, vertexSrc);
        int fs = shader(GLES20.GL_FRAGMENT_SHADER, fragmentSrc);
        int p = GLES20.glCreateProgram();
        GLES20.glAttachShader(p, vs);
        GLES20.glAttachShader(p, fs);
        GLES20.glLinkProgram(p);
        int[] ok = new int[1];
        GLES20.glGetProgramiv(p, GLES20.GL_LINK_STATUS, ok, 0);
        if (ok[0] == 0) {
            String log = GLES20.glGetProgramInfoLog(p);
            GLES20.glDeleteProgram(p);
            throw new IllegalStateException("Shader link failed: " + log);
        }
        return p;
    }

    private static int shader(int type, String src) {
        int s = GLES20.glCreateShader(type);
        GLES20.glShaderSource(s, src);
        GLES20.glCompileShader(s);
        int[] ok = new int[1];
        GLES20.glGetShaderiv(s, GLES20.GL_COMPILE_STATUS, ok, 0);
        if (ok[0] == 0) {
            String log = GLES20.glGetShaderInfoLog(s);
            GLES20.glDeleteShader(s);
            throw new IllegalStateException("Shader compile failed: " + log);
        }
        return s;
    }

    static FloatBuffer floats(float[] data) {
        FloatBuffer fb = ByteBuffer.allocateDirect(data.length * 4).order(ByteOrder.nativeOrder()).asFloatBuffer();
        fb.put(data).position(0);
        return fb;
    }

    static FloatBuffer floats(int count) {
        return ByteBuffer.allocateDirect(count * 4).order(ByteOrder.nativeOrder()).asFloatBuffer();
    }
}
