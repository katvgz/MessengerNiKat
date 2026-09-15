import React, { lazy, Suspense } from 'react';

const Character3D = lazy(() => import('./Character3D'));

export const defaultCharacter = { style: 0, mood: 'rose', badge: 'sparkle' };
export const characters = ['Violet', 'Ember', 'Nova'];
export const moods = { rose: '#d76b85', lavender: '#aa8ae4', amber: '#e9a566' };
const badges = { sparkle: '✦', heart: '♡', moon: '☾', none: '' };

// Full previews are live 3D; small avatars are snapshots rendered from that model.
export function Character({ value = defaultCharacter, portrait = false }) {
  const character = { ...defaultCharacter, ...value };
  return <span className={`character ${portrait ? 'character-portrait' : ''}`} style={{ '--aura': moods[character.mood] }} role={portrait ? 'group' : 'img'} aria-label={`${characters[character.style]} 3D character, ${character.mood} hoodie, ${character.badge} badge`}>
    <Suspense fallback={<span className="character-fallback">✦</span>}><Character3D value={character} portrait={portrait} /></Suspense>
    {badges[character.badge] && <span className="character-badge">{badges[character.badge]}</span>}
  </span>;
}

export default function CharacterCustomizer({ value, onChange, compact = false }) {
  function update(key, next) { onChange({ ...value, [key]: next }); }
  return <section className={`character-customizer ${compact ? 'compact' : ''}`} aria-label="Character customizer">
    <div className="customizer-heading"><span>MAKE IT YOU</span><small>Live 3D · follows your cursor</small></div>
    <div className="customizer-body"><div className="customizer-preview"><Character value={value} portrait /></div><div className="customizer-controls">
      <fieldset><legend>Choose your character</legend><div className="character-options">{characters.map((name, index) => <button type="button" key={name} aria-label={name} aria-pressed={value.style === index} onClick={() => update('style', index)}><Character value={{ ...value, style: index, badge: 'none' }} /><span>{name}</span></button>)}</div></fieldset>
      <fieldset><legend>Hoodie color</legend><div className="mood-options">{Object.entries(moods).map(([name, color]) => <button type="button" key={name} aria-label={`${name} hoodie`} aria-pressed={value.mood === name} onClick={() => update('mood', name)} style={{ '--swatch': color }}><span />{name}</button>)}</div></fieldset>
      <fieldset><legend>Skin tone</legend><div className="mood-options">{['#e0a27b', '#ba7855', '#825039'].map((color, index) => <button type="button" key={color} aria-label={`Skin tone ${index + 1}`} aria-pressed={(value.skin ?? value.style) === index} onClick={() => update('skin', index)} style={{ '--swatch': color }}><span /></button>)}</div></fieldset>
      <fieldset><legend>Glasses</legend><div className="glasses-options">{[true, false].map(enabled => <button type="button" key={String(enabled)} aria-pressed={(value.glasses ?? value.style === 0) === enabled} onClick={() => update('glasses', enabled)}>{enabled ? 'With glasses' : 'No glasses'}</button>)}</div></fieldset>
      <fieldset><legend>Profile badge</legend><div className="badge-options">{Object.entries(badges).map(([name, symbol]) => <button type="button" key={name} aria-label={`${name} badge`} aria-pressed={value.badge === name} onClick={() => update('badge', name)}>{symbol || '—'}</button>)}</div></fieldset>
    </div></div>
  </section>;
}

