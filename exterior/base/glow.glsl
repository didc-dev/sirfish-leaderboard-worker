// Crystal windows, runes, rings and the portal: light climbing the tower forever.
void p0Surface(inout P0Surface s) {
  vec3 p = s.position;
  vec3 turq = vec3(0.05, 0.85, 1.0);
  vec3 purple = vec3(0.55, 0.2, 1.0);
  float band = pow(0.5 + 0.5 * sin(p.y * 2.2 - p0Time * 2.5), 8.0);
  vec3 hue = mix(turq, purple, 0.5 + 0.5 * sin(p0Time * 0.5 + p.y * 0.35));
  float e = 0.9 + band * 1.6 + p0Near * 0.4 + pulse * 1.5;
  // the portal: a slow whirlpool in the doorway
  vec2 q = vec2(p.x, p.y - 1.70);
  if (p.z > 3.0 && p.z < 3.5 && abs(p.x) < 1.25 && p.y < 3.05) {
    float r = length(q);
    float a = atan(q.y, q.x);
    float sw = 0.5 + 0.5 * sin(a * 5.0 + r * 9.0 - p0Time * 3.0);
    float k = clamp(1.0 - r / 1.95, 0.0, 1.0);
    hue = mix(purple, turq, sw);
    e = 0.8 + sw * 1.6 * k + p0Near * 0.8 + pulse * 2.0;
  }
  s.color = vec3(0.01, 0.03, 0.05);
  s.emissive = hue * e;
}
