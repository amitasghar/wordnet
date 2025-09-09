# Technical Stack

## Application Framework
- **Framework:** Phaser.js 3.80+
- **Purpose:** 2D game development framework for HTML5 games

## Database System
- **Primary:** LocalStorage
- **Secondary:** IndexedDB (for complex game data)

## JavaScript Framework
- **Runtime:** Vanilla JavaScript (ES6+)
- **Module System:** ES6 Modules

## Import Strategy
- **Type:** importmaps
- **Reason:** Native browser support for clean module imports

## CSS Framework
- **Framework:** TailwindCSS 3.4+
- **Usage:** UI components outside game canvas

## UI Component Library
- **Library:** Custom components
- **Framework:** Native HTML5 + TailwindCSS

## Fonts Provider
- **Primary:** Google Fonts
- **Fallbacks:** System fonts

## Icon Library
- **Library:** Lucide Icons
- **Format:** SVG icons

## Application Hosting
- **Options:** Digital Ocean / Netlify / Vercel
- **Type:** Static hosting

## Database Hosting
- **Type:** Client-side storage only
- **Options:** LocalStorage + IndexedDB

## Asset Hosting
- **Location:** Same as application hosting
- **CDN:** Optional CloudFlare for performance

## Deployment Solution
- **Build Tool:** Vite
- **CI/CD:** GitHub Actions (recommended)
- **Process:** Automated build and deploy

## Code Repository URL
- **Platform:** GitHub
- **URL:** To be determined

## Additional Development Tools
- **Package Manager:** npm
- **Code Style:** 2-space indentation, snake_case variables, single quotes
- **Development Server:** Vite dev server with hot reload