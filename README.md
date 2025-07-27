# scenecomp.github.io

The video comes from https://www.youtube.com/watch?v=qKFT4VA7elU. Then, I ran the following commands:

```bash
ffmpeg -ss 6 -i uncompressed.mp4 -vcodec libx264 -crf 28 -preset veryslow -an -movflags +faststart fly-through-unoptimized.mp4
```

```bash
ffmpeg -i fly-through-unoptimized.mp4 -c:v libx264 -preset medium -crf 23 -g 1 -c:a aac -b:a 128k fly-through.mp4
```