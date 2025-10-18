# Die With Zero - Financial Planner

A TypeScript-based financial planning tool built with Vue 3, Chart.js, and Bun.

## Tech Stack

- **Runtime**: Bun (fast JavaScript runtime & bundler)
- **Language**: TypeScript
- **Framework**: Vue 3
- **Charts**: Chart.js with zoom and annotation plugins
- **Styling**: Tailwind CSS (CDN)

## Project Structure

```
web/
├── src/
│   ├── main.ts          # Main Vue application
│   ├── config.ts        # Configuration and tooltips
│   ├── types.ts         # TypeScript type definitions
│   └── index.html       # HTML template
├── build/               # Build output (gitignored)
│   ├── index.html       # Built HTML
│   └── main.js          # Bundled JavaScript
├── configs/
│   └── example.json     # Example configuration
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── server.ts            # Bun dev server

```

## Development

### Prerequisites

- [Bun](https://bun.sh) installed (v1.2.6 or later)

### Setup

```bash
# Install dependencies
bun install

# Build the project
bun run build

# Start dev server (serves from build/)
bun run preview
```

The app will be available at `http://localhost:8080`

## Scripts

- `bun run build` - Build TypeScript to optimized JavaScript bundle
- `bun run preview` - Start local server to preview the built app
- `bun run dev` - Watch mode for development (TypeScript only)

## Deployment

The GitHub Actions workflow automatically:
1. Installs Bun
2. Installs dependencies
3. Builds the project
4. Deploys the `build/` directory to GitHub Pages

## Features

- 📊 Net worth projection with customizable parameters
- 💰 Tax rate scheduling
- 📈 Asset allocation tracking (liquid vs non-liquid)
- 🎯 Milestone tracking
- 🔍 Interactive charts with zoom/pan
- 💾 Save/load parameters as JSON
- 🌙 Dark/light theme toggle
- 📱 Responsive design

## Configuration

See `configs/example.json` for an example configuration file that can be loaded into the app.
