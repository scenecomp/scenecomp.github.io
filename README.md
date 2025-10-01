# scenecomp.github.io

## Video Setup

The video comes from https://www.youtube.com/watch?v=qKFT4VA7elU. Then, I ran the following commands:

```bash
ffmpeg -ss 6 -i uncompressed.mp4 -vcodec libx264 -crf 28 -preset veryslow -an -movflags +faststart fly-through-unoptimized.mp4
```

```bash
ffmpeg -i fly-through-unoptimized.mp4 -c:v libx264 -preset medium -crf 23 -g 1 -c:a aac -b:a 128k fly-through.mp4
```

## Local Development

This site loads data via `fetch` from `papers.csv`, which requires serving files over HTTP. Opening `index.html` directly with a `file://` URL will block these requests in most browsers.

Quick start with Python:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

Any static server will work (e.g., VS Code Live Server, `npx serve`).

## Papers Database

The site fetches papers data from Google Sheets with local fallback to `papers.csv`.

### Update Local Papers Data

To sync your local `papers.csv` with the latest Google Sheets data:

```bash
curl -L "https://docs.google.com/spreadsheets/d/1gmvjRWJL0nI67Ew8Kvyv0DRV_4G7FWuwjGfdryU6jng/export?format=csv&gid=0" -o papers.csv
```

This downloads the current spreadsheet and overwrites the local `papers.csv` file.