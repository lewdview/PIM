import type { Rarity } from './rarity';

export type OutfitStyle =
  | 'shiny'
  | 'pastel'
  | 'clear'
  | 'leather'
  | 'silk'
  | 'lacey'
  | 'latex'
  | 'velvet'
  | 'metallic'
  | 'holographic'
  | 'cyber_mesh'
  | 'denim'
  | 'feathers'
  | 'organza'
  | 'chrome'
  | 'knit';

export interface ColorCombo {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  glow: string;
}

export interface ArtTypeData {
  day: number;
  artType: string;
  artCategory: string;
  outfitStyle: OutfitStyle;
  outfitDescription: string;
  colorCombo: ColorCombo;
  description: string;
  promptSnippet: string;
}

// 16 Signature Outfit Material Definitions
export const OUTFIT_STYLES: Record<OutfitStyle, { label: string; description: string; tagColor: string }> = {
  shiny: {
    label: 'Shiny Vinyl',
    description: 'High-shine wet-look vinyl, gloss lacquered coats, polished polyurethane',
    tagColor: '#00f0ff',
  },
  pastel: {
    label: 'Pastel Dream',
    description: 'Soft cotton-candy tints, powder pinks, lavender mist, mint chiffon',
    tagColor: '#ffb8e0',
  },
  clear: {
    label: 'Clear PVC',
    description: 'Transparent acrylic jackets, smoked clear raincoats, see-through polycarbonate',
    tagColor: '#a7f3d0',
  },
  leather: {
    label: 'Studded Leather',
    description: 'Heavy motorcycle leather, silver-studded calfskin, weathered black hide',
    tagColor: '#ff5500',
  },
  silk: {
    label: 'Flowing Silk',
    description: 'Sinuous charmeuse silk, liquid satin drapes, spun mulberry silk gowns',
    tagColor: '#ffd700',
  },
  lacey: {
    label: 'Filigree Lace',
    description: 'Intricate Venetian lace, sheer floral mesh, gold-threaded tatting',
    tagColor: '#f472b6',
  },
  latex: {
    label: 'Liquid Latex',
    description: 'Form-fitting molded rubber, mirror-gloss black & crimson latex suits',
    tagColor: '#ef4444',
  },
  velvet: {
    label: 'Royal Velvet',
    description: 'Deep plush velvet, midnight burgundy & royal violet crushed velvet capes',
    tagColor: '#a855f7',
  },
  metallic: {
    label: 'Anodized Metal',
    description: 'Interwoven titanium thread, liquid gold maille, anodized brass plating',
    tagColor: '#eab308',
  },
  holographic: {
    label: 'Prism Hologram',
    description: 'Rainbow-shifting diffraction foil, dichroic iridescent TPU film',
    tagColor: '#38bdf8',
  },
  cyber_mesh: {
    label: 'Cyber Mesh',
    description: 'Illuminated fiber-optic webbing, tactical harness with neon LED piping',
    tagColor: '#39ff14',
  },
  denim: {
    label: 'Acid Denim',
    description: 'Distressed acid-wash denim, raw indigo weave, frayed patchwork denim',
    tagColor: '#60a5fa',
  },
  feathers: {
    label: 'Plumage Feathers',
    description: 'Iridescent raven feathers, neon ostrich plume collars, peacock down',
    tagColor: '#c084fc',
  },
  organza: {
    label: 'Spectral Organza',
    description: 'Ethereal sheer organza, layered iridizing tulle, gossamer veils',
    tagColor: '#e2e8f0',
  },
  chrome: {
    label: 'Liquid Chrome',
    description: 'Mirror-polished chrome exoskeleton, liquid mercury armor plating',
    tagColor: '#94a3b8',
  },
  knit: {
    label: 'Micro Rib Knit',
    description: 'Chunky cable-knit wool, tactile ribbed mohair, cyber-distressed sweater',
    tagColor: '#fb923c',
  },
};

// 365 Distinct Art Types Master Database
const BASE_ART_CATEGORIES = [
  'Cyberpunk & Sci-Fi',
  'Dark Fantasy & Gothic',
  'Neon Retro & Synthwave',
  'High-Fashion & Vogue',
  'Impressionist & Fine Art',
  'Anime & Celestial',
  'Minimalist & Surrealism',
  'Streetwear & Graffiti',
  'Organic & Nature Noir',
  'Industrial & Mechanical',
];

