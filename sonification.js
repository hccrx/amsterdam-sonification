/* implementing the main sonification logic using utility functions from sonificationUtils.js. */


const Tone = window.Tone;

import {
    DrumSampler,
    LAND_USE_TO_INSTRUMENT,
    SAMPLE_MAPS,
    STREET_CHORD_DESIGNS,
    HEIGHT_CLASSES,
    AGE_CLASSES,
    AGE_RHYTHM_PATTERNS,
    LAND_USE_PROPERTY_MAP,
    STREET_DEFS,
    CLUSTER_CHORDS,
    SONIFICATION_MAPPINGS,
    getVolumeFromHeight,
    getPatternIndexFromAge,
    getPitchFromAge,
    getTempoFromHeight,
    getDominantStreetType,
    getChordFromStreetType,
    getTopLandUses,
    getPanningFromHeight,
    getHeightToOctaveAndVolume,
    getHeightAdjustedChord,
    playArpeggio
  } from "./sonificationUtils.js";


export class SonificationEngine {
  constructor() {
    this.initialized = false;
    this.active = false;
    this.lastBuildingId = null;   
    this.lastLandUseRowId = null;   
    this.lastStreetRowId = null;    
    this.lastClusterId = null;      
    this.boundaryTriggered = false; 
    this.initAudioComponents();
    this.samplers = {};

    this.landUseToInstrument = LAND_USE_TO_INSTRUMENT;
    this.streetChordDesigns = STREET_CHORD_DESIGNS;
    this.heightClasses = HEIGHT_CLASSES;
    this.ageClasses = AGE_CLASSES;
    this.ageRhythmPatterns = AGE_RHYTHM_PATTERNS;
    this.landUsePropertyMap = LAND_USE_PROPERTY_MAP;
    this.streetDefs = STREET_DEFS;
    this.clusterChords = CLUSTER_CHORDS;
    this.mappings = SONIFICATION_MAPPINGS;
  }

  /* Initialize audio components, synths and effects. */
  initAudioComponents() {
    this.panner = new Tone.Panner3D({
      positionX: 0,
      positionY: 0,
      positionZ: 0
    }).toDestination();
    
    this.synths = {
      melodic: new Tone.PolySynth(Tone.Synth).connect(this.panner),
      fm: new Tone.FMSynth().connect(this.panner),
      pluck: new Tone.PluckSynth().connect(this.panner),
      membrane: new Tone.MembraneSynth().connect(this.panner)
    };
    
    this.effects = {
      reverb: new Tone.Reverb(1.5).connect(this.panner),
      delay: new Tone.FeedbackDelay("8n", 0.3).connect(this.panner),
      distortion: new Tone.Distortion(0.2).connect(this.panner),
      chorus: new Tone.Chorus(4, 2.5, 0.5).connect(this.panner)
    };
    
    this.synths.melodic.connect(this.effects.reverb);
    this.synths.fm.connect(this.effects.delay);
    this.synths.pluck.connect(this.effects.chorus);
    
    this.synths.melodic.volume.value = -5;
    this.synths.fm.volume.value = -8;
    this.synths.pluck.volume.value = -5;
    this.synths.membrane.volume.value = -12;
  }
  /**
   * @returns {Promise} Promise that resolves when initialization is complete.
   */
  async initialize() {
    if (this.initialized) return;
    try {
      await Tone.start();
      console.log("Sonification engine initialized");
      await this.loadSamples();
      Tone.Transport.start();
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize Tone.js:", error);
    }
  }

  /**
   * Load instrument samples.
   * @returns {Promise<boolean>} Promise that resolves to true when samples are loaded.
   */
  async loadSamples() {
    console.log("Loading instrument samples...");
    try {
      // Load instrument samples
      for (const sampleMap of SAMPLE_MAPS) {
        const instrument = sampleMap.instrument;
        console.log(`Loading samples for ${instrument}...`);
        const urls = {};
        for (const [note, file] of Object.entries(sampleMap.samples)) {
          urls[note] = `sounds/${instrument}/${file}`;
        }
        const sampler = new Tone.Sampler({
          urls: urls,
          release: 1,
          onload: () => {
            console.log(`${instrument} samples loaded successfully`);
          }
        }).connect(this.panner); // Connect to panner instead of toDestination()
        this.samplers[instrument] = sampler;
      }
      
      console.log("Sample loading completed");
      return true;
    } catch (error) {
      console.error("Error loading samples:", error);
      return false;
    }
  }

