// Import SonificationEngine from sonification.js
import { SonificationEngine } from './sonification.js';


const Tone = window.Tone;

// Import utilities from sonificationUtils
import {
  getVolumeFromHeight,
  getPatternIndexFromAge, 
  getDominantStreetType,
  getChordFromStreetType,
  getTopLandUses,
  LAND_USE_PROPERTY_MAP,
  playHoverBipSound,
  playArpeggio
} from "./sonificationUtils.js";

// Special task blocks that should be highlighted
const VISUAL_TASK_BLOCKS = ['TB19', 'TD17', 'KK23'];
const AUDIO_TASK_BLOCKS = ['RA01', 'TC14', 'TA16'];
const AUDIO_VISUAL_TASK_BLOCKS = ['JB10', 'HB14'];

class MapSoundConnector {
  constructor(map, sonificationEngine) {
    this.map = map;
    this.sonificationEngine = sonificationEngine;
    this.soundEnabled = true;
    this.visualEnabled = true; 
    this.lastPlayedFeature = null;
    this.lastPlayTime = 0;
    this.hoverDebounceTime = 200;
    this.hoverTimeout = null;
    this.identifyClusters = false;  
    this.tooltipFeature = null;
    this.lastHoveredBlockId = null;
    this.currentBlockCode = null; 
    this.lastSoundedClusterBlockId = null;  
    this.highlightedBlock = null; 
    this.highlightLayer = null; 
    this.visualTaskBlocksEnabled = false;
    this.audioTaskBlocksEnabled = false;
    this.audioVisualTaskBlocksEnabled = false;
    this.soundIndicator = document.querySelector('.sound-indicator');
    this.soundNameElement = document.getElementById('sound-name');

    this.lastHighlighted = null;
    
    this.layerDescriptions = {
      'clusters': "Urban Cluster",
      'city-blocks': "City Blocks",
      'building-height': "Building Height",
      'building-age': "Building Age",
      'landuse': "Land Use Pattern",
      'street': "Street Network",
      'amsterdam-boundary': "City Boundary"
    };
    
    this.throttledMouseMove = this.throttle(this.handleMouseMove.bind(this), 200);
    
    // Land use base colors
    this.landUseBaseColors = {
      'Agricultural': '#A8D08D',
      'Business & Industry': '#1F4E79',
      'Center & Mixed-Use': '#FFB84D',
      'Culture, Recreation & Sports': '#A4C9E1',
      'Retail & Services': '#F1A7C3',
      'Hospitality & Office': '#D9A0D1',
      'Social & Community': '#D3A76D',
      'Nature & Green Spaces': '#4C9F70',
      'Residential': '#FFEC8B',
      'Water Bodies': '#4A90E2',
    };
    
    // Street definitions
    this.streetDefs = [
      { key: 't12', shape: 'rect', stroke: 2 },
      { key: 't22', shape: 'circle', dotPosition: 'top' },
      { key: 't23', shape: 'circle', dotPosition: 'right' },
      { key: 't24', shape: 'circle', dotPosition: 'bottom' },
      { key: 't25', shape: 'circle', dotPosition: 'left' },
      { key: 't31', shape: 'para', stroke: 2 },
      { key: 't41', shape: 'tri', orientation: 'up' },
      { key: 't42', shape: 'tri', orientation: 'down' }
    ];
    
    // Building height classes for tooltip drawing 
    this.heightClasses = [
      { min: 0, max: 6, size: 16.5 },
      { min: 6, max: 15, size: 31 },
      { min: 15, max: 27, size: 46 },
      { min: 27, max: 50, size: 62 },
      { min: 50, max: 9999, size: 78 }
    ];
    // Building age classes for tooltip transparency 
    this.ageClasses = [
      { min: 0, max: 25, alpha: 0.28 },
      { min: 25, max: 65, alpha: 0.46 },
      { min: 65, max: 135, alpha: 0.64 },
      { min: 135, max: 190, alpha: 0.82 },
      { min: 190, max: 9999, alpha: 1.00 }
    ];

    // visual metric toggles properties
  this.visualMetrics = {
    buildingAge: true,
    buildingHeight: true,
    landUse: true,
    streetNetwork: true
  };
  this.audioMetrics = {
    buildingAge: true,
    buildingHeight: true,
    landUse: true,
    streetNetwork: true
  };

  }

initialize() {
  console.log("Initializing Map-Sound Connector");
  this.setupEventListeners();
  this.setupVisualMetricListeners();
  this.setupHighlightLayer();
  this.setupTaskBlockLayers(); 
  this.sonificationEngine.initialize().catch(err => {
    console.error("Failed to initialize sonification engine:", err);
  });
  return this;
}