const COLOR_PALETTES: ColorCombo[] = [
  { name: 'Neon Cyan & Obsidian', primary: '#00f0ff', secondary: '#7000ff', accent: '#39ff14', bg: '#05050b', glow: 'rgba(0,240,255,0.4)' },
  { name: 'Electric Violet & Hot Pink', primary: '#ff007f', secondary: '#9d00ff', accent: '#00ffff', bg: '#0b0212', glow: 'rgba(255,0,127,0.4)' },
  { name: 'Solar Gold & Deep Amber', primary: '#ffd700', secondary: '#ff5500', accent: '#fff5a6', bg: '#0d0901', glow: 'rgba(255,215,0,0.4)' },
  { name: 'Toxic Lime & Cyber Cyan', primary: '#39ff14', secondary: '#00e5ff', accent: '#ccff00', bg: '#020f04', glow: 'rgba(57,255,20,0.4)' },
  { name: 'Pastel Lavender & Soft Peach', primary: '#ffb8e0', secondary: '#c084fc', accent: '#a7f3d0', bg: '#120a16', glow: 'rgba(255,184,224,0.4)' },
  { name: 'Crimson Blood & Liquid Silver', primary: '#ef4444', secondary: '#e2e8f0', accent: '#ff0055', bg: '#0d0304', glow: 'rgba(239,68,68,0.4)' },
  { name: 'Midnight Cobalt & Platinum', primary: '#3b82f6', secondary: '#94a3b8', accent: '#60a5fa', bg: '#020712', glow: 'rgba(59,130,246,0.4)' },
  { name: 'Emerald Prism & Dark Jade', primary: '#10b981', secondary: '#064e3b', accent: '#6ee7b7', bg: '#010c08', glow: 'rgba(16,185,129,0.4)' },
  { name: 'Acid Tangerine & Neon Magenta', primary: '#ff7700', secondary: '#ff00b7', accent: '#ffee00', bg: '#120500', glow: 'rgba(255,119,0,0.4)' },
  { name: 'Monochrome Chrome & Ghost White', primary: '#f8fafc', secondary: '#475569', accent: '#00f0ff', bg: '#04060a', glow: 'rgba(248,250,252,0.4)' },
  { name: 'Deep Amethyst & Cosmic Teal', primary: '#8b5cf6', secondary: '#14b8a6', accent: '#f472b6', bg: '#090314', glow: 'rgba(139,92,246,0.4)' },
  { name: 'Sunset Bronze & Rose Gold', primary: '#fb923c', secondary: '#f43f5e', accent: '#fef08a', bg: '#140704', glow: 'rgba(251,146,60,0.4)' },
];

const OUTFIT_KEYS: OutfitStyle[] = [
  'shiny',
  'pastel',
  'clear',
  'leather',
  'silk',
  'lacey',
  'latex',
  'velvet',
  'metallic',
  'holographic',
  'cyber_mesh',
  'denim',
  'feathers',
  'organza',
  'chrome',
  'knit',
];

