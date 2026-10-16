// Dark sea stone with drifting caustic light.
// The right wing's front panel also shows the weekly ranking: board.png, republished by
// tools/leaderboard-worker whenever the table changes. Positions are lot metres (+Z = front).
void p0Surface(inout P0Surface s) {
  vec3 p = s.position;
  float c = sin(p.x * 3.0 + p0Time * 1.3) * sin(p.z * 3.1 - p0Time * 1.1) + sin((p.x + p.z) * 2.3 + p0Time * 0.9);
  s.emissive += vec3(0.02, 0.18, 0.22) * smoothstep(0.8, 1.6, c) * 0.6;
  vec2 buv = vec2((p.x - 5.05) / 2.95, (p.y - 1.0) / 2.4);  // starts right of the title sign pillar
  if (p.z > 3.63 && buv.x >= 0.0 && buv.x <= 1.0 && buv.y >= 0.0 && buv.y <= 1.0) {
    vec3 img = texture2D(board, buv).rgb;
    float shimmer = 0.94 + 0.06 * sin(p0Time * 1.7 + buv.x * 6.0);
    s.color = img * 0.2;
    s.emissive = img * (0.85 + p0Near * 0.3) * shimmer;
  }
}