  setupHighlightLayer() {
    if (!this.map || !this.map.isStyleLoaded()) {
      setTimeout(() => this.setupHighlightLayer(), 500);
      return;
    }
  
    if (!this.map.getSource('highlight-source')) {
      this.map.addSource('highlight-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
  
      this.map.addLayer({
        id: 'block-highlight',
        type: 'line',
        source: 'highlight-source',
        paint: {
          'line-color': '#454545', 
          'line-width': 3, 
          'line-opacity': 0.9
        }
      });
  
      this.highlightLayer = 'block-highlight';
      console.log("Created highlight layer for hover effect");
    }
  }
  
setupEventListeners() {
  if (this.map) {
    this.map.on('mousemove', this.throttledMouseMove);
    this.map.on('moveend', () => {
        if (this.soundEnabled) {
          this.updateSoundscapeForVisibleFeatures();
        }
      });
  
      // trigger full sonification on clicked block
      this.map.on('click', (e) => {
        if (!this.map.isStyleLoaded()) return;
        const features = this.map.queryRenderedFeatures(e.point);
        if (!features || !features.length) {
          this.hideTooltip();
          return;
        }

          const layerIds = ['clusters', 'city-blocks', 'building-height', 'building-height-block', 'building-age', 'building-age-block', 'landuse', 'landuse-block', 'street', 'street-block', 'amsterdam-boundary'];
        for (const feat of features) {
          if (!feat.layer) continue;
          const layerId = feat.layer.id;
              console.log(`Clicked layer: ${layerId}`);
          if (layerIds.includes(layerId) && this.map.getLayoutProperty(layerId, 'visibility') === 'visible') {
            let blockId;
            if (feat.properties && feat.properties.code) {
              blockId = `${layerId}-${feat.properties.code}`;
            } else {
              blockId = `${layerId}-${feat.id}`;
            }
      
            this.currentBlockId = blockId;
            
            if (this.soundEnabled) {
  if (layerId === 'clusters' || 
      (layerId === 'city-blocks' && 
       document.getElementById('identify-clusters-checkbox')?.checked)) {
    if (feat.properties && feat.properties.Cluster !== undefined) {
      this.sonificationEngine.sonifyClustersChords(feat.properties, true);
    } else {
      this.sonificationEngine.sonifyFeature(layerId, feat);
    }
  } else {
    this.sonificationEngine.sonifyFeature(layerId, feat);
  }
  this.showSoundIndicator(layerId);
}
            
            if (this.visualEnabled && layerId === 'city-blocks') {
              this.showClusterSymbol(e, feat.properties, feat);
            }
            
            this.highlightLegendItem(layerId, feat.properties);
            break;
          }
        }
      });
    }
    const visualTaskBlocksCheckbox = document.getElementById('visual-task-blocks');
  const audioTaskBlocksCheckbox = document.getElementById('audio-task-blocks');
  const audioVisualTaskBlocksCheckbox = document.getElementById('audio-visual-task-blocks');

  if (visualTaskBlocksCheckbox) {
    visualTaskBlocksCheckbox.addEventListener('change', (e) => {
      this.visualTaskBlocksEnabled = e.target.checked;
      console.log("Visual Task Blocks:", this.visualTaskBlocksEnabled);
      this.updateTaskBlockHighlights();
    });
  }

  if (audioTaskBlocksCheckbox) {
    audioTaskBlocksCheckbox.addEventListener('change', (e) => {
      this.audioTaskBlocksEnabled = e.target.checked;
      console.log("Audio Task Blocks:", this.audioTaskBlocksEnabled);
      this.updateTaskBlockHighlights();
    });
  }

  if (audioVisualTaskBlocksCheckbox) {
    audioVisualTaskBlocksCheckbox.addEventListener('change', (e) => {
      this.audioVisualTaskBlocksEnabled = e.target.checked;
      console.log("Audio-Visual Task Blocks:", this.audioVisualTaskBlocksEnabled);
      this.updateTaskBlockHighlights();
    });
  }
  
  const cityBlocksRadio = document.getElementById('city-blocks-toggle');
  if (cityBlocksRadio) {
    cityBlocksRadio.addEventListener('change', () => {
      if (cityBlocksRadio.checked) {
        this.updateTaskBlockHighlights();
      }
    });
  }
    
    // Audio checkboxes event listeners
  
const audioBuildingAge = document.getElementById('audio-building-age');
const audioBuildingHeight = document.getElementById('audio-building-height');
const audioLandUse = document.getElementById('audio-land-use');
const audioStreetNetwork = document.getElementById('audio-street-network');

if (audioBuildingAge) {
  audioBuildingAge.addEventListener('change', (e) => {
    this.audioMetrics.buildingAge = e.target.checked;
    console.log("Audio Building Age:", this.audioMetrics.buildingAge);
  });
}

if (audioBuildingHeight) {
  audioBuildingHeight.addEventListener('change', (e) => {
    this.audioMetrics.buildingHeight = e.target.checked;
    console.log("Audio Building Height:", this.audioMetrics.buildingHeight);
  });
}

if (audioLandUse) {
  audioLandUse.addEventListener('change', (e) => {
    this.audioMetrics.landUse = e.target.checked;
    console.log("Audio Land Use:", this.audioMetrics.landUse);
  });
}

if (audioStreetNetwork) {
  audioStreetNetwork.addEventListener('change', (e) => {
    this.audioMetrics.streetNetwork = e.target.checked;
    console.log("Audio Street Network:", this.audioMetrics.streetNetwork);
  });
}

// Identify Clusters checkbox event listener
const identifyClustersCheckbox = document.getElementById('identify-clusters-checkbox');
if (identifyClustersCheckbox) {
  identifyClustersCheckbox.addEventListener('change', (e) => {
    this.identifyClusters = e.target.checked;
    console.log("Identify Clusters:", this.identifyClusters);
  });
}

    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
      soundToggle.addEventListener('change', e => {
        this.toggleSound(e.target.checked);
      });
      this.toggleSound(soundToggle.checked);
    }
  
    // Toggle Visual checkbox for entire map
    const visualCheckbox = document.getElementById('visual-checkbox');
    if (visualCheckbox) {
      visualCheckbox.addEventListener('change', e => {
        this.toggleVisual(e.target.checked);
      });
      this.toggleVisual(visualCheckbox.checked);
    }
    
  this.map.on('mouseleave', 'amsterdam-boundary', () => {
    this.sonificationEngine.boundaryTriggered = false;
    console.log("Exited Amsterdam boundary; boundaryTriggered reset");
  });

  this.map.on('mouseleave', 'landuse', () => {
    this.sonificationEngine.lastLandUseRowId = null;
    console.log("Exited landuse layer; lastLandUseRowId reset");
  });

  this.map.on('mouseleave', 'street', () => {
    this.sonificationEngine.lastStreetRowId = null;
    console.log("Exited street layer; lastStreetRowId reset");
  });
  this.map.on('mouseleave', 'clusters', () => {
  setTimeout(() => {
    const features = this.map.queryRenderedFeatures(
      { layers: ['clusters'] }
    );
    if (features.length === 0) {
      this.lastSoundedClusterBlockId = null;
      console.log("Reset cluster block sound trigger - left layer completely");
    }
  }, 50);
});

this.map.on('mouseleave', 'city-blocks', () => {
  setTimeout(() => {
    const features = this.map.queryRenderedFeatures(
      { layers: ['city-blocks'] }
    );
    if (features.length === 0) {
      this.lastSoundedClusterBlockId = null;
      this.lastHoveredBlockId = null;
      console.log("Reset block sound triggers - left layer completely");
    }
  }, 50);
});
  }


setupVisualMetricListeners() {
  const visualBuildingAge = document.getElementById('visual-building-age');
  const visualBuildingHeight = document.getElementById('visual-building-height');
  const visualLandUse = document.getElementById('visual-land-use');
  const visualStreetNetwork = document.getElementById('visual-street-network');
  
  if (visualBuildingAge) {
    visualBuildingAge.addEventListener('change', (e) => {
      this.visualMetrics.buildingAge = e.target.checked;
      console.log("Visual Building Age:", this.visualMetrics.buildingAge);
      this.updateActiveTooltips();
    });
  }
  
  if (visualBuildingHeight) {
    visualBuildingHeight.addEventListener('change', (e) => {
      this.visualMetrics.buildingHeight = e.target.checked;
      console.log("Visual Building Height:", this.visualMetrics.buildingHeight);
      this.updateActiveTooltips();
    });
  }
  
  if (visualLandUse) {
    visualLandUse.addEventListener('change', (e) => {
      this.visualMetrics.landUse = e.target.checked;
      console.log("Visual Land Use:", this.visualMetrics.landUse);
      this.updateActiveTooltips();
    });
  }
  
  if (visualStreetNetwork) {
    visualStreetNetwork.addEventListener('change', (e) => {
      this.visualMetrics.streetNetwork = e.target.checked;
      console.log("Visual Street Network:", this.visualMetrics.streetNetwork);
      
      const tooltip = document.getElementById('map-tooltip');
      if (tooltip && this.tooltipFeature && 
          this.tooltipFeature.properties && 
          this.tooltipFeature.properties.code === 'HK29') {
        
        tooltip.style.width = e.target.checked ? '105px' : '80px';
        console.log(`Updated HK29 tooltip width to ${e.target.checked ? '105px' : '80px'}`);
        
        this.updateTooltipPosition();
      }
      
      this.updateActiveTooltips();
    });
  }
}
  
  highlightBlock(feature) {
    if (!this.map || !feature || !feature.geometry) return;
    
    this.map.getSource('highlight-source').setData({
      type: 'Feature',
      geometry: feature.geometry,
      properties: {}
    });
    
    this.highlightedBlock = feature.id;
    
    const identifyClustersCheckbox = document.getElementById('identify-clusters-checkbox');
    if (identifyClustersCheckbox && identifyClustersCheckbox.checked && feature.properties) {
      const cluster = feature.properties.Cluster;
      if (cluster !== undefined) {
        const colors = {
          '0': '#1f77b4',
          '1': '#9cba7f',
          '2': '#e2c572',
          '3': '#f28e2c',
          '4': '#b276c8',
          '5': '#d62728'
        };
        const color = colors[cluster] || '#808080'; 
        if (!this.map.getLayer('cluster-highlight-fill')) {
          this.map.addLayer({
            id: 'cluster-highlight-fill',
            type: 'fill',
            source: 'highlight-source',
            paint: {
              'fill-color': color,
              'fill-opacity': 1.0 
            }
          });
        } else {
          this.map.setPaintProperty('cluster-highlight-fill', 'fill-color', color);
          this.map.setPaintProperty('cluster-highlight-fill', 'fill-opacity', 1.0);
        }
      }
    }
  }
  