// Names for all 365 unique art styles
const ART_TYPE_NAMES: string[] = [
  'Cyberpunk Glitch Neon', 'Iridescent Vaporwave', 'Dark Fantasy Oil Painting', 'Retro Anime Cell Shading',
  'Glassmorphism 3D Clay', 'High-Fashion Vogue Editorial', 'Ukiyo-e Cyberpunk Woodblock', 'Low-Poly Isometric Neon',
  'Stained Glass Gothic Prism', 'Bioluminescent Deepsea Glow', 'Acid Graphic Bauhaus', 'Surrealist Fragmented Collage',
  'Ink & Wash Sumi-e Noir', 'Kinetic Typography Wave', 'Solarized Thermal Heatmap', 'Opaline Dichroic Drift',
  'Retro Comic Book Halftone', 'Fluid Acrylic Marble Pour', 'Chiaroscuro Baroque Oil', 'Cybernetic Cyborg Armor',
  'Luminescent Jellyfish Veil', 'Pixel Art Synth Wave', 'Cubist Fragmented Vision', 'Neo-Noir Rain Reflections',
  'Astral Constellation Gold', 'Vivid Pop-Art Silk Screen', 'Microscopic Crystal Array', 'Ethereal Ghostly Spectral',
  'Anodized Titanium Mesh', 'Cyber-Baroque Gold Foil', 'Holographic Matrix Grid', 'Psychedelic Liquid Marbling',
  'Nordic Runestone Carving', 'Venetian Lace Filigree', 'Papercraft Layered Shadows', 'Industrial Rust & Chrome',
  'Steampunk Brass Goggles', 'Art Deco Gilded Geometry', 'Cosmic Nebula Watercolor', 'Graffiti Neon Spray Art',
  'Glitchcore Scanline VHS', 'Sub-Zero Frosted Ice', 'Molten Lava Magma Glow', 'Botanical Flora & Fauna',
  'Bio-Mechanical Gigeresque', 'Minimalist Mono Charcoal', 'Kintsugi Cracked Gold', 'Prismatic Rainbow Ray',
  'Hyper-Real Polaroid Instant', 'Vaporwave Sunset Sunset', 'Retrofuturism Atomic Age', 'Cyberpunk Alley Neon',
  'Velvet Gothic Romance', 'Bioluminescent Coral Reef', 'Luminous Aurora Borealis', 'Cybernetic Angel Wings',
  'Chrono Distortion Warp', 'High-Gloss Latex Fetish', 'Spectral Phantom Sheer', 'Liquid Gold Splash',
  'Cyber-Kimono Silk Robe', 'Futuristic Speed Streak', 'Decopunk Platinum Radiance', 'Solar Flare Plasma',
  'Subterranean Crystal Cave', 'Vintage Newspaper Collage', 'Neon Sign Reflection Puddle', 'Holographic Butterfly Dust',
  'Cyber Samurai Katana Glow', 'Ethereal Cloud Mist', 'Dark Alchemy Magic Circle', 'Chromatic Aberration Lens',
  'Industrial Steel Girder', 'Pastel Dreamscape Soft', 'Bionic Prosthetic Circuit', 'Geometric Polyhedron Glow',
  'Cyberpunk Motorcycle Racer', 'Vogue Leather Trench', 'Op-Art Optical Illusion', 'Cybernetic Geisha Mask',
  'Iridescent Bubble Sphere', 'Steampunk Clockwork Gear', 'Subliminal Waveform Sound', 'Gothic Cathedral Rosette',
  'Neon Streetball Jersey', 'Vivid Coral Sunburst', 'Lush Jungle Velvet', 'Astral Zodiac Glyph',
  'Liquid Mercury Metal Drop', 'Cyber-Punk Hacker Terminal', 'Minimalist Line Art Silhouette', 'Frosted Quartz Prism',
  'Hyper-Speed Warp Tunnel', 'Chiaroscuro Flame Glow', 'Venetian Masquerade Mask', 'Bioluminescent Mushroom Forest',
  'Cybernetic Phoenix Flame', 'High-Fashion Satin Gown', 'Retro Synthwave Grid', 'Dark Cosmic Singularity',
  'Anodized Aluminum Foil', 'Prism Flare Lens Reflections', 'Kintsugi Obsidian Shard', 'Cyberpunk Raincoat Transparent',
  'Art Nouveau Botanical', 'Sub-Zero Glacier Frost', 'Neon Graffiti Tag Wall', 'Paper Cutout Shadowbox',
  'Industrial Hazard Stripe', 'Bio-luminescent Alien Flora', 'Fluid Gold Threading', 'Cyber-Geisha Cherry Blossom',
  'Microchip Silicon Die', 'Luminous Sea Glass', 'Chrono Sandglass Hourglass', 'Vivid Psychedelic Rainbow',
  'Chiaroscuro Portrait Studio', 'Dark Gothic Raven Plume', 'High-Fashion Vinyl Coat', 'Retro Arcade 8-Bit',
  'Opaline Nacre Pearl', 'Cybernetic Dragon Scale', 'Ethereal Gossamer Veil', 'Steampunk Aviator Goggles',
  'Industrial Neon Concrete', 'Pastel Sunset Cloud', 'Bionic Eye HUD Overlay', 'Futuristic Hypercar Aerodynamic',
  'Vogue Lace Ensemble', 'Glitch Matrix Rain Code', 'Subterranean Gold Vein', 'Chromatic Diamond Lattice',
  'Cyberpunk DJ Deck Glow', 'Venetian Gondola Velvet', 'Botanical Fern Silhouette', 'Liquid Bronze Splash',
  'Solarized Monocolor Negative', 'Cybernetic Siren Song', 'High-Gloss Leather Bodysuit', 'Retrofuturism Moonbase',
  'Astral Nebula Dust', 'Luminous Jellyfish Swarm', 'Papercraft Floating Lanterns', 'Dark Gothic Crown Gems',
  'Anodized Rainbow Titanium', 'Microscopic Snow Crystal', 'Chrono Portal Gateway', 'Vivid Spraypaint Mural',
  'Cyberpunk Neon Alley', 'Bioluminescent Moonlight', 'Ethereal Silk Streamer', 'Industrial Pipeline Steel',
  'Kintsugi Marble Crack', 'High-Fashion Feather Cloak', 'Retro Cassette Tape Loop', 'Opaline Iridescent Shell',
  'Cybernetic Panther Shadow', 'Sub-Zero Ice Sculpture', 'Chiaroscuro Candlelight Shadow', 'Venetian Lace Corset',
  'Bio-Mechanical Organic Mesh', 'Fluid Crimson Paint Drop', 'Steampunk Compass Rose', 'Futuristic Maglev Train',
  'Vogue Clear PVC Jacket', 'Glitch Hologram Distortion', 'Subterranean Amethyst Cluster', 'Chromatic Prismatic Dust',
  'Cyberpunk Hacker Goggles', 'Botanical Ivy Lattice', 'Liquid Silver Crown', 'Solarized Thermal Neon',
  'Cybernetic Valkyrie Armor', 'High-Gloss Latex Trench', 'Retrofuturism Raygun Pulse', 'Astral Supernova Burst',
  'Luminous Firefly Swarm', 'Papercraft Origami Crane', 'Dark Gothic Skull Filigree', 'Anodized Copper Mesh',
  'Microscopic DNA Helix', 'Chrono Warp Time Sphere', 'Vivid Pop-Art Comic', 'Cyberpunk Skyline Dystopia',
  'Bioluminescent Moss Cave', 'Ethereal Mist Veil', 'Industrial Chrome Exhaust', 'Kintsugi Jade Shard',
  'High-Fashion Velvet Gown', 'Retro Boombox Equalizer', 'Opaline Mother of Pearl', 'Cybernetic Tiger Stripes',
  'Sub-Zero Snowflake Frost', 'Chiaroscuro Lantern Glow', 'Venetian Velvet Domino', 'Bio-Mechanical Cyber Spine',
  'Fluid Cyan Ink Wash', 'Steampunk Brass Pocketwatch', 'Futuristic Spaceport Terminal', 'Vogue Silk Kimono',
  'Glitch Artifact Noise', 'Subterranean Emerald Vein', 'Chromatic Rainbow Gradient', 'Cyberpunk Neon Billboard',
  'Botanical Lotus Petal', 'Liquid Platinum Flow', 'Solarized Ultraviolet Pulse', 'Cybernetic Pegasus Wings',
  'High-Gloss Leather Jacket', 'Retrofuturism Rocket Launch', 'Astral Galaxy Vortex', 'Luminous Deepsea Angler',
  'Papercraft Shadow Silhouette', 'Dark Gothic Onyx Ring', 'Anodized Cobalt Steel', 'Microscopic Snowflake Grid',
  'Chrono Paradox Time Loop', 'Vivid Neon Sunburst', 'Cyberpunk Rooftop Night', 'Bioluminescent Plankton Wave',
  'Ethereal Organza Ribbon', 'Industrial Iron Railings', 'Kintsugi Obsidian Gold', 'High-Fashion Metallic Suit',
  'Retro Vinyl Record Groove', 'Opaline Iridescent Cloud', 'Cybernetic Serpent Scales', 'Sub-Zero Frozen Waterfall',
  'Chiaroscuro Torchlight Flame', 'Venetian Lace Fan', 'Bio-Mechanical Tendril Grid', 'Fluid Magenta Ink Splash',
  'Steampunk Airship Dirigible', 'Futuristic Monorail Track', 'Vogue Satin Blazer', 'Glitch CRT Scanlines',
  'Subterranean Ruby Crystal', 'Chromatic Prism Flare', 'Cyberpunk Club Laser', 'Botanical Rose Thorn',
  'Liquid Gold Crown', 'Solarized Thermal Vision', 'Cybernetic Griffin Feather', 'High-Gloss Latex Corset',
  'Retrofuturism Bio-Dome', 'Astral Meteor Shower', 'Luminous Coral Reef', 'Papercraft Geometric Origami',
  'Dark Gothic Ruby Pendant', 'Anodized Nickel Mesh', 'Microscopic Atomic Lattice', 'Chrono Dial Clockwork',
  'Vivid Psychedelic Swirl', 'Cyberpunk Neon Tunnel', 'Bioluminescent Mushroom Glow', 'Ethereal Sheer Veil',
  'Industrial Steel Beams', 'Kintsugi Turquoise Crack', 'High-Fashion Feather Gown', 'Retro Synthesizer Knobs',
  'Opaline Pearl Nacre', 'Cybernetic Wolf Howl', 'Sub-Zero Frost Pattern', 'Chiaroscuro Spotlight Shadow',
  'Venetian Satin Mask', 'Bio-Mechanical Neural Net', 'Fluid Indigo Dye Flow', 'Steampunk Brass Sextant',
  'Futuristic Orbital Station', 'Vogue Clear Acrylic Coat', 'Glitch Matrix Signal', 'Subterranean Diamond Vein',
  'Chromatic Spectrum Ring', 'Cyberpunk Street Food Stall', 'Botanical Orchid Bloom', 'Liquid Bronze Flow',
  'Solarized Infra-Red Glare', 'Cybernetic Chimera Armor', 'High-Gloss Leather Boots', 'Retrofuturism Flying Car',
  'Astral Nebula Ring', 'Luminous Bioluminescent Algae', 'Papercraft Layered City', 'Dark Gothic Velvet Cape',
  'Anodized Titanium Weave', 'Microscopic Quantum Grid', 'Chrono Distortion Field', 'Vivid Neon Graffiti',
  'Cyberpunk Underground Club', 'Bioluminescent Cave Crystals', 'Ethereal Silk Cape', 'Industrial Mechanical Gears',
  'Kintsugi Rose Quartz', 'High-Fashion Leather Corset', 'Retro Neon Jukebox', 'Opaline Iridescent Prism',
  'Cybernetic Falcon Wings', 'Sub-Zero Ice Window', 'Chiaroscuro Moonlight Shimmer', 'Venetian Silk Tassel',
  'Bio-Mechanical Piston Mesh', 'Fluid Turquoise Ink Pour', 'Steampunk Copper Pressure Gauge', 'Futuristic Transporter Pad',
  'Vogue Metallic Fringe', 'Glitch Digital Noise Artifact', 'Subterranean Sapphire Cluster', 'Chromatic Hologram Wave',
  'Cyberpunk Neon Rain', 'Botanical Willow Branch', 'Liquid Mercury Splash', 'Solarized Thermal Heat',
  'Cybernetic Hydra Scales', 'High-Gloss Latex Dress', 'Retrofuturism Lunar Colony', 'Astral Solar Eclipse',
  'Luminous Deepsea Jellyfish', 'Papercraft Origami Crane Swarm', 'Dark Gothic Obsidian Sword', 'Anodized Brass Plating',
  'Microscopic Cell Structure', 'Chrono Continuum Wormhole', 'Vivid Pop-Art Collage', 'Cyberpunk Tower Spire',
  'Bioluminescent Lagoon Water', 'Ethereal Chiffon Ribbon', 'Industrial Rust Machinery', 'Kintsugi Emerald Shard',
  'High-Fashion Satin Suit', 'Retro Arcade Joystick', 'Opaline Dichroic Crystal', 'Cybernetic Lion Mane',
  'Sub-Zero Frost Windowpane', 'Chiaroscuro Fireplace Glow', 'Venetian Lace Parasol', 'Bio-Mechanical Exo-Suit',
  'Fluid Purple Ink Drop', 'Steampunk Brass Telescope', 'Futuristic Cyber Citadel', 'Vogue Clear PVC Cape',
  'Glitch VCR Tape Noise', 'Subterranean Topaz Crystal', 'Chromatic Prism Beam', 'Cyberpunk Neon Cyberware',
  'Botanical Sakura Blossom', 'Liquid Gold Stream', 'Solarized Neon Ultraviolet', 'Cybernetic Leviathan Scales',
  'High-Gloss Leather Pant', 'Retrofuturism Starship Bridge', 'Astral Deep Space Void', 'Luminous Electric Eel Glow',
  'Papercraft Architectural Model', 'Dark Gothic Crimson Gem', 'Anodized Steel Armor', 'Microscopic Molecule Network',
  'Chrono Gateway Portal', 'Vivid Street Art Mural', 'Cyberpunk Nightclub Floor', 'Bioluminescent Glowworm Cave',
  'Ethereal Organza Gown', 'Industrial Factory Chimney', 'Kintsugi Amethyst Vein', 'High-Fashion Chrome Corset',
  'Retro Vinyl Record Spin', 'Opaline Iridescent Wings', 'Cybernetic Eagle Beak', 'Sub-Zero Glacier Crevasse',
  'Chiaroscuro Sunset Silhouette', 'Venetian Velvet Cloak', 'Bio-Mechanical Fiber Optic', 'Fluid Pink Acrylic Pour',
  'Steampunk Copper Steam Pipe', 'Futuristic Hyperloop Capsule', 'Vogue Feather Feather boa', 'Glitch Cyber Signal Noise',
  'Subterranean Quartz Crystal', 'Chromatic Light Spectrum', 'Cyberpunk Neon Signboard', 'Botanical Sunflower Petal',
  'Liquid Silver Stream', 'Solarized High-Contrast Negative', 'Cybernetic Pegasus Armor', 'High-Gloss Latex Harness',
  'Retrofuturism Solar Collector', 'Astral Constellation Wheel', 'Luminous Glowfish Swarm', 'Papercraft Geometric Sculpture',
  'Dark Gothic Sapphire Ring', 'Anodized Bronze Mesh', 'Microscopic Crystal Lattice', 'Chrono Time Dial Indicator',
  'Vivid Psychedelic Tunnel', 'Cyberpunk Neon Alley Rain', 'Bioluminescent Moss Forest', 'Ethereal Sheer Organza Veil',
  'Industrial Iron Crane', 'Kintsugi Sapphire Shard', 'High-Fashion Metallic Dress', 'Retro Arcade Marquee Sign',
  'Opaline Nacre Shell', 'Cybernetic Jaguar Spots', 'Sub-Zero Frost Icicle', 'Chiaroscuro Candlelight Shadowing',
  'Venetian Satin Domino', 'Bio-Mechanical Cybernetic Arm', 'Fluid Orange Ink Splash', 'Steampunk Brass Compass',
  'Futuristic Space Elevator', 'Vogue Leather Biker Jacket', 'Glitch Hologram Scanlines', 'Subterranean Ruby Vein',
  'Chromatic Rainbow Prism', 'Cyberpunk Arcade Neon', 'Botanical Palm Leaf', 'Liquid Gold Splash Stream',
  'Solarized Thermal Neon Glow', 'Cybernetic Phoenix Wings', 'High-Gloss Vinyl Dress', 'Retrofuturism Space Station',
  'Astral Nebula Cloud', 'Luminous Sea Anemone', 'Papercraft Folding Screen', 'Dark Gothic Velvet Robe',
  'Anodized Titanium Plating', 'Microscopic Atom Network', 'Chrono Time Distortion Warp', 'Vivid Spraypaint Graffiti',
  'Cyberpunk Alley Reflection', 'Bioluminescent Cave Pool', 'Ethereal Silk Gown Flow', 'Industrial Steel Beams Structure',
  'Kintsugi Jade Gold Crack', 'High-Fashion Feather Ensemble', 'Retro Cassette Tape Ribbon', 'Opaline Iridescent Pearl',
  'Cybernetic Panther Armor', 'Sub-Zero Frozen Lake Surface', 'Chiaroscuro Torchlight Glow', 'Venetian Lace Shawl',
  'Bio-Mechanical Spine Column', 'Fluid Crimson Paint Splash', 'Steampunk Brass Altimeter', 'Futuristic Maglev Corridor',
  'Vogue Clear Polycarbonate Coat', 'Glitch CRT Monitor Distort', 'Subterranean Emerald Cluster', 'Chromatic Holographic Foil',
  'Cyberpunk Neon Street Lamp', 'Botanical Lotus Flower', 'Liquid Mercury Drop Stream', 'Solarized Thermal Infrared',
  'Cybernetic Valkyrie Helm', 'High-Gloss Latex Catsuit', 'Retrofuturism Plasma Cannon', 'Astral Supernova Explosion',
  'Luminous Bioluminescent Plankton', 'Papercraft Origami Crane Cluster', 'Dark Gothic Skull Ring', 'Anodized Copper Mesh Plating',
  'Microscopic DNA Double Helix', 'Chrono Time Portal Gate', 'Vivid Pop-Art Print', 'Cyberpunk Megacity Skyline',
  'Bioluminescent Deepsea Coral', 'Ethereal Sheer Chiffon Gown', 'Industrial Factory Smokestack', 'Kintsugi Turquoise Gold Crack',
  'High-Fashion Metallic Blazer', 'Retro Synthesizer Patch Panel', 'Opaline Dichroic Glass Shard', 'Cybernetic Dragon Horns',
  'Sub-Zero Frost Window Frost', 'Chiaroscuro Moonlight Shadows', 'Venetian Silk Masquerade Mask', 'Bio-Mechanical Cybernetic Eye',
  'Fluid Cyan Paint Pour', 'Steampunk Copper Pressure Gauge Clock', 'Futuristic Orbital Habitat', 'Vogue Clear PVC Trenchcoat',
  'Glitch Digital Matrix Glitch', 'Subterranean Sapphire Gemstone', 'Chromatic Spectrum Wave', 'Cyberpunk Neon Cybernetic Eye',
  'Botanical Sakura Petal Shower', 'Liquid Platinum Drop Stream', 'Solarized Ultraviolet Neon Wave', 'Cybernetic Chimera Wings',
  'High-Gloss Leather Jumpsuit', 'Retrofuturism Rocket Propulsion', 'Astral Galaxy Core Void', 'Luminous Electric Eel Glow Swarm',
  'Celestial Prism Starlight Aura', 'Neo-Gothic Blood Moon Cathedral', 'Hyper-Dimensional Tesseract Wireframe', 'Radiant Gold Filigree Brocade',
  'Cyberpunk Cyber-Blade Duelist', 'Vaporwave Arcade Sunset Sky', 'Bioluminescent Abyss Siren', 'Solartype Vintage Cyanotype Print',
  'Surrealist Liquid Gold Horizon', 'Minimalist Ink Splatter Zen', 'Futuristic Quantum Energy Reactor', 'High-Fashion Latex Bustier',
  'Art Nouveau Floral Scrollwork', 'Industrial Cybernetic Exoskeleton', 'Sub-Zero Glacial Ice Cavern', 'Chiaroscuro Velvet Shadow Portrait',
  'Kintsugi Ruby Gold Crackle', 'Steampunk Brass Clockwork Heart', 'Cyberpunk Holo-Projection Avatar', 'Vogue Clear Acrylic Corset',
  'Retrofuturism Atomic Space Cruiser', 'Astral Constellation Zodiac Map', 'Microscopic Quantum Particle Swarm', 'Decopunk Streamline Locomotive',
  'Bio-Mechanical Neural Cyber-Spine', 'Fluid Iridescent Paint Swirl', 'Glitch VHS Digital Artifacts', 'Dark Gothic Raven Queen',
  'Opaline Dichroic Crystal Shard', 'Bioluminescent Deep Trench Flora', 'Cybernetic Valkyrie Shield', 'High-Gloss Wet-Look Leather',
  'Vaporwave Japanese City Pop Night', 'Celestial Galaxy Core Portal', 'Surreal Floating Island Laputa', 'Art Deco Gilded Sunburst Tower',
  'Minimalist Single-Line Elegance', 'Hyper-Speed Urban Light Trails', 'Masterpiece 1:1 Cyberpunk Vixen'
];

