/**
 * This file contains utility classes, data structures, and mapping definitions
 * used by the sonification engine.
 */

const Tone = window.Tone;

// Define the DrumSampler class
export class DrumSampler {
  constructor() {
    this.sampler = new Tone.Sampler().toDestination();
    this.note_keys = [
      "A0", "Bb0", "B0", "C1", "Db1", "D1", "Eb1", "E1", "F1", "Gb1", "G1", "Ab1",
      "A1", "Bb1", "B1", "C2", "Db2", "D2", "Eb2", "E2", "F2", "Gb2", "G2", "Ab2",
      "A2", "Bb2", "B2", "C3", "Db3", "D3", "Eb3", "E3", "F3", "Gb3", "G3", "Ab3",
      "A3", "Bb3", "B3", "C4", "Db4", "D4", "Eb4", "E4", "F4", "Gb4", "G4", "Ab4",
      "A4", "Bb4", "B4", "C5", "Db5", "D5", "Eb5", "E5", "F5", "Gb5", "G5", "Ab5",
      "A5", "Bb5", "B5", "C6", "Db6", "D6", "Eb6", "E6", "F6", "Gb6", "G6", "Ab6",
      "A6", "Bb6", "B6", "C7", "Db7", "D7", "Eb7", "E7", "F7", "Gb7", "G7", "Ab7",
      "A7", "Bb7", "B7", "C8"
    ];
    this.index = 0;
    this.notes = {}; 
  }

  add(note, file, callback) {
    this.notes[note] = this.note_keys[this.index];
    this.index++;
    this.sampler.add(this.notes[note], file, callback);
  }

  triggerAttackRelease(note, duration, time, velocity) {
    if (!this.notes[note]) {
      console.warn(`No note mapping for ${note}`);
      return;
    }
    this.sampler.triggerAttackRelease(this.notes[note], duration, time, velocity);
  }
}
// instrument mapping for land use types - Updated based on Image 7
export const LAND_USE_TO_INSTRUMENT = {
  'Agricultural': 'hangdrum',
  'Business & Industry': 'trumpet',
  'Center & Mixed-Use': 'violin',
  'Culture, Recreation & Sports': 'xylo',
  'Retail & Services': 'oboe',
  'Hospitality & Office': 'bass',
  'Social & Community': 'organ',
  'Nature & Green Spaces': 'flute',
  'Residential': 'piano',
  'Water Bodies': 'glockens',
  'Others': 'melodic'
};

// sample maps for instruments
export const SAMPLE_MAPS = [
  { instrument: "bass", samples: { Db4: "db4.wav", G4: "g4.wav" } },
  { instrument: "bassoon", samples: { C4: "c4.wav", E4: "e4.wav", C5: "c5.wav" } },
  { instrument: "flute", samples: { C4: "c4.wav", E5: "e5.wav" } },
  { instrument: "glockens", samples: { G4: "g4.wav", C5: "c5.wav", C6: "c6.wav" } },
  { instrument: "oboe", samples: { D4: "d4.wav", F5: "f5.wav" } },
  { instrument: "piano", samples: { C4: "c4.wav", G5: "g5.wav" } },
  { instrument: "trumpet", samples: { D5: "d5.wav", C6: "c6.wav" } },
  { instrument: "violin", samples: { C4: "c4.wav", G4: "g4.wav", E5: "e5.wav" } },
  { instrument: "xylo", samples: { C4: "c4.wav", G5: "g5.wav" } },
  { instrument: "hangdrum", samples: { C4: "c4.wav", Eb4: "eb4.wav", B4: "b4.wav" } },
  { instrument: "organ", samples: { C4: "c4.wav", Eb5: "eb5.wav" } },
];

// street chord designs - Updated based on Image 8
export const STREET_CHORD_DESIGNS = {
  "t12": ["C4", "E4", "G4", "C5"],       
  "t22": ["F4", "A4", "D5", "Bb4"],      
  "t23": ["Eb4", "G4", "Bb4", "C5"],     
  "t24": ["E4", "C4", "F#4", "A4"],     
  "t31": ["D4", "Bb4", "F#4", "G4"],      
  "t41": ["Bb3", "D4", "G4", "A4"],      
  "t42": ["C5", "A4", "F#4", "D4"],     
  "no": ["C4", "C4", "C4", "C4"]
};