  /**
   * Play a sample using a specific instrument.
   * @param {string} instrument Instrument name
   * @param {string} note Note to play (default: 'C4')
   * @param {number} volume Volume level (default: 1.0)
   */
  playSample(instrument, note = 'C4', volume = 1.0) {
    if (!this.active) return;
    const sampler = this.samplers[instrument];
    if (!sampler) {
      console.warn(`No sampler found for ${instrument}`);
      return;
    }
    try {
      const originalVolume = sampler.volume.value;
      sampler.volume.value = Math.min(Math.max(-30, 10 * Math.log10(volume)), 0);
      sampler.triggerAttackRelease(note, 0.8);
      console.log(`Playing ${note} on ${instrument} at volume ${volume}`);
      setTimeout(() => {
        sampler.volume.value = originalVolume;
      }, 1000);
    } catch (error) {
      console.warn(`Failed to play ${note} on ${instrument}: ${error.message}`);
      const fallbackNotes = ['C3', 'C5', 'C2', 'C6', 'C1'];
      for (const fbNote of fallbackNotes) {
        try {
          sampler.triggerAttackRelease(fbNote, 0.8);
          console.log(`Playing fallback ${fbNote} on ${instrument}`);
          break;
        } catch (fallbackError) {
          // Continue trying
        }
      }
    }
  }

  /**
   * Set active state of the engine.
   * @param {boolean} active Whether the engine should be active
   */
  setActive(active) {
    this.active = active;
    if (active && !this.initialized) {
      this.initialize();
    }
    if (!active) {
      this.stopAllSounds();
    }
  }

  /**
   * Main method to determine which sonification to trigger based on layerId.
   * @param {string} layerId Layer identifier
   * @param {Object} feature GeoJSON feature
   * @returns {string} The layer ID that was sonified
   */
  sonifyFeature(layerId, feature) {
    if (!this.active || !this.initialized) return layerId;
    const props = feature.properties || {};
    
    switch (layerId) {
      case 'building-height':
        this.sonifyBuildingHeight(props);
        break;
      case 'building-age':
        this.sonifyBuildingAge(props);
        break;
      case 'city-blocks':
        this.sonifyCityBlocks(props);
        break;
      case 'clusters':
      case 'clusters-labeled':
        this.sonifyClustersChords(props);
        break;
      case 'landuse':
        this.sonifyLandUse(props);
        break;
      case 'street':
        this.sonifyStreet(props);
        break;
      case 'amsterdam-boundary':
        this.sonifyBoundary(props);
        break;
      default:
        console.log(`No specialized sonification for ${layerId}`);
        break;
    }
    return layerId;
  }

  /**
   * Sonification for building height.
   * @param {Object} properties Feature properties
   */
  sonifyBuildingHeight(properties) {
    if (properties.id && properties.id === this.lastBuildingId) return;
    if (properties.id) this.lastBuildingId = properties.id;
    
    const height = parseFloat(properties.height) || 10;
    // Use the mapping functions to get pitch and volume
    const note = this.mappings['building-height'].heightToNote(height);
    const volume = this.mappings['building-height'].heightToVolume(height);
    
    // Add panning based on height
    const panningY = getPanningFromHeight(height);
    this.panner.positionY.value = panningY;
    
    const originalVolume = this.synths.fm.volume.value;
    this.synths.fm.volume.value = volume;
    this.synths.fm.triggerAttackRelease(note, "8n");
    setTimeout(() => {
      this.synths.fm.volume.value = originalVolume;
    }, 100);
    console.log(`Building Height: ${height}m - Playing note ${note} at volume ${volume} with vertical panning ${panningY}`);
  }