export interface ArtTypeData {
  day: number;
  artType: string;
  artCategory: string;
  outfitStyle: OutfitStyle;
  outfitDescription: string;
  colorCombo: ColorCombo;
  graffitiStyle: { name: string; description: string };
  description: string;
  promptSnippet: string;
}

// 9 Master Graffiti Styles
export const GRAFFITI_STYLES = [
  { name: 'Futurism / Neo-Wildstyle', description: 'hyper-modern letter construction with impossible geometry, cybernetic angles, glowing linework, and 3D block shading' },
  { name: 'FX Style', description: 'heavy use of chrome, flames, smoke, electricity, melting effects, 3D extrusion, shattered glass, liquid metal, and optical flare effects' },
  { name: 'Organic Wildstyle', description: 'organic wildstyle lettering where letters morph naturally into roots, bones, tentacles, vines, muscles, insects, or swirling smoke' },
  { name: 'Refined Masterpiece', description: 'a highly refined classic graffiti mural piece with clean outlines, drop shadows, 3D block shading, and artistic characters' },
  { name: 'Abstract Style', description: 'abstract lettering pushing letterforms almost into 3D sculpture while remaining technically readable and visually stunning' },
  { name: 'Wildstyle', description: 'extremely intricate, interlocking letters that are exquisitely balanced, highly complex, and nearly unreadable to non-writers' },
  { name: '3D Graffiti', description: '3D graffiti where letters appear carved, floating, folded, and dynamically emerging from walls with deep 3D block extrusion' },
  { name: 'Calligraffiti', description: 'calligraffiti combining traditional urban graffiti with expressive, elegant, sweeping calligraphy letterforms' },
  { name: 'Burner Masterpiece', description: 'a large, fully realized wholecar burner masterpiece with flawless fills, characters, backgrounds, and vibrant highlights' },
];