// height to volume/loudness mapping - Updated based on Image 1
export const HEIGHT_CLASSES = [
  { min: 0,  max: 6,   volume: 0.3 },
  { min: 6,  max: 15,  volume: 0.9 },
  { min: 15, max: 27,  volume: 0.9 },
  { min: 27, max: 50,  volume: 2.2 },
  { min: 50, max: 9999, volume: 3.0 }
];

// age classes for rhythm pattern mapping 
export const AGE_CLASSES = [
  { min: 0,   max: 25,   patternIndex: 0 },   // Rapid-fire staccatos
  { min: 25,  max: 65,   patternIndex: 1 },   // Sparse staccatos  
  { min: 65,  max: 135,  patternIndex: 2 },   // Stable pulse
  { min: 135, max: 190,  patternIndex: 3 },   // Semi-sustained flow
  { min: 190, max: 9999, patternIndex: 4 }    // Fully sustained drone
];

// age rhythm patterns
export const AGE_RHYTHM_PATTERNS = {
  0: [ // Age Class 1 
    { time: "0s",    dur: "0.2s" },
    { time: "0.25s", dur: "0.2s" },
    { time: "0.5s",  dur: "0.2s" },
    { time: "0.75s", dur: "0.2s" },
    { time: "1s",    dur: "0.2s" },
    { time: "1.25s", dur: "0.2s" },
    { time: "1.5s",  dur: "0.2s" },
    { time: "1.75s", dur: "0.2s" }
  ],
  1: [ // Age Class 2 
    { time: "0s",    dur: "0.4s" },
    { time: "0.67s", dur: "0.4s" },
    { time: "1.33s", dur: "0.4s" },
    { time: "2s",    dur: "0.4s" }
  ],
  2: [ // Age Class 3
    { time: "0s",    dur: "0.3s" },
    { time: "0.67s", dur: "0.3s" },
    { time: "1.33s", dur: "0.3s" },
    { time: "2s",    dur: "0.3s" }
  ],
  3: [ // Age Class 4 
    { time: "0s", dur: "0.5s" },
    { time: "2s", dur: "0.5s" }
  ]
};

// land use property mapping - For city blocks
export const LAND_USE_PROPERTY_MAP = {
  'prop_agriculture': 'Agricultural',
  'prop_business': 'Business & Industry',
  'prop_center': 'Center & Mixed-Use',
  'prop_culture': 'Culture, Recreation & Sports',
  'prop_retail': 'Retail & Services',
  'prop_hospitality': 'Hospitality & Office',
  'prop_social': 'Social & Community',
  'prop_nature': 'Nature & Green Spaces',
  'prop_residential': 'Residential',
  'prop_water': 'Water Bodies'
};

// street type definitions
export const STREET_DEFS = [
  { key: 't12', shape: 'rect', stroke: 2 },
  { key: 't22', shape: 'circle', stroke: 2 },
  { key: 't23', shape: 'circle', stroke: 3.5 },
  { key: 't24', shape: 'circle', stroke: 5 },
  { key: 't25', shape: 'circle', stroke: 6.5 },
  { key: 't31', shape: 'para', stroke: 2 },
  { key: 't41', shape: 'tri', stroke: 2 },
  { key: 't42', shape: 'tri', stroke: 3.5 }
];

// cluster chords
export const CLUSTER_CHORDS = {
  '0': ["C4", "E4", "G4"],
  '1': ["D4", "F4", "A4"],
  '2': ["E4", "G4", "B4"],
  '3': ["F4", "A4", "C5"],
  '4': ["G4", "B4", "D5"],
  '5': ["A4", "C5", "E5"],
  '6': ["B4", "D5", "F5"]
};

