// Coral that breathes a soft pink light.
void p0Surface(inout P0Surface s) {
  vec3 p = s.position;
  float b = 0.5 + 0.5 * sin(p0Time * 1.5 + p.x * 2.0 + p.z * 1.3);
  s.emissive += vec3(0.6, 0.1, 0.35) * (0.15 + 0.35 * b) * smoothstep(0.2, 1.4, p.y - floor(p.y / 3.9) * 3.9);
}