// Generate 365 clean, deterministic art type records
const MASTER_ART_TYPES_365: ArtTypeData[] = [];

for (let day = 1; day <= 365; day++) {
  const nameIndex = (day - 1) % ART_TYPE_NAMES.length;
  const categoryIndex = (day - 1) % BASE_ART_CATEGORIES.length;
  const paletteIndex = (day - 1) % COLOR_PALETTES.length;
  const outfitIndex = (day - 1) % OUTFIT_KEYS.length;
  const graffitiIndex = (day - 1) % GRAFFITI_STYLES.length;

  const outfitStyle = OUTFIT_KEYS[outfitIndex];
  const outfitMeta = OUTFIT_STYLES[outfitStyle];
  const artTypeName = ART_TYPE_NAMES[nameIndex];
  const colorCombo = COLOR_PALETTES[paletteIndex];
  const category = BASE_ART_CATEGORIES[categoryIndex];
  const graffitiStyle = GRAFFITI_STYLES[graffitiIndex];

  const desc = `Rendered in stunning ${artTypeName} style — featuring ${outfitMeta.label} garments (${outfitMeta.description}), dynamic ${category} composition, and a striking ${colorCombo.name} color palette.`;

  MASTER_ART_TYPES_365.push({
    day,
    artType: artTypeName,
    artCategory: category,
    outfitStyle,
    outfitDescription: outfitMeta.description,
    colorCombo,
    graffitiStyle,
    description: desc,
    promptSnippet: `Direct 1:1 Square Album Cover Art (${artTypeName} style, ${outfitMeta.label} outfit: ${outfitMeta.description}, ${graffitiStyle.name} typography, ${colorCombo.name} palette). Masterpiece, 8K resolution, --ar 1:1`,
  });
}