  /**
   * Sonification for building age.
   * @param {Object} properties Feature properties
   */
  sonifyBuildingAge(properties) {
    const age = parseFloat(properties.age) || 50;
    
    // Use the age classes to determine pitch
    let pitch = "C4";
    for (const a of this.ageClasses) {
      if (age >= a.min && age < a.max) {
        pitch = a.min === 0 ? "C4" : 
               a.min === 15 ? "D4" : 
               a.min === 35 ? "E4" :
               a.min === 60 ? "F4" :
               a.min === 75 ? "G4" :
               a.min === 95 ? "A4" :
               a.min === 125 ? "B4" : "C5";
        break;
      }
    }
    
    this.synths.melodic.triggerAttackRelease(pitch, "8n");
    console.log(`Building Age: ${age} years - Playing pitch ${pitch}`);
  }

  /**
   * Sonification for landuse.
   * @param {Object} properties Feature properties
   */
  sonifyLandUse(properties) {
    if (!this.active || !this.initialized) return;
    if (properties.rowId && properties.rowId === this.lastLandUseRowId) return;
    if (properties.rowId) this.lastLandUseRowId = properties.rowId;
    const luClass = properties.new_lu_class || 'Residential';
    console.log(`Sonifying land use: ${luClass}`);
    const instrument = this.cityBlocksInstrument || this.landUseToInstrument[luClass] || 'piano';
    this.playSample(instrument, 'C4');
  }

  /**
   * Sonification for street network.
   * @param {Object} properties Feature properties
   */
  sonifyStreet(properties) {
    if (properties.rowId && properties.rowId === this.lastStreetRowId) return;
    if (properties.rowId) this.lastStreetRowId = properties.rowId;
    const streetType = properties.Type || 'Type 1-2';
    const length = properties.length || 10;
    const tempo = this.mappings.street.lengthToTempo(length);
    Tone.Transport.bpm.value = tempo;
    this.synths.membrane.triggerAttackRelease("C2", "16n");
  } 

   /**
   * Sonification for clusters.
   * @param {Object} properties Feature properties
   */
sonifyClustersChords(properties, forcePlay = false) {
  // Removed the check against lastClusterId to ensure every block plays a sound
  
  const cluster = properties.Cluster || "0";
  const scales = {
    '0': ["C4", "E4", "G4"],
    '1': ["D4", "F4", "A4"],
    '2': ["E4", "G4", "B4"],
    '3': ["F4", "A4", "C5"],
    '4': ["G4", "B4", "D5"],
    '5': ["A4", "C5", "E5"],
    '6': ["B4", "D5", "F5"]
  };
  const chord = scales[cluster] || ["C4", "E4", "G4"];
  console.log(`Clusters: Playing chord for cluster ${cluster}: ${chord.join(", ")}`);
  this.synths.melodic.triggerAttackRelease(chord, "0.2");
}