  clearBlockHighlight() {
    if (!this.map) return;
    
    this.map.getSource('highlight-source').setData({
      type: 'FeatureCollection',
      features: []
    });
    
    if (this.map.getLayer('cluster-highlight-fill')) {
      this.map.removeLayer('cluster-highlight-fill');
    }
    
    this.highlightedBlock = null;
  }
  
  toggleVisual(enabled) {
    this.visualEnabled = enabled;
    if (!enabled) {
      this.hideTooltip(); 
    }
    console.log(`Visual symbols ${enabled ? 'enabled' : 'disabled'}`);
  }  
  
handleMouseMove(e) {
  if (!this.map || !this.map.loaded()) return;
  const now = Date.now();
  if (now - this.lastPlayTime < this.hoverDebounceTime) return;

  clearTimeout(this.hoverTimeout);
  this.hoverTimeout = setTimeout(() => {
    try {
      if (!this.map.isStyleLoaded()) return;
      
      const boundaryFeatures = this.map.queryRenderedFeatures(
        [
          [e.point.x - 5, e.point.y - 5], 
          [e.point.x + 5, e.point.y + 5]  
        ], 
        { layers: ['amsterdam-boundary'] }
      );
      
      const isOverBoundary = boundaryFeatures.length > 0;
      
      const audioCheckbox = document.getElementById('audio-checkbox');
      const isAudioEnabled = audioCheckbox ? audioCheckbox.checked : true;

      if (isOverBoundary && !this.sonificationEngine.boundaryTriggered && 
          this.soundEnabled && isAudioEnabled) {
        this.sonificationEngine.sonifyBoundary({});
        this.showSoundIndicator('amsterdam-boundary');
      }
        const features = this.map.queryRenderedFeatures(e.point);
      if (!features || !features.length) {
        this.currentBlockId = null;
        this.clearBlockHighlight(); 
        return;
      }
        const layerIds = ['clusters', 'city-blocks', 'building-height', 'building-height-block', 'building-age', 'building-age-block', 'landuse', 'landuse-block', 'street', 'street-block', 'amsterdam-boundary'];
        let foundFeature = false;
  
        for (const feat of features) {
          if (!feat.layer) continue;
          const layerId = feat.layer.id;
  
          if (layerIds.includes(layerId) && this.map.getLayoutProperty(layerId, 'visibility') === 'visible') {
            let blockId;
            if (feat.properties && feat.properties.code) {
              blockId = `${layerId}-${feat.properties.code}`;
            } else {
              blockId = `${layerId}-${feat.id}`;
            }
  
// Play hover sound for city-blocks 
if (this.soundEnabled) {
  const audioCheckbox = document.getElementById('audio-checkbox');
  
  if (audioCheckbox && audioCheckbox.checked) {
    if (layerId === 'clusters') {
  const blockCode = feat.properties.code || `${feat.id}`;
  
  if (blockCode && blockCode !== this.lastSoundedClusterBlockId) {
    if (feat.properties.Cluster !== undefined) {
      this.sonificationEngine.sonifyClustersChords(feat.properties, true);
      this.lastSoundedClusterBlockId = blockCode;
      console.log(`Playing cluster sound for block: ${blockCode}`);
    }
  }
}

// For block explorer with identify clusters enabled
else if (layerId === 'city-blocks') {
  const identifyClustersCheckbox = document.getElementById('identify-clusters-checkbox');
  
  const blockCode = feat.properties.code || `${feat.id}`;
  
  if (identifyClustersCheckbox && identifyClustersCheckbox.checked) {
    if (blockCode && blockCode !== this.lastSoundedClusterBlockId) {
      if (feat.properties.Cluster !== undefined) {
        this.sonificationEngine.sonifyClustersChords(feat.properties, true);
        this.lastSoundedClusterBlockId = blockCode;
        console.log(`Playing cluster sound for block: ${blockCode}`);
      }
    }
  } else if (blockId !== this.lastHoveredBlockId) {
    playHoverBipSound();
    this.lastHoveredBlockId = blockId;
  }
}
  }
}
  
            if (this.visualEnabled && layerId === 'city-blocks') {
              this.highlightBlock(feat);
            } else {
              this.clearBlockHighlight();
            }
  
            this.currentBlockId = blockId;
            this.highlightLegendItem(layerId, feat.properties);
            foundFeature = true;
            break;
          }
        }
  
        if (!foundFeature) {
          this.currentBlockId = null;
          this.clearBlockHighlight();
        }
      } catch (err) {
        console.error("Error in handleMouseMove:", err);
      }
    }, 50);
  } 
  
showClusterSymbol(e, props, feature) {
  this.tooltipFeature = feature;

  let tooltip = document.getElementById('map-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'map-tooltip';
    tooltip.className = 'map-tooltip';
    document.body.appendChild(tooltip);
  } 
  
  const isHK29 = props && props.code === 'HK29';
  const visualStreetNetworkEnabled = document.getElementById('visual-street-network') && 
                                    document.getElementById('visual-street-network').checked;
  
  if (isHK29 && visualStreetNetworkEnabled) {
    tooltip.style.width = '115px'; 
  } else {
    tooltip.style.width = '90px';  
  }
  
  // Standard tooltip size for all blocks
  tooltip.style.height = '90px';
  tooltip.style.height = '90px';


  
  tooltip.style.left = e.point.x + 'px';
  tooltip.style.top = e.point.y + 'px';
  tooltip.style.display = 'block';
  tooltip.style.opacity = '1';
  tooltip.style.transition = '';
  tooltip.innerHTML = '';
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'map-tooltip-svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  tooltip.appendChild(svg);
  
  const onlyStreetNetworkEnabled = 
    this.visualMetrics.streetNetwork && 
    !this.visualMetrics.buildingAge && 
    !this.visualMetrics.buildingHeight && 
    !this.visualMetrics.landUse;
  
  console.log(`Only street network enabled: ${onlyStreetNetworkEnabled}`);
  
  const wHeight = parseFloat(props.w_height_mean) || 0;
  
  const shapeSize = this.visualMetrics.buildingHeight ? this.getHeightSize(wHeight) : 48;
  
  const wAge = parseFloat(props.w_age_mean) || 0;
  
  const alpha = this.visualMetrics.buildingAge ? this.getAgeAlpha(wAge) : 1.0;
  
  // Get land use properties for coloring
  const landUseProps = [
    { name: 'Agricultural', val: parseFloat(props.prop_agriculture) || 0 },
    { name: 'Business & Industry', val: parseFloat(props.prop_business) || 0 },
    { name: 'Center & Mixed-Use', val: parseFloat(props.prop_center) || 0 },
    { name: 'Culture, Recreation & Sports', val: parseFloat(props.prop_culture) || 0 },
    { name: 'Retail & Services', val: parseFloat(props.prop_retail) || 0 },
    { name: 'Hospitality & Office', val: parseFloat(props.prop_hospitality) || 0 },
    { name: 'Social & Community', val: parseFloat(props.prop_social) || 0 },
    { name: 'Nature & Green Spaces', val: parseFloat(props.prop_nature) || 0 },
    { name: 'Residential', val: parseFloat(props.prop_residential) || 0 },
    { name: 'Water Bodies', val: parseFloat(props.prop_water) || 0 }
  ];
  
  // If land use checkbox is off, use a single grey color
  if (!this.visualMetrics.landUse) {
    landUseProps.length = 0; // Clear the array
    landUseProps.push({ name: 'Others', val: 1 }); 
  }
  
  let totalLU = 0;
  landUseProps.forEach(l => { totalLU += l.val; });
  if (totalLU < 0.001) {
    landUseProps.push({ name: 'Others', val: 1 });
    totalLU = 1;
  }
  
  // CONSISTENT stroke width for all shapes
  const CONSISTENT_STROKE_WIDTH = 1.5;
  
  let bestStreet = { key: 't12', shape: 'rect', stroke: CONSISTENT_STROKE_WIDTH, val: 0 };
  
  if (this.visualMetrics.streetNetwork) {
    for (let st of this.streetDefs) {
      const val = parseFloat(props[st.key]) || 0;
      if (val > bestStreet.val) {
        bestStreet = { 
          ...st, 
          val, 
          stroke: CONSISTENT_STROKE_WIDTH 
        };
      }
    }
  }
  
  const shapeOffset = (100 - shapeSize) / 2;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(g);
  
  if (!this.visualMetrics.streetNetwork) {
    // For street network off: always use circle without border or dot
    this.drawCircleSlices(g, shapeOffset, shapeSize, landUseProps, totalLU, alpha);
    // Don't draw the outline or dot
  } else if (onlyStreetNetworkEnabled) {
    // When ONLY street network is enabled, draw ONLY the outline 
    switch (bestStreet.shape) {
      case 'rect':
        this.drawRectOutline(g, shapeOffset, shapeSize, CONSISTENT_STROKE_WIDTH);
        break;
      case 'para':
        this.drawParaOutline(g, shapeOffset, shapeSize, CONSISTENT_STROKE_WIDTH);
        break;
      case 'tri':
        this.drawEquilateralOutline(g, shapeOffset, shapeSize, bestStreet.orientation || 'up', CONSISTENT_STROKE_WIDTH);
        break;
      default: 
        this.drawCircleOutline(g, shapeOffset, shapeSize, bestStreet.dotPosition || 'top', CONSISTENT_STROKE_WIDTH);
        break;
    }
  } else {
    switch (bestStreet.shape) {
      case 'rect':
        this.drawRectSlices(g, shapeOffset, shapeSize, landUseProps, totalLU, alpha);
        this.drawRectOutline(g, shapeOffset, shapeSize, CONSISTENT_STROKE_WIDTH);
        break;
      case 'para':
        this.drawParaSlices(g, shapeOffset, shapeSize, landUseProps, totalLU, alpha);
        this.drawParaOutline(g, shapeOffset, shapeSize, CONSISTENT_STROKE_WIDTH);
        break;
      case 'tri':
        this.drawEquilateralSlices(g, shapeOffset, shapeSize, landUseProps, totalLU, alpha, bestStreet.orientation || 'up');
        this.drawEquilateralOutline(g, shapeOffset, shapeSize, bestStreet.orientation || 'up', CONSISTENT_STROKE_WIDTH);
        break;
      default:
        this.drawCircleSlices(g, shapeOffset, shapeSize, landUseProps, totalLU, alpha);
        this.drawCircleOutline(g, shapeOffset, shapeSize, bestStreet.dotPosition || 'top', CONSISTENT_STROKE_WIDTH);
        break;
    }
     // fade-out animation for the tooltip
  const tooltip = document.getElementById('map-tooltip');
  if (tooltip) {
    if (tooltip.fadeTimeout) {
      clearTimeout(tooltip.fadeTimeout);
    }

    tooltip.fadeTimeout = setTimeout(() => {
      tooltip.style.transition = 'opacity 0.8s ease-out';
      tooltip.style.opacity = '0';
      
      setTimeout(() => {
        tooltip.style.display = 'none';
        tooltip.style.opacity = '1';
        tooltip.style.transition = '';
      }, 800); 
    }, 3500);
  }
    // event listener to update width when checkbox state changes
  const visualStreetNetworkCheckbox = document.getElementById('visual-street-network');
  if (visualStreetNetworkCheckbox && isHK29) {
    visualStreetNetworkCheckbox.removeEventListener('change', this._updateHK29Width);
    
    this._updateHK29Width = () => {
      const tooltip = document.getElementById('map-tooltip');
      if (tooltip && isHK29) {
        tooltip.style.width = visualStreetNetworkCheckbox.checked ? '105px' : '80px';
      }
    };
    
    visualStreetNetworkCheckbox.addEventListener('change', this._updateHK29Width);
  }
  this.map.on('move', this.updateTooltipPosition.bind(this));
  }
}
  
