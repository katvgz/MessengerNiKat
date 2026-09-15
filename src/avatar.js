// Keep the customizer's numeric character/skin choices and named color/badge values.
export function characterToAvatar(value = {}) {
  const style = value.style ?? 0;
  return {
    character: style,
    hoodieColor: value.mood ?? 'rose',
    skinTone: value.skin ?? style,
    glasses: value.glasses ?? (style === 0),
    badge: value.badge ?? 'sparkle',
  };
}

export function avatarToCharacter(avatar) {
  return {
    style: avatar.character,
    mood: avatar.hoodieColor,
    skin: avatar.skinTone,
    glasses: avatar.glasses,
    badge: avatar.badge,
  };
}
