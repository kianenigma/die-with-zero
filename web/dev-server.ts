/// <reference types="bun-types" />

// Development server with auto-rebuild on file changes
import { watch } from "fs";

let isBuilding = false;

// Build function using Bun's spawn API
async function build() {
  if (isBuilding) return;

  isBuilding = true;
  console.log('🔨 Building...');

  const buildProcess = Bun.spawn(['bun', 'build', 'src/index.html', '--outdir', 'dist', '--target', 'browser'], {
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const exitCode = await buildProcess.exited;
  isBuilding = false;

  if (exitCode === 0) {
    console.log('✅ Build complete!');
  } else {
    console.log('❌ Build failed');
  }
}

// Initial build
await build();

// Watch for changes in src directory
const watcher = watch('./src', { recursive: true }, (eventType, filename) => {
  if (filename) {
    console.log(`📝 File changed: ${filename}`);
    build();
  }
});

console.log('👀 Watching src/ for changes...\n');

// Start the server
const server = Bun.serve({
  port: 8080,
  async fetch(req) {
    const url = new URL(req.url);
    let filePath = url.pathname;

    // Serve index.html for root
    if (filePath === '/') {
      filePath = '/index.html';
    }

    // Serve from dist directory
    const file = Bun.file(`./dist${filePath}`);

    // Check if file exists
    const exists = await file.exists();
    if (!exists) {
      return new Response('404 Not Found', { status: 404 });
    }

    return new Response(file);
  },
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
console.log(`   Open http://localhost:${server.port} in your browser`);

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  watcher.close();
  process.exit(0);
});