  drawRectSlices(g, offset, size, landUseProps, total, alpha) {
    let xPos = offset;
    for (let lu of landUseProps) {
      if (lu.val <= 0) continue;
      const frac = lu.val / total;
      const w = size * frac;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', xPos.toFixed(2));
      rect.setAttribute('y', offset.toFixed(2));
      rect.setAttribute('width', w.toFixed(2));
      rect.setAttribute('height', size.toFixed(2));
      const baseColor = this.landUseBaseColors[lu.name] || '#B0B0B0';
      rect.setAttribute('fill', this.applyAlpha(baseColor, alpha));
      g.appendChild(rect);
      xPos += w;
    }
  }
drawRectOutline(g, offset, size, strokeW = 1.5) {
  const outline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  outline.setAttribute('x', offset - strokeW/2);
  outline.setAttribute('y', offset - strokeW/2);
  outline.setAttribute('width', size + strokeW);
  outline.setAttribute('height', size + strokeW);
  outline.setAttribute('fill', 'none');
  outline.setAttribute('stroke', '#000');
  outline.setAttribute('stroke-width', strokeW);
  outline.setAttribute('paint-order', 'stroke');
  outline.setAttribute('stroke-alignment', 'outer');
  g.appendChild(outline);
}
drawParaSlices(g, offset, size, landUseProps, total, alpha) {
  this._lastParaGeometry = {
    deltaX: size / 2,
    deltaY: size,
    centerX: 50,
    centerY: 50,
    halfWidth: size / 2,
    halfHeight: size / 2,
    horizontalShift: size / 4,
    size: size
  };
  
  const geo = this._lastParaGeometry;
  
  const left = geo.centerX - geo.halfWidth + geo.horizontalShift;
  const top = geo.centerY - geo.halfHeight;
  
  let xFracStart = 0;
  
  for (let lu of landUseProps) {
    if (lu.val <= 0) continue;
    const frac = lu.val / total;
    const xFracEnd = xFracStart + frac;
    
    const x1 = left + (xFracStart * size);
    const x2 = left + (xFracEnd * size);
    
    const x1Bottom = x1 - geo.deltaX;
    const x2Bottom = x2 - geo.deltaX;
    
const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
const baseColor = this.landUseBaseColors[lu.name] || '#B0B0B0';
path.setAttribute('fill', this.applyAlpha(baseColor, alpha));
path.setAttribute('d', `
  M ${x1.toFixed(2)} ${top.toFixed(2)}
  L ${x2.toFixed(2)} ${top.toFixed(2)}
  L ${x2Bottom.toFixed(2)} ${(top + size).toFixed(2)}
  L ${x1Bottom.toFixed(2)} ${(top + size).toFixed(2)}
  Z
`);
    g.appendChild(path);
    xFracStart = xFracEnd;
  }
}

drawParaOutline(g, offset, size, strokeW = 1.5) {
  const geo = this._lastParaGeometry || {
    deltaX: size / 2,
    deltaY: size,
    centerX: 50,
    centerY: 50,
    halfWidth: size / 2,
    halfHeight: size / 2,
    horizontalShift: size / 4,
    size: size
  };
  
  const scaleFactor = 1.02;  
  
  const scaleFromCenter = (point, scale) => {
    return {
      x: geo.centerX + (point.x - geo.centerX) * scale,
      y: geo.centerY + (point.y - geo.centerY) * scale
    };
  };
  
  const originalPoints = [
    { 
      x: geo.centerX - geo.halfWidth + geo.horizontalShift,
      y: geo.centerY - geo.halfHeight
    },
    {  
      x: geo.centerX + geo.halfWidth + geo.horizontalShift,
      y: geo.centerY - geo.halfHeight
    },
    { 
      x: geo.centerX + geo.halfWidth - geo.deltaX + geo.horizontalShift,
      y: geo.centerY + geo.halfHeight
    },
    {  
      x: geo.centerX - geo.halfWidth - geo.deltaX + geo.horizontalShift,
      y: geo.centerY + geo.halfHeight
    }
  ];
  
  const scaledPoints = originalPoints.map(p => scaleFromCenter(p, scaleFactor));
  
  const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  outline.setAttribute('fill', 'none');
  outline.setAttribute('stroke', '#000');
  outline.setAttribute('stroke-width', strokeW);
  outline.setAttribute('d', `
    M ${scaledPoints[0].x.toFixed(2)} ${scaledPoints[0].y.toFixed(2)}
    L ${scaledPoints[1].x.toFixed(2)} ${scaledPoints[1].y.toFixed(2)}
    L ${scaledPoints[2].x.toFixed(2)} ${scaledPoints[2].y.toFixed(2)}
    L ${scaledPoints[3].x.toFixed(2)} ${scaledPoints[3].y.toFixed(2)}
    Z
  `);
  
  g.appendChild(outline);
}
drawEquilateralOutline(g, offset, size, orientation, strokeW = 1.5) {
  const height = size; 
  const triangleSide = height / (Math.sqrt(3) / 2); 
  
  const centerX = 50;
  

  if (orientation === 'down') {
    const topY = 50 - (height / 2);
    const bottomY = 50 + (height / 2);
    const leftX = centerX - (triangleSide / 2);
    const rightX = centerX + (triangleSide / 2);
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#000');
    path.setAttribute('stroke-width', strokeW);
    path.setAttribute('d', `
      M ${leftX} ${topY}
      L ${rightX} ${topY}
      L ${centerX} ${bottomY}
      Z
    `);
    g.appendChild(path);
  } else {
    const expandFactor = strokeW/2;
    const topY = 50 - (height / 2) - expandFactor;
    const bottomY = 50 + (height / 2) + expandFactor;
    const leftX = centerX - (triangleSide / 2) - expandFactor;
    const rightX = centerX + (triangleSide / 2) + expandFactor;
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#000');
    path.setAttribute('stroke-width', strokeW);
    path.setAttribute('paint-order', 'stroke');
    path.setAttribute('stroke-alignment', 'outer');
    path.setAttribute('d', `
      M ${leftX} ${bottomY}
      L ${rightX} ${bottomY}
      L ${centerX} ${topY}
      Z
    `);
    g.appendChild(path);
  }
}

drawEquilateralSlices(g, offset, size, landUseProps, total, alpha, orientation) {
  const height = size; 
  const triangleSide = height / (Math.sqrt(3) / 2); 
  
  const centerX = 50;
  
  landUseProps.sort((a, b) => b.val - a.val);
  
  let apex, baseY, leftX, rightX;
  
  if (orientation === 'down') {
    // Down-pointing triangle
    const topY = 50 - (height / 2);
    const bottomY = 50 + (height / 2);
    apex = {x: centerX, y: bottomY};
    baseY = topY;
    leftX = centerX - (triangleSide / 2);
    rightX = centerX + (triangleSide / 2);
  } else {
    // Up-pointing triangle
    const topY = 50 - (height / 2);
    const bottomY = 50 + (height / 2);
    apex = {x: centerX, y: topY};
    baseY = bottomY;
    leftX = centerX - (triangleSide / 2);
    rightX = centerX + (triangleSide / 2);
  }
  
  let cumulativeFrac = 0;
  
  for (let lu of landUseProps) {
    if (lu.val <= 0) continue;
    const frac = lu.val / total;
    

    const xStart = leftX + (cumulativeFrac * triangleSide);
    const xEnd = leftX + (cumulativeFrac + frac) * triangleSide;
    
    const baseColor = this.landUseBaseColors[lu.name] || '#B0B0B0';
    const fillColor = this.applyAlpha(baseColor, alpha);
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', fillColor);
    
    path.setAttribute('d', `
      M ${apex.x} ${apex.y}
      L ${xStart} ${baseY}
      L ${xEnd} ${baseY}
      Z
    `);
    
    g.appendChild(path);
    
    cumulativeFrac += frac;
  }
}
  drawCircleSlices(g, offset, size, landUseProps, total, alpha) {
    const cx = 50, cy = 50;
    const r = size / 2;
    const nonZero = landUseProps.filter(lu => lu.val > 0);
    if (nonZero.length === 1) {
      const baseColor = this.landUseBaseColors[nonZero[0].name] || '#B0B0B0';
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', r);
      circle.setAttribute('fill', this.applyAlpha(baseColor, alpha));
      g.appendChild(circle);
      return;
    }
    let angleStart = 0;
    for (let lu of landUseProps) {
      if (lu.val <= 0) continue;
      const frac = lu.val / total;
      const angleSpan = frac * 2 * Math.PI;
      const angleEnd = angleStart + angleSpan;
      const x1 = cx + r * Math.cos(angleStart);
      const y1 = cy + r * Math.sin(angleStart);
      const x2 = cx + r * Math.cos(angleEnd);
      const y2 = cy + r * Math.sin(angleEnd);
      const largeArc = (angleSpan > Math.PI) ? 1 : 0;
      const baseColor = this.landUseBaseColors[lu.name] || '#B0B0B0';
      const fillColor = this.applyAlpha(baseColor, alpha);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill', fillColor);
      const d = `
        M ${cx},${cy}
        L ${x1},${y1}
        A ${r},${r} 0 ${largeArc} 1 ${x2},${y2}
        Z
      `;
      path.setAttribute('d', d);
      g.appendChild(path);
      angleStart = angleEnd;
    }
  }
drawCircleOutline(g, offset, size, dotPosition, strokeW = 1.5) {
  const cx = 50, cy = 50;
  const r = size / 2;
  
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', cx);
  circle.setAttribute('cy', cy);
  circle.setAttribute('r', r + strokeW/2); 
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke', '#000');
  circle.setAttribute('stroke-width', strokeW);
  circle.setAttribute('paint-order', 'stroke');
  circle.setAttribute('stroke-alignment', 'outer');
  g.appendChild(circle);
    const dotR = r * 0.15; 
    const dotDistance = r * 0.85; 
    let dotX = cx, dotY = cy;
    
    switch(dotPosition) {
      case 'top':
        dotY = cy - dotDistance;
        break;
      case 'right':
        dotX = cx + dotDistance;
        break;
      case 'bottom':
        dotY = cy + dotDistance;
        break;
      case 'left':
        dotX = cx - dotDistance;
        break;
    }
    
    // Create the dot
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', dotX);
    dot.setAttribute('cy', dotY);
    dot.setAttribute('r', dotR);
    dot.setAttribute('fill', '#000');
    g.appendChild(dot);
  }
  
