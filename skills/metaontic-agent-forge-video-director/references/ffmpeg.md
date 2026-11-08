# ffmpeg 速查

先确认 ffmpeg/ffprobe 可用：

```bash
ffmpeg -version | head -1
ffprobe -version | head -1
```

## 1. 看规格

```bash
ffprobe -v error -show_entries format=duration,size,bit_rate \
  -show_entries stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels \
  -of json clips/01.mp4
```

## 2. 多镜拼接

### 参数一致：无损拼接

```bash
printf "file '%s'\n" clips/*.mp4 > clips/concat.txt
ffmpeg -y -f concat -safe 0 -i clips/concat.txt -c copy final/out.mp4
```

要求所有分段的编码、分辨率、帧率、音轨一致，否则播放器会在接缝处花屏或音画不同步。

### 参数不一致：统一重编码（推荐竖屏 1080×1920 / 30fps）

```bash
ffmpeg -y -f concat -safe 0 -i clips/concat.txt \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -ar 48000 -ac 2 \
  -movflags +faststart final/out.mp4
```

分段没有音轨时，先补一条静音轨再拼：

```bash
ffmpeg -y -i clip.mp4 -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 \
  -shortest -c:v copy -c:a aac -b:a 128k clip-with-audio.mp4
```

### 分段参数差异很大：concat 滤镜

```bash
ffmpeg -y -i 01.mp4 -i 02.mp4 -i 03.mp4 \
  -filter_complex "\
    [0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1[v0];\
    [1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1[v1];\
    [2:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1[v2];\
    [0:a][1:a][2:a]concat=n=3:v=0:a=1[a];\
    [v0][v1][v2]concat=n=3:v=1:a=0[v]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart final/out.mp4
```

## 3. 抽帧验收

```bash
mkdir -p final/frames
ffmpeg -y -i final/out.mp4 -vf "fps=1/3" final/frames/frame-%02d.jpg
```

看第一帧、中间帧、最后一帧；重点看人脸、手、文字、穿帮。

## 4. 字幕

有 SRT 时烧录：

```bash
ffmpeg -y -i final/out.mp4 -vf "subtitles=final/out.srt:force_style='FontName=PingFang SC,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=60'" \
  -c:v libx264 -crf 20 -c:a copy final/out-sub.mp4
```

没有现成字幕就让用户提供文案或 SRT；不要自己生成与实际台词不符的字幕。

## 5. BGM

```bash
ffmpeg -y -i final/out.mp4 -i bgm.mp3 \
  -filter_complex "[1:a]volume=0.18,afade=t=in:st=0:d=1,afade=t=out:st=13:d=2[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 128k final/out-bgm.mp4
```

只在用户提供 BGM 或明确要求时加；注意版权。

## 6. 画幅调整

横屏转竖屏（裁切）：

```bash
ffmpeg -y -i in.mp4 -vf "crop=ih*9/16:ih,scale=1080:1920" -c:v libx264 -crf 20 -c:a copy out.mp4
```

横屏转竖屏（补边）：

```bash
ffmpeg -y -i in.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black" -c:v libx264 -crf 20 -c:a copy out.mp4
```

## 7. 交付前检查

```bash
ffprobe -v error -show_entries format=duration -show_entries stream=codec_type,width,height,r_frame_rate -of default=nw=1 final/out.mp4
```

确认：时长与脚本一致、分辨率正确、有音轨、文件能正常播放、首尾没有黑帧。
