import Phaser from 'phaser'

// Game configuration optimized for word game performance
export const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 800,
  height: 600,
  backgroundColor: '#1a1a2e',
  
  // Responsive configuration
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 600,
    min: {
      width: 400,
      height: 300
    },
    max: {
      width: 1200,
      height: 900
    }
  },
  
  // Performance optimizations for word game
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
    transparent: false,
    powerPreference: 'default' // Balanced performance
  },
  
  // Physics not needed for word game - disabled for performance
  physics: {
    default: false
  },
  
  // Scene configuration - scenes will be added by SceneManager
  scene: [],
  
  // Development features
  dom: {
    createContainer: true
  },
  
  // Audio configuration
  audio: {
    disableWebAudio: false,
    context: false
  },
  
  // Input configuration
  input: {
    keyboard: true,
    mouse: true,
    touch: true,
    gamepad: false // Not needed for word game
  },
  
  // Banner configuration
  banner: {
    hidePhaser: __DEV__ ? false : true,
    text: '#16537e',
    background: ['#ffffff', '#71c5cf', '#ffffff', '#71c5cf']
  }
}

// Development-specific configuration overrides
if (__DEV__) {
  // Enable debug features in development
  gameConfig.render.antialias = true
  gameConfig.banner.hidePhaser = false
  
  // Add development plugins if needed
  gameConfig.plugins = {
    global: [
      // Add any development plugins here
    ]
  }
}

export default gameConfig