  getHeightSize(height) {
    for (let hc of this.heightClasses) {
      if (height >= hc.min && height < hc.max) {
        return hc.size;
      }
    }
    return 24;
  }
  
  getAgeAlpha(age) {
    for (let ac of this.ageClasses) {
      if (age >= ac.min && age < ac.max) {
        return ac.alpha;
      }
    }
    return 0.44;
  }
  
  applyAlpha(hexColor, alpha = 1) {
    let c = hexColor.replace('#', '');
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
  }
  
  hideTooltip() {
    const tip = document.getElementById('map-tooltip');
    if (tip) tip.style.display = 'none';
    
    this.tooltipFeature = null;
    this.map.off('move', this.updateTooltipPosition.bind(this));
  }
  
highlightLegendItem(layerType, props) {
  if (this.lastHighlighted) {
    this.lastHighlighted.classList.remove('legend-highlight');
    this.lastHighlighted = null;
  }
  let targetElement = null;
  
  if (layerType === 'clusters' || layerType === 'city-blocks') {
    if (props.Cluster !== undefined && props.Cluster !== null) {
      targetElement = document.querySelector('#legend .legend-item[data-cluster-value="' + props.Cluster + '"]');
    }
  } 
  // Building Height - both building and block layers
  else if (layerType === 'building-height' || layerType === 'building-height-block') {
    // Use different property based on layer type
    const heightProp = layerType === 'building-height-block' ? 'w_height_mean' : 'height';
    const hVal = parseFloat(props[heightProp]) || 0;
    
    const items = document.querySelectorAll('#legend .legend-item[data-min-val]');
    items.forEach(item => {
      const min = parseFloat(item.dataset.minVal);
      const max = parseFloat(item.dataset.maxVal);
      if (hVal >= min && hVal < max) {
        targetElement = item;
      }
    });
  } 
  // Building Age - both building and block layers
  else if (layerType === 'building-age' || layerType === 'building-age-block') {
    // Use different property based on layer type
    const ageProp = layerType === 'building-age-block' ? 'w_age_mean' : 'age';
    const ageVal = parseFloat(props[ageProp]) || 0;
    
    const items = document.querySelectorAll('#legend .legend-item[data-min-val]');
    items.forEach(item => {
      const min = parseFloat(item.dataset.minVal);
      const max = parseFloat(item.dataset.maxVal);
      if (ageVal >= min && ageVal < max) {
        targetElement = item;
      }
    });
  } 
  // Land Use - both parcel and block layers
  else if (layerType === 'landuse' || layerType === 'landuse-block') {
    const luClass = props.new_lu_class || 'Others';
    targetElement = document.querySelector('#legend .legend-item[data-lu-class="' + luClass + '"]');
  } 
  // Street Pattern - both network and block layers
  else if (layerType === 'street' || layerType === 'street-block') {
    let streetType = '';
    
    if (layerType === 'street') {
      // For network layer, use the Type property directly
      streetType = props.Type || '';
    } else {
      // For block layer, determine dominant street type
      const dominantKey = getDominantStreetType(props);
      // Convert key back to display format
      const keyToType = {
        't12': 'Type 1-2',
        't22': 'Type 2-2', 
        't23': 'Type 2-3',
        't24': 'Type 2-4',
        't31': 'Type 3-1',
        't41': 'Type 4-1',
        't42': 'Type 4-2'
      };
      streetType = keyToType[dominantKey] || 'Type 1-2';
    }
    
    targetElement = document.querySelector('#legend .legend-item[data-street-type="' + streetType + '"]');
  }
  
  if (targetElement) {
    targetElement.classList.add('legend-highlight');
    this.lastHighlighted = targetElement;
  }
}
setupLegendClickHandlers() {
  const legend = document.getElementById('legend');
  if (!legend) return;
  
  // Remove existing listeners to avoid duplicates
  legend.removeEventListener('click', this.handleLegendClick);
  
  // Add click listener to the legend container
  legend.addEventListener('click', this.handleLegendClick.bind(this));
}

// Replace your handleLegendClick method in map-sound-connector.js
handleLegendClick(event) {
  const legendItem = event.target.closest('.legend-item');
  if (!legendItem) return;
  
  // Get the currently active layer to determine what to play
  const activeLayer = document.querySelector('input[name="layer"]:checked')?.value;
  if (!activeLayer) return;
  
  console.log(`Legend item clicked for layer: ${activeLayer}`);
  
  // Handle different layer types
  if (activeLayer === 'clusters') {
    const clusterValue = legendItem.dataset.clusterValue;
    if (clusterValue !== undefined) {
      const mockProps = { Cluster: clusterValue };
      // Use the EXACT same method as map clicks
      this.sonificationEngine.sonifyClustersChords(mockProps, true);
      this.showSoundIndicator('clusters');
      console.log(`Playing cluster ${clusterValue} sound`);
    }
  }
  else if (activeLayer === 'building-height' || activeLayer === 'building-height-block') {
    const minVal = parseFloat(legendItem.dataset.minVal);
    const maxVal = parseFloat(legendItem.dataset.maxVal);
    if (!isNaN(minVal)) {
      const demoHeight = minVal + (maxVal - minVal) / 2;
      
      // Create mock properties and use the EXACT same sonification method as map clicks
      const mockProps = activeLayer === 'building-height-block' ? 
        { w_height_mean: demoHeight, code: 'demo-' + Math.random() } : 
        { height: demoHeight, id: 'demo-' + Math.random() };
      
      // RESET ID TRACKING to allow repeated clicks
      this.sonificationEngine.lastBuildingId = null;
      
      // Use the exact same sonification method as map clicks
      this.sonificationEngine.sonifyFeature(activeLayer, { properties: mockProps });
      this.showSoundIndicator(activeLayer);
      console.log(`Playing building height ${demoHeight}m sound using exact map sonification`);
    }
  }
  else if (activeLayer === 'building-age' || activeLayer === 'building-age-block') {
    const minVal = parseFloat(legendItem.dataset.minVal);
    const maxVal = parseFloat(legendItem.dataset.maxVal);
    if (!isNaN(minVal)) {
      let demoAge;
      if (maxVal === Infinity || minVal >= 190) {
        demoAge = 200;
      } else {
        demoAge = minVal + (maxVal - minVal) / 2;
      }
      
      // Create mock properties and use the EXACT same sonification method as map clicks
      const mockProps = activeLayer === 'building-age-block' ? 
        { w_age_mean: demoAge, code: 'demo-' + Math.random() } : 
        { age: demoAge, id: 'demo-' + Math.random() };
      
      // RESET ID TRACKING to allow repeated clicks
      this.sonificationEngine.lastBuildingId = null;
      
      // Use the exact same sonification method as map clicks
      this.sonificationEngine.sonifyFeature(activeLayer, { properties: mockProps });
      this.showSoundIndicator(activeLayer);
      console.log(`Playing building age ${demoAge} years sound using exact map sonification`);
    }
  }
  else if (activeLayer === 'landuse' || activeLayer === 'landuse-block') {
    const luClass = legendItem.dataset.luClass;
    if (luClass) {
      // Create mock properties and use the EXACT same sonification method as map clicks
      const mockProps = { new_lu_class: luClass, rowId: 'demo-' + Math.random() };
      
      // RESET ID TRACKING to allow repeated clicks
      this.sonificationEngine.lastLandUseRowId = null;
      
      // Use the exact same sonification method as map clicks
      this.sonificationEngine.sonifyFeature(activeLayer, { properties: mockProps });
      this.showSoundIndicator(activeLayer);
      console.log(`Playing land use ${luClass} sound using exact map sonification`);
    }
  }
  else if (activeLayer === 'street' || activeLayer === 'street-block') {
    const streetType = legendItem.dataset.streetType;
    if (streetType) {
      let mockProps;
      
      if (activeLayer === 'street') {
        // For street layer, use Type property
        mockProps = { Type: streetType, rowId: 'demo-' + Math.random() };
      } else {
        // For street-block layer, create properties with the dominant street type
        mockProps = { code: 'demo-' + Math.random() };
        
        // Set the street type properties to simulate dominance
        const streetKey = streetType.includes('1-2') ? 't12' :
                         streetType.includes('2-2') ? 't22' :
                         streetType.includes('2-3') ? 't23' :
                         streetType.includes('2-4') ? 't24' :
                         streetType.includes('3-1') ? 't31' :
                         streetType.includes('4-1') ? 't41' :
                         streetType.includes('4-2') ? 't42' : 't12';
        
        // Set the selected street type to 1.0 and others to 0
        ['t12', 't22', 't23', 't24', 't31', 't41', 't42'].forEach(key => {
          mockProps[key] = key === streetKey ? 1.0 : 0.0;
        });
      }
      
      // RESET ID TRACKING to allow repeated clicks
      this.sonificationEngine.lastStreetRowId = null;
      
      // Use the exact same sonification method as map clicks
      this.sonificationEngine.sonifyFeature(activeLayer, { properties: mockProps });
      this.showSoundIndicator(activeLayer);
      console.log(`Playing street pattern ${streetType} sound using exact map sonification`);
    }
  }
  
  // Add visual feedback
  legendItem.style.transform = 'scale(1.1)';
  setTimeout(() => {
    legendItem.style.transform = '';
  }, 200);
}