/**
 * Returns the exact ArtTypeData for a given day (1 to 365).
 */
export function getArtTypeForDay(day: number): ArtTypeData {
  const dayNum = Math.max(1, Math.min(365, typeof day === 'number' ? day : 1));
  return MASTER_ART_TYPES_365[dayNum - 1];
}

/**
 * Returns all 365 Art Type records.
 */
export function getAllArtTypes(): ArtTypeData[] {
  return MASTER_ART_TYPES_365;
}

/**
 * Filter 365 art types by outfit material style (e.g. 'shiny', 'pastel', 'clear', 'leather', 'silk', 'lacey').
 */
export function getArtTypesByOutfit(outfitStyle: OutfitStyle): ArtTypeData[] {
  return MASTER_ART_TYPES_365.filter((item) => item.outfitStyle === outfitStyle);
}

/**
 * Filter 365 art types by art category.
 */
export function getArtTypesByCategory(category: string): ArtTypeData[] {
  return MASTER_ART_TYPES_365.filter(
    (item) => item.artCategory.toLowerCase() === category.toLowerCase()
  );
}

export interface PromptOptions {
  songTitle?: string;
  artistName?: string;
  lyrics?: string;
  outfitChoice?: string;
  girlArchetype?: string;
  cameraAngle?: string;
  aspectRatio?: string;
}

