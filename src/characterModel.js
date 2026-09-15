import * as THREE from 'three';

// An original, code-built 3D character. Every part is geometry, not a photograph.
// Keeping the head and eyes in separate groups makes them easy to animate.
export function createCharacterModel(options = {}) {
  const style = options.style ?? 0;
  const skinColors = ['#e0a27b', '#ba7855', '#825039'];
  const hairColors = ['#514071', '#713323', '#272033'];
  const outfitColors = { rose: '#b54f76', lavender: '#8c70be', amber: '#c48a48' };
  const root = new THREE.Group();
  const body = new THREE.Group();
  const head = new THREE.Group();
  head.position.y = 1.8;
  root.add(body, head);
  const materials = [];
  const geometries = [];
  function material(color, roughness = .58, metalness = 0) {
    const result = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.push(result);
    return result;
  }
  const skin = material(skinColors[options.skin ?? style] || skinColors[0]);
  const innerEar = material('#b56c67');
  const hair = material(hairColors[style], .36);
  const hairHighlight = material(style === 0 ? '#675285' : style === 1 ? '#884230' : '#393044', .4);
  const hoodie = material(outfitColors[options.mood] || outfitColors.rose, .82);
  const hoodInside = material('#593147');
  const jacket = material('#292c43', .77);
  const white = material('#fff6e9', .3);
  const iris = material(style === 1 ? '#527369' : '#65432c', .3);
  const dark = material('#211c29', .28);
  const lip = material('#944e4d');
  const gold = material('#e6b97a', .26, .65);
  const sphere = new THREE.SphereGeometry(1, 32, 24);
  geometries.push(sphere);

  function ellipsoid(parent, mat, position, scale) {
    const mesh = new THREE.Mesh(sphere, mat);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  }
  function curve(parent, mat, points, radius = .035) {
    const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const geometry = new THREE.TubeGeometry(path, 24, radius, 8, false);
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, mat);
    parent.add(mesh);
    return mesh;
  }
  function ring(parent, mat, radius, tube, position, scale = [1, 1, 1]) {
    const geometry = new THREE.TorusGeometry(radius, tube, 12, 48);
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  }

  // Soft shoulders, hoodie, layered collar, sleeves, and drawstrings.
  ellipsoid(body, hoodie, [0, .12, 0], [.82, 1.05, .44]);
  ellipsoid(body, hoodie, [0, 1.03, -.16], [.69, .42, .42]);
  ellipsoid(body, hoodInside, [0, 1.18, .01], [.47, .16, .33]);
  ellipsoid(body, skin, [0, 1.27, .03], [.24, .39, .23]);
  for (const side of [-1, 1]) {
    const arm = ellipsoid(body, style === 0 ? jacket : hoodie, [side * .76, .15, -.01], [.28, .79, .32]);
    arm.rotation.z = side * .13;
    if (style === 0) {
      const panel = ellipsoid(body, jacket, [side * .51, .12, .27], [.27, .86, .22]);
      panel.rotation.z = side * -.1;
    }
    curve(body, hoodie, [[side * .12, 1.13, .31], [side * .49, .89, .43], [side * .23, .72, .45]], .115);
    curve(body, white, [[side * .24, .88, .51], [side * .22, .58, .52], [side * .25, .36, .52]], .014);
    ellipsoid(body, gold, [side * .25, .35, .52], [.024, .047, .024]);
  }
  curve(body, hoodInside, [[-.3, -.1, .43], [0, -.19, .46], [.3, -.1, .43]], .018);

  // Pear-shaped cheeks and a soft jaw make a friendly stylized face.
  const faceGeometry = new THREE.SphereGeometry(1, 48, 32);
  // Narrow the jaw within one continuous surface so there is no seam at the chin.
  const positions = faceGeometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    positions.setX(i, positions.getX(i) * (y < 0 ? 1 + y * .17 : 1));
  }
  faceGeometry.computeVertexNormals();
  geometries.push(faceGeometry);
  const face = new THREE.Mesh(faceGeometry, skin);
  face.position.set(0, .3, 0);
  face.scale.set(.62, .82, .51);
  head.add(face);
  for (const side of [-1, 1]) {
    ellipsoid(head, skin, [side * .6, .2, .01], [.135, .22, .105]);
    ellipsoid(head, innerEar, [side * .654, .2, .073], [.065, .135, .045]);
    if (style === 1) ring(head, gold, .09, .017, [side * .655, -.015, .09], [.68, 1, 1]);
  }

  const eyes = [];
  const pupils = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * .255, .31, .445);
    head.add(eye);
    ellipsoid(eye, white, [0, 0, 0], [.19, .145, .082]);
    const pupil = new THREE.Group();
    pupil.position.z = .076;
    eye.add(pupil);
    ellipsoid(pupil, iris, [0, 0, 0], [.081, .099, .022]);
    ellipsoid(pupil, dark, [0, 0, .019], [.041, .061, .013]);
    ellipsoid(pupil, white, [-.025, .032, .03], [.021, .024, .012]);
    ellipsoid(pupil, white, [.024, -.023, .027], [.008, .009, .006]);
    curve(head, hair, [[side * .255 - .17, .51, .435], [side * .255, .555, .465], [side * .255 + .16, .51, .435]], .026);
    eyes.push(eye); pupils.push(pupil);
  }
  ellipsoid(head, skin, [0, .11, .515], [.09, .15, .115]);
  ellipsoid(head, skin, [0, .015, .56], [.13, .072, .095]);
  curve(head, lip, [[-.16, -.14, .419], [0, -.185, .42], [.16, -.14, .419]], .018);

  // Three actual hairstyles, assembled from sculptural locks and curls.
  ellipsoid(head, hair, [0, .74, -.12], [.64, .44, .47]);
  if (style === 0) {
    for (let i = 0; i < 9; i++) {
      const x = -.54 + i * .126;
      const lock = ellipsoid(head, i % 3 ? hair : hairHighlight, [x, .85 + Math.sin(i * .65) * .13, .13], [.19, .28 + (i % 3) * .035, .25]);
      lock.rotation.z = -.45 + i * .09;
    }
    for (let i = 0; i < 4; i++) {
      const lock = ellipsoid(head, i % 2 ? hairHighlight : hair, [-.4 + i * .2, .71 - i * .025, .38], [.23, .16, .12]);
      lock.rotation.z = -.4;
    }
    ellipsoid(head, hair, [-.55, .53, -.02], [.1, .25, .2]);
    ellipsoid(head, hair, [.55, .53, -.02], [.1, .25, .2]);
  } else if (style === 1) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const lock = ellipsoid(head, i % 2 ? hairHighlight : hair, [side * (.48 + Math.sin(i * 1.5) * .035), .64 - i * .2, -.12], [.23, .28, .32]);
        lock.rotation.z = side * -.17;
      }
      const fringe = ellipsoid(head, hairHighlight, [side * .36, .69, .3], [.3, .21, .2]);
      fringe.rotation.z = side * .6;
    }
  } else {
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 8; i++) {
        const angle = i / 7 * Math.PI;
        const radius = .52 - row * .09;
        ellipsoid(head, (i + row) % 3 ? hair : hairHighlight,
          [Math.cos(angle) * radius, .72 + row * .09 + Math.sin(angle) * .055, Math.sin(angle) * .34 - row * .025], [.14, .16, .14]);
      }
    }
  }

  if (options.glasses ?? style === 0) {
    for (const side of [-1, 1]) {
      ring(head, dark, .211, .021, [side * .26, .315, .563], [1, .88, 1]);
      curve(head, dark, [[side * .47, .34, .555], [side * .58, .38, .31], [side * .61, .33, .035]], .02);
    }
    curve(head, dark, [[-.05, .335, .57], [0, .36, .59], [.05, .335, .57]], .018);
  }

  return {
    root, head, body, eyes, pupils,
    dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); },
  };
}

export function createCharacterScene(options, closeup = false) {
  const scene = new THREE.Scene();
  const model = createCharacterModel(options);
  scene.add(model.root);
  scene.add(new THREE.HemisphereLight('#ffe2ee', '#32243f', 2.2));
  const key = new THREE.DirectionalLight('#ffe1c6', 3.4);
  key.position.set(-3, 4, 5); scene.add(key);
  const fill = new THREE.DirectionalLight('#c7b5ff', 2);
  fill.position.set(3, 2, 2); scene.add(fill);
  const rim = new THREE.DirectionalLight('#e6a0ff', 4);
  rim.position.set(1, 3, -3); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(33, 1, .1, 30);
  camera.position.set(0, closeup ? 2.15 : 1.55, closeup ? 3.45 : 6.9);
  camera.lookAt(0, closeup ? 2.12 : 1.25, 0);
  return { scene, camera, model };
}
