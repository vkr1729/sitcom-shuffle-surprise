Place your Gemini Nano Banana logo here as logo.png

Quick steps:
1. Generate logo in Gemini with Nano Banana model
   Prompt example: "Surprise gift box with retro TV screen inside showing dice, confetti, purple to cyan gradient, dark background, app icon, flat design, no text, 512x512, high detail"

2. Download as PNG 512x512

3. Copy to this folder as logo.png
   cp ~/Downloads/your-logo.png ./public/logo.png

4. Deploy:
   git add public/logo.png && git commit -m "feat: new Gemini logo" && git push
   npx vercel --prod

The configurator (index.html) will auto-detect logo.png and show it instead of emoji placeholder.
The manifest will serve https://<host>/logo.png as addon logo.