const DEFAULT_GIRL_DESCRIPTIONS = "Beautiful bombshell curvaceous women with igg utts in stylized bikinis, stockings, pajamas, pig tails, lingerie, platform heels, thongs, micro-bikinis, booty shorts, nude form fitting leather, nightwear, school outfits from japan, body paint or yogawear";

/**
 * Generate a complete 1:1 Special Artwork Prompt for generating cover art assets for a specific day/song.
 */
export function generateArtPromptForDay(
  day: number,
  options?: PromptOptions | string,
  legacyArtist: string = "th3scr1b3",
  legacyLyrics?: string
): string {
  const art = getArtTypeForDay(day);
  
  let songTitle: string | undefined;
  let artistName = legacyArtist;
  let lyrics = legacyLyrics;
  let outfitChoice: string | undefined;
  let girlArchetype = DEFAULT_GIRL_DESCRIPTIONS;
  let cameraAngle = "flat front-facing album cover illustration filling the square frame edge-to-edge, NO vinyl record disc, NO physical mockup, NO background margins";
  let ar = "--ar 1:1";

  if (typeof options === 'object' && options !== null) {
    songTitle = options.songTitle;
    artistName = options.artistName || legacyArtist;
    lyrics = options.lyrics;
    outfitChoice = options.outfitChoice;
    if (options.girlArchetype) girlArchetype = options.girlArchetype;
    if (options.cameraAngle) cameraAngle = options.cameraAngle;
    if (options.aspectRatio) ar = options.aspectRatio;
  } else if (typeof options === 'string') {
    songTitle = options;
  }

  const trackName = songTitle || `Track Day ${day}`;
  const lyricText = lyrics || art.description;
  const outfitSpec = outfitChoice ? `${art.outfitDescription}, ${outfitChoice}` : art.outfitDescription;

  return `Direct 1:1 Square Album Cover Art (${cameraAngle}).
Artistic Style: Rendered in stunning ${art.artType} style — ${art.description}.
Top Title Typography: Prominently featured across the top of the illustration is the track title "${trackName}" rendered as masterwork ${art.graffitiStyle.name} graffiti — ${art.graffitiStyle.description}, surrounded by artistic characters, stars, clouds, and spray-paint drips.
Bottom Banner Text: Running along the bottom of the illustration inside a decorative scroll banner is hand-lettered text reading: "Day ${day} of ${artistName}'s 365 days of light and dark".
Central Visual Imagery: ${girlArchetype} in ${outfitSpec} dynamically and seductively posed in ${art.artType} style, visually acting out, embodying, and portraying the core underlying conflict and emotional struggle of the lyrics: "${lyricText}".
Aesthetic & Colors: ${art.description}, deep shadows, and a striking ${art.colorCombo.name} color palette. Masterpiece, 8K resolution, ultra-detailed, high contrast, surreal, evocative, ${ar}`;
}

/**
 * Generates all 365 prompts in a single formatted markdown collection string.
 */
export function generateAll365Prompts(options?: PromptOptions): string {
  const lines: string[] = [];
  lines.push('# 365 Days of Light and Dark - Master Artwork Prompt Collection\n');
  
  for (let day = 1; day <= 365; day++) {
    const art = getArtTypeForDay(day);
    lines.push(`### Day ${day}: Track Day ${day}`);
    lines.push(`- **Art Style**: ${art.artType}`);
    lines.push(`- **Graffiti Style**: ${art.graffitiStyle.name}`);
    lines.push(`- **Outfit Style**: ${OUTFIT_STYLES[art.outfitStyle].label} (${art.outfitDescription})`);
    lines.push(`- **Colors**: ${art.colorCombo.name}`);
    lines.push('```text');
    lines.push(generateArtPromptForDay(day, options));
    lines.push('```\n');
  }

  return lines.join('\n');
}