  updateTooltipPosition() {
    const tooltip = document.getElementById('map-tooltip');
    if (!tooltip || !this.tooltipFeature || tooltip.style.display === 'none') {
      return;
    }
    
    // Get the center point of the feature
    const center = this.getFeatureCenter(this.tooltipFeature);
    if (!center) return;
    
    // Convert the center point to screen coordinates
    const point = this.map.project(center);
    
    // Update tooltip position
    tooltip.style.left = point.x + 'px';
    tooltip.style.top = point.y + 'px';
  }
  
  getFeatureCenter(feature) {
    if (feature.geometry && feature.geometry.type === 'Polygon') {
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      
      // Use first ring of coordinates (outer ring)
      const coordinates = feature.geometry.coordinates[0];
      coordinates.forEach(coord => {
        sumX += coord[0];
        sumY += coord[1];
        count++;
      });
      
      if (count > 0) {
        return [sumX / count, sumY / count];
      }
    }
    
    return null;
  }


updateTaskBlockHighlights() {
  console.log("updateTaskBlockHighlights called");

  if (!this.map || !this.map.isStyleLoaded()) {
    console.log("Map style not loaded yet, will retry task block highlights update");
    setTimeout(() => this.updateTaskBlockHighlights(), 200);
    return;
  }

  if (!this.map.getLayer('city-blocks') || this.map.getLayoutProperty('city-blocks', 'visibility') !== 'visible') {
    console.log("City blocks layer not visible, skipping task block highlights");
    return;
  }
  

  if (!this.map.getLayer('visual-task-blocks-layer') || 
      !this.map.getLayer('audio-task-blocks-layer') || 
      !this.map.getLayer('audio-visual-task-blocks-layer')) {
    console.log("Task block layers not ready, setting up layers first");
    this.setupTaskBlockLayers();
    return;
  }
  
  console.log("Updating task block highlights with enabled states:", {
    visual: this.visualTaskBlocksEnabled,
    audio: this.audioTaskBlocksEnabled,
    audioVisual: this.audioVisualTaskBlocksEnabled
  });
  
  try {
    let visualBlocksFilter = ['any'];
    let audioBlocksFilter = ['any'];
    let audioVisualBlocksFilter = ['any'];
    
    if (this.visualTaskBlocksEnabled) {
      VISUAL_TASK_BLOCKS.forEach(blockCode => {
        visualBlocksFilter.push(['==', ['get', 'code'], blockCode]);
      });
      console.log("Visual task blocks filter:", JSON.stringify(visualBlocksFilter));
    }
    
    if (this.audioTaskBlocksEnabled) {
      AUDIO_TASK_BLOCKS.forEach(blockCode => {
        audioBlocksFilter.push(['==', ['get', 'code'], blockCode]);
      });
      console.log("Audio task blocks filter:", JSON.stringify(audioBlocksFilter));
    }
    
    if (this.audioVisualTaskBlocksEnabled) {
      AUDIO_VISUAL_TASK_BLOCKS.forEach(blockCode => {
        audioVisualBlocksFilter.push(['==', ['get', 'code'], blockCode]);
      });
      console.log("Audio-visual task blocks filter:", JSON.stringify(audioVisualBlocksFilter));
    }
    
    this.map.setFilter('visual-task-blocks-layer', visualBlocksFilter);
    this.map.setFilter('audio-task-blocks-layer', audioBlocksFilter);
    this.map.setFilter('audio-visual-task-blocks-layer', audioVisualBlocksFilter);
    
    console.log("Task block highlights updated successfully");
  } catch (error) {
    console.error("Error updating task block highlights:", error);
  }
}


setupTaskBlockLayers() {
  if (!this.map || !this.map.isStyleLoaded()) {
    console.log("Map style not loaded yet, will retry task block layers setup");
    setTimeout(() => this.setupTaskBlockLayers(), 200);
    return;
  }
  
  try {

    if (!this.map.getSource('clusters-source')) {
      console.warn("No clusters-source available for task blocks. Will retry later.");
      setTimeout(() => this.setupTaskBlockLayers(), 500);
      return;
    }
    

    if (!this.map.getLayer('visual-task-blocks-layer')) {      
      console.log("Adding visual-task-blocks-layer");
      
      this.map.addLayer({
        id: 'visual-task-blocks-layer',
        type: 'line',
        source: 'clusters-source', 
        paint: {
          'line-color': '#B22222', 
          'line-width': 1.5,
          'line-opacity': 1
        },
        filter: ['==', 'code', ''] 
      });
      console.log("Added visual-task-blocks-layer successfully");
    }
    
    if (!this.map.getLayer('audio-task-blocks-layer')) {
      console.log("Adding audio-task-blocks-layer");
      
      this.map.addLayer({
        id: 'audio-task-blocks-layer',
        type: 'line',
        source: 'clusters-source', 
        paint: {
          'line-color': '#B22222', 
          'line-width': 1.5,
          'line-opacity': 1
        },
        filter: ['==', 'code', '']
      });
      console.log("Added audio-task-blocks-layer successfully");
    }
    

    if (!this.map.getLayer('audio-visual-task-blocks-layer')) {
      console.log("Adding audio-visual-task-blocks-layer");
      
      this.map.addLayer({
        id: 'audio-visual-task-blocks-layer',
        type: 'line',
        source: 'clusters-source', 
        paint: {
          'line-color': '#B22222', 
          'line-width': 1.5,
          'line-opacity': 1
        },
        filter: ['==', 'code', ''] 
      });
      console.log("Added audio-visual-task-blocks-layer successfully");
    }
    
    console.log("Task block layers setup completed successfully");
  } catch (error) {
    console.error("Error setting up task block layers:", error);
  }
}