// mapping functions for different layer types
export const SONIFICATION_MAPPINGS = {
  'building-height': {
    heightToNote: (height) => {
      if (height < 6) return "C3";
      if (height < 15) return "E3";
      if (height < 27) return "G3";
      if (height < 50) return "B3";
      return "C4";
    },
    heightToVolume: (height) => {
      return Math.min(-20 + (height / 2), -5);
    }
  },
  'building-age': {
    ageToNote: (age) => {
      if (age < 25) return "C4";
      if (age < 65) return "E4";
      if (age < 135) return "G4";
      if (age < 190) return "B4";
      return "C5";
    },
    ageToReverb: (age) => {
      return Math.min(0.2 + (age / 100), 0.9);
    }
  },
  'street': {
    typeToChord: (type) => {
      let typeKey = '';
      if (type.includes('1-2')) typeKey = 't12';
      else if (type.includes('2-2')) typeKey = 't22';
      else if (type.includes('2-3')) typeKey = 't23';
      else if (type.includes('2-4')) typeKey = 't24';
      else if (type.includes('2-5')) typeKey = 't25';
      else if (type.includes('3-1')) typeKey = 't31';
      else if (type.includes('4-1')) typeKey = 't41';
      else if (type.includes('4-2')) typeKey = 't42';
      else typeKey = 't12'; // Default
      
      return STREET_CHORD_DESIGNS[typeKey] || ["C4", "E4", "G4"];
    },
    lengthToTempo: (length) => {
      return Math.max(80, 140 - (length / 2));
    }
  }
};

/**
 * Gets the volume from building height.
 * @param {number} height Building height value
 * @returns {number} Appropriate volume value between 0.3 and 1.0
 */
export function getVolumeFromHeight(height) {
  for (const h of HEIGHT_CLASSES) {
    if (height >= h.min && height < h.max) return h.volume;
  }
  return 0.9; 
}

/**
 * Gets the rhythm pattern index from building age.
 * @param {number} age Building age value
 * @returns {number} Index of rhythm pattern to use (0-7)
 */
export function getPatternIndexFromAge(age) {
  for (const a of AGE_CLASSES) {
    if (age >= a.min && age < a.max) return a.patternIndex;
  }
  return 0; 
}

/**
 * Determines the dominant street type from properties.
 * @param {Object} properties GeoJSON feature properties
 * @returns {string} The dominant street type key
 */
export function getDominantStreetType(properties) {
  let domType = null;
  let maxVal = -1;
  for (const def of STREET_DEFS) {
    const key = def.key;
    const val = parseFloat(properties[key]) || 0;
    if (val > maxVal) {
      maxVal = val;
      domType = key;
    }
  }
  return domType || 't12';
}

/**
 * Gets the chord based on street type.
 * @param {Object} properties GeoJSON feature properties
 * @returns {string[]} Array of notes forming a chord
 */
export function getChordFromStreetType(properties) {
  let domType = getDominantStreetType(properties);
  return STREET_CHORD_DESIGNS[domType] || ["C4", "E4", "G4"];
}

/**
 * Gets top land uses sorted by proportion.
 * @param {Object} properties GeoJSON feature properties
 * @returns {Array} Array of top land use objects with type and proportion
 */
export function getTopLandUses(properties) {
  const lus = [];
  for (const [prop, luType] of Object.entries(LAND_USE_PROPERTY_MAP)) {
    const p = parseFloat(properties[prop]) || 0;
    if (p > 0) {
      lus.push({ type: luType, proportion: p });
    }
  }
  lus.sort((a, b) => b.proportion - a.proportion);
  return lus.slice(0, 3); // Return top 3 land uses
}

/**
 * Update City Blocks Tooltips.
 *
 * @param {any} data - Data to pass to your tooltip display function.
 */
export function updateCityBlocksTooltips(data) {
  if (document.getElementById('visual-checkbox').checked) {
    showCityBlocksTooltip(data);
    console.log("Visual tooltips enabled");
  } else {
    hideCityBlocksTooltip();
    console.log("Visual tooltips disabled");
  }
}

/**
 * Plays a subtle bip sound for hover notification
 * @param {Object} options Optional configuration for the bip sound
 */
export function playHoverBipSound(options = {}) {
  const defaultOptions = {
    note: "C6",
    duration: "32n",
    volume: 0.1
  };
  
  const config = { ...defaultOptions, ...options };
  
  // Create a simple synth that auto-disposes after playing
  const bipSynth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: {
      attack: 0.001,
      decay: 0.1,
      sustain: 0,
      release: 0.1
    },
    volume: -25
  }).toDestination();
  
  bipSynth.triggerAttackRelease(config.note, config.duration, undefined, config.volume);
  
  setTimeout(() => {
    if (bipSynth) {
      bipSynth.dispose();
    }
  }, 500);
}

export const getPitchFromAge = (age) => {
  if (age < 25) return "C4";
  if (age < 65) return "E4";
  if (age < 135) return "G4";
  if (age < 190) return "B4";
  return "C5";
};