    /**
   * Sonification for boundary.
   * @param {Object} properties Feature properties
   */
    sonifyBoundary(properties) {
      if (this.boundaryTriggered) return;
      this.boundaryTriggered = true;
      this.synths.melodic.triggerAttackRelease("C3", "8n");
      console.log("Sonifying Amsterdam boundary");
    }    

  
  /**
   * sonification for City BlocksBlock Explorer.
   * Maps:
   * - Street types (t12, t22, etc.) to chord designs
   * - Land use properties to instruments
   * - w_age_mean to duration/silence patterns
   * - w_height_mean to volume
   * 
   * @param {Object} properties Feature properties
   */
  sonifyCityBlocks(properties) {
  
    if (!document.getElementById('audio-checkbox').checked) {
      console.log("Audio is disabled; skipping City Blocks sonification.");
      return;
    }
    
    // Get the audioMetrics settings from the connector
    const audioMetrics = window.mapSoundConnector ? window.mapSoundConnector.audioMetrics : {
      buildingAge: true,
      buildingHeight: true,
      landUse: true,
      streetNetwork: true
    };
    
    // 1. Get the building height (w_height_mean) for volume mapping and chord adjustment
    const wHeight = parseFloat(properties.w_height_mean) || 10;     
    console.log(`Actual height value: ${wHeight}, type: ${typeof wHeight}`); 
    // 2. Get the building age (w_age_mean) for rhythm patterns
    const wAge = parseFloat(properties.w_age_mean) || 50;    
    
// 3. Get chord based on dominant street type - only if street network is enabled
let baseChord;
if (audioMetrics.streetNetwork) {
  const dominantStreetType = getDominantStreetType(properties);
  baseChord = this.streetChordDesigns[dominantStreetType] || ["C4", "E4", "G4"];
} else {
  // Use a simple C4 chord if street network is disabled
  baseChord = ["C4", "C4", "C4", "C4"];
  console.log("Street Network disabled: Using simple C4 chord");
}
    
// 4. Apply building height adjustments to get chord and volume - only if building height is enabled
let chord, baseVolume;

if (audioMetrics.buildingHeight) {
  const heightAdjusted = getHeightAdjustedChord(baseChord, wHeight);
  chord = heightAdjusted.chord;
  baseVolume = heightAdjusted.volume;
  console.log(`Building height ${wHeight}m: Adjusted chord ${chord.join(", ")} at base volume ${baseVolume}`);
} else {
  // Use the original chord structure without any height-based adjustments
  chord = baseChord; // Keep the original chord when Building Height is off
  baseVolume = 0.8; // Fixed base volume of 0.8
  console.log("Building Height disabled: Using original chord structure with fixed base volume (0.8)");
}
    
// 6. Determine age class for rhythm pattern - only if building age is enabled
let patternIndex;
if (audioMetrics.buildingAge) {
  patternIndex = getPatternIndexFromAge(wAge);
  console.log(`Using age pattern index ${patternIndex} for w_age_mean = ${wAge}`);
} else {
  // Use a fixed medium speed (index 3 = 0.5s interval) if building age is disabled
  patternIndex = 3; // This corresponds to the 0.35s interval, closest to 0.5s
  console.log("Building Age disabled: Using fixed arpeggio speed (0.5s interval)");
}
    
    // 7. Get land use properties and map to instruments - only if land use is enabled
    const topLUs = getTopLandUses(properties);
    
    // If land use is disabled or no land uses found, play on melodic synth
    if (!audioMetrics.landUse || topLUs.length === 0) {
      // Play as arpeggio on melodic synth
      playArpeggio(this.synths.melodic, chord, patternIndex, undefined, baseVolume);
      return;
    }
    
    // 8. Base volume level (40% base + proportion)
    const now = Tone.now();

topLUs.forEach((lu, idx) => {
  // Get the primary (dominant) land use proportion
  const primaryProportion = topLUs[0].proportion; // First item is the largest
 
  // CORRECTED VOLUME FORMULA: Scale to make dominant land use = baseVolume
  const scaleFactor = baseVolume / primaryProportion;
  const instrumentVolume = lu.proportion * scaleFactor;
     
  // Get the appropriate instrument for this land use - use melodic if land use is disabled
  const instrument = audioMetrics.landUse ?
                  (this.landUseToInstrument[lu.type] || "piano") :
                  "melodic";
     
  console.log(`Playing ${instrument} arpeggio for ${lu.type}:`);
  console.log(`  - Land use proportion: ${lu.proportion}`);
  console.log(`  - Primary proportion: ${primaryProportion}`);
  console.log(`  - Base volume from height: ${baseVolume}`);
  console.log(`  - Scale factor: ${scaleFactor}`);
  console.log(`  - Final instrument volume: ${instrumentVolume}`);
  
  // Add a small delay for each instrument for a more layered effect
  const startTime = now + idx * 0.3;
  
  // Use the exact chord that was already adjusted properly by getHeightAdjustedChord
  // All instruments will respect the octave shift from height
  if (instrument === "melodic") {
    // Play on melodic synth
    playArpeggio(this.synths.melodic, chord, patternIndex, startTime, instrumentVolume);
  } else if (this.samplers[instrument] && typeof this.samplers[instrument].triggerAttackRelease === 'function') {
    // Play the chord as arpeggio using the configured instrument
    playArpeggio(this.samplers[instrument], chord, patternIndex, startTime, instrumentVolume);
  } else {
    // Fallback to melodic synth
    playArpeggio(this.synths.melodic, chord, patternIndex, startTime, instrumentVolume);
  }
});
  }
  }