  updateSoundscapeForVisibleFeatures() {
    if (!this.soundEnabled || !this.map) return;
  }
  
  toggleSound(enabled) {
    this.soundEnabled = enabled;
    if (this.sonificationEngine) {
      this.sonificationEngine.setActive(enabled);
    }
    if (!enabled) {
      this.hideSoundIndicator();
      this.hideTooltip();
      if (this.sonificationEngine) {
        this.sonificationEngine.stopAllSounds();
      }
    }
    console.log(`Sound ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  showSoundIndicator(layerType) {
    if (!layerType || !this.soundIndicator) return;
    if (this.soundNameElement) {
      this.soundNameElement.textContent = this.layerDescriptions[layerType] || layerType;
    }
    this.soundIndicator.classList.add('active');
    setTimeout(() => {
      this.hideSoundIndicator();
    }, 1000);
  }
  
  hideSoundIndicator() {
    if (this.soundIndicator) {
      this.soundIndicator.classList.remove('active');
    }
  }
  
  throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function() {
      const context = this;
      const args = arguments;
      if (!lastRan) {
        func.apply(context, args);
        lastRan = Date.now();
      } else {
        clearTimeout(lastFunc);
        lastFunc = setTimeout(() => {
          if (Date.now() - lastRan >= limit) {
            func.apply(context, args);
            lastRan = Date.now();
          }
        }, limit - (Date.now() - lastRan));
      }
    };
  }
  
  stopAllSounds() {
    Object.values(this.synths).forEach(synth => {
      if (typeof synth.releaseAll === "function") {
        synth.releaseAll();
      } else if (typeof synth.triggerRelease === "function") {
        synth.triggerRelease();
      }
    });
  }
  
  // Sonification Methods 
  
sonifyFeature(layerId, feature) {
  if (!this.active || !this.initialized) return layerId;
  const props = feature.properties || {};
  
  switch (layerId) {
    case 'building-height':
      this.sonifyBuildingHeight(props);
      break;
    case 'building-height-block':
      this.sonifyBuildingHeightBlock(props);
      break;
    case 'building-age':
      this.sonifyBuildingAge(props);
      break;
    case 'building-age-block':
      this.sonifyBuildingAgeBlock(props);
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
  
  sonifyBuildingHeight(properties) {
    const height = properties.height || 10;
    const note = this.mappings['building-height'].heightToNote(height);
    const volume = this.mappings['building-height'].heightToVolume(height);
    const originalVolume = this.synths.fm.volume.value;
    this.synths.fm.volume.value = volume;
    this.synths.fm.triggerAttackRelease(note, "8n");
    setTimeout(() => {
      this.synths.fm.volume.value = originalVolume;
    }, 100);
  }
  
  sonifyBuildingAge(properties) {
    const age = properties.age || 50;
    const note = this.mappings['building-age'].ageToNote(age);
    const reverbLevel = this.mappings['building-age'].ageToReverb(age);
    this.effects.reverb.wet.value = reverbLevel;
    this.synths.melodic.triggerAttackRelease(note, "8n");
  }
  
  sonifyClustersChords(properties) {
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
    this.synths.melodic.triggerAttackRelease(chord, "2n");
  }
  
  sonifyLandUse(properties) {
    if (!this.active || !this.initialized) return;
    const luClass = properties.new_lu_class || 'Residential';
    console.log(`Sonifying land use: ${luClass}`);
    const instrument = this.landUseToInstrument[luClass] || 'piano';
    this.playSample(instrument, 'C4');
  }
  
  sonifyStreet(properties) {
    const streetType = properties.Type || 'Type 1-2';
    const length = properties.length || 10;
    const tempo = this.mappings.street.lengthToTempo(length);
    Tone.Transport.bpm.value = tempo;
    this.synths.membrane.triggerAttackRelease("C2", "16n");
  }
  
  sonifyBoundary(properties) {
    this.synths.melodic.triggerAttackRelease("C3", "8n");
    console.log("Sonifying Amsterdam boundary");
  }
  
  createAmbient(visibleFeatures) {
    if (!this.active || !this.initialized) return;
    const counts = {
      'building-height': 0,
      'building-age': 0,
      'clusters': 0,
      'city-blocks': 0,
      'landuse': 0,
      'street': 0
    };
    visibleFeatures.forEach(feature => {
      const layerId = feature.layer?.id;
      if (counts[layerId] !== undefined) { counts[layerId]++; }
    });
    const streetDensity = counts.street / 100;
    Tone.Transport.bpm.value = 60 + (streetDensity * 60);
  }
  
  getTempoFromHeight(height) {
    for (const hClass of this.heightClasses) {
      if (height >= hClass.min && height < hClass.max) {
        return hClass.tempo;
      }
    }
    return 90;
  }
  
  getPitchFromAge(age) {
    for (const aClass of this.ageClasses) {
      if (age >= aClass.min && age < aClass.max) {
        return aClass.pitch;
      }
    }
    return "C4";
  }
  
  getDominantStreetType(properties) {
    let dominantType = null;
    let maxValue = -1;
    for (const streetDef of this.streetDefs) {
      const key = streetDef.key;
      const value = parseFloat(properties[key]) || 0;
      if (value > maxValue) {
        maxValue = value;
        dominantType = key;
      }
    }
    return dominantType;
  }
  
  getTopLandUses(properties) {
    const landUses = [];
    for (const [propKey, luType] of Object.entries(this.landUsePropertyMap)) {
      const proportion = parseFloat(properties[propKey]) || 0;
      if (proportion > 0) {
        landUses.push({ type: luType, proportion });
      }
    }
    landUses.sort((a, b) => b.proportion - a.proportion);
    return landUses.slice(0, 3);
  }
  
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
        }
      }
    }
  }
  
  setActive(active) {
    this.active = active;
    if (active && !this.initialized) {
      this.initialize();
    }
    if (active) {
      this.sequencer.start(0);
    } else {
      this.sequencer.stop();
      this.stopAllSounds();
    }
  }
}

window.addEventListener('load', () => {
  if (window.mapboxgl && window.SonificationEngine) {
    if (window.map) {
      initConnector();
    } else {
      const mapCheck = setInterval(() => {
        if (window.map) {
          clearInterval(mapCheck);
          initConnector();
        }
      }, 500);
      setTimeout(() => {
        clearInterval(mapCheck);
        if (!window.mapSoundConnector && window.map) {
          initConnector();
        }
      }, 10000);
    }
  }
});

function initConnector() {
  try {
    const engine = new SonificationEngine();
    window.mapSoundConnector = new MapSoundConnector(window.map, engine).initialize();
  } catch (error) {
    console.error("Error initializing connector:", error);
  }
}

// Export the MapSoundConnector constructor
window.MapSoundConnector = MapSoundConnector;

// Define a connector initializer function that will be called from the HTML
export function initSoundConnector() {
  console.log("Initializing Map-Sound Connector...");
  if (window.map && SonificationEngine) {
    try {
      const engine = new SonificationEngine();
      window.mapSoundConnector = new MapSoundConnector(window.map, engine).initialize();
      console.log("Map-Sound Connector initialized successfully");
    } catch (error) {
      console.error("Error initializing connector:", error);
    }
  } else {
    console.warn("Map or SonificationEngine not available yet. Retrying in 500ms...");
    setTimeout(initSoundConnector, 500);
  }
}

window.initSoundConnector = initSoundConnector;