export const getTempoFromHeight = (height) => {
  if (height < 6) return 75;
  if (height < 15) return 85;
  if (height < 27) return 90;
  if (height < 50) return 95;
  return 100;
};

/**
 * Play a chord as an arpeggio with timing based on age class.
 * @param {Object} instrument The instrument/sampler to use
 * @param {Array} chord Array of notes to play as arpeggio
 * @param {Number} agePatternIndex Index of age pattern to determine timing
 * @param {Number} startTime When to start playing (Tone.js time)
 * @param {Number} volume Volume level to play at
 */
export function playArpeggio(instrument, chord, agePatternIndex, startTime = undefined, volume = 0.8) {
  if (!instrument) return;
  
  const now = startTime || Tone.now();
  
  // Define timing intervals between notes based on age class
const arpIntervals = [
  0.214,  // Age Class 0 
  0.316,  // Age Class 1 
  0.5,    // Age Class 2 
  0.75,   // Age Class 3 
  1.2     // Age Class 4 
];
  const interval = arpIntervals[agePatternIndex] || 0.5;
  
  const noteDuration = Math.max(0.1, interval * 0.8);
  
  chord.forEach((note, index) => {
    const noteTime = now + (index * interval);
    try {
      instrument.triggerAttackRelease(note, noteDuration + "s", noteTime, volume);
      console.log(`Arpeggio note ${index + 1}/${chord.length}: ${note} at time +${index * interval}s`);
    } catch (error) {
      console.warn(`Failed to play arpeggio note ${note}: ${error.message}`);
    }
  });
}

/**
 * Get the panning position based on building height
 * Maps building height to a vertical position (y-axis panning)
 * Range from -1.0 (bottom) to 1.0 (top)
 * 
 * @param {number} height Building height in meters
 * @returns {number} Panning value between -1 and 1
 */
export function getPanningFromHeight(height) {
  if (height < 3) return -2.0;       
  if (height < 6) return -0.6;      
  if (height < 10) return -0.2;       
  if (height < 14.5) return 0;     
  if (height < 20) return 0.20;       
  if (height < 30) return 0.65;      
  if (height < 50) return 2;       
  return 1.0;    
}

/**
 * Mapping building height to octave and loudness combinations
 * 
 * @param {number} height Building height in meters
 * @returns {Object} Containing octave adjustment and volume
 */
export function getHeightToOctaveAndVolume(height) {
  const h = parseFloat(height);
  
  if (h < 6) return { octaveShift: -1, volume: 0.3 };
  if (h < 15) return { octaveShift: -1, volume: 0.9 };
  if (h < 27) return { octaveShift: 0, volume: 0.9 };
  if (h < 50) return { octaveShift: 0, volume: 2.2 };
  return { octaveShift: 1, volume: 3.0 };
}
export function addLimiterToSonificationEngine(sonificationEngine) {
  if (!sonificationEngine) return;
  
  if (!sonificationEngine.limiter) {
    sonificationEngine.limiter = new Tone.Limiter(-1).toDestination();
    
    if (sonificationEngine.synths) {
      Object.values(sonificationEngine.synths).forEach(synth => {
        synth.disconnect();
        synth.connect(sonificationEngine.limiter);
      });
    }
    
    if (sonificationEngine.samplers) {
      Object.values(sonificationEngine.samplers).forEach(sampler => {
        sampler.disconnect();
        sampler.connect(sonificationEngine.limiter);
      });
    }
    
    console.log("Added limiter to sonification engine to prevent clipping with high volumes");
  }
}

/**
 * Apply octave and volume information to chord notes
 * 
 * @param {Array} baseChord Base chord notes
 * @param {number} height Building height
 * @returns {Object} Contains adjusted chord and volume
 */
export function getHeightAdjustedChord(baseChord, height) {
  const { octaveShift, volume } = getHeightToOctaveAndVolume(height);
  
  const adjustedChord = baseChord.map(note => {
    const noteRegex = /^([A-Ga-g])(#|b)?(\d+)$/;
    const match = note.match(noteRegex);
    
    if (match) {
      const noteLetter = match[1].toUpperCase();  
      const accidental = match[2] || "";        
      const currentOctave = parseInt(match[3]);   
      
      const newOctave = currentOctave + octaveShift;
      
      return `${noteLetter}${accidental}${newOctave}`;
    }
    
    return note;
  });
  
  return { chord: adjustedChord, volume };
}