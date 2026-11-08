<img src="./logo.svg" width="240" alt="MetaOnticVideo" />

# MetaOnticVideo

[简体中文](./README.md)

A DeepSeek Harness plugin for **beginner-friendly video creation and a low-cost long-video workflow**.

## Start creating videos quickly

Describe what you want to make and follow the assistant through your first video, without first learning prompting or editing workflows.

1. **Share your idea**: start with a brief thought or a complete concept. Any refinement stays true to your original idea.
2. **Review the script**: read what will be filmed, ask for changes in plain language, then confirm production.
3. **Watch the result**: preview the generated video and keep the finished file locally.

For example: “Make a 30-second vertical 720P video showing a peaceful lake at dawn.” Duration, orientation and resolution already supplied are reused; only missing details are requested.

## A low-cost long-video workflow

Use **segment generation → continuation → local merging** to make videos beyond the model’s single-call duration limit.

- Review each result before continuing to the next segment.
- Keep and reuse completed segments, pause and resume saved progress, and avoid starting over.
- Merge completed segments locally with FFmpeg while retaining the original clips.

Bring your own API key. Image and video calls are billed by the chosen provider, with cost confirmation before each new segment.

## Online installation

Paste an online installation URL into Harness → Plugins → Add plugin. Windows and macOS use the same package.

Gitee:

```text
https://gitee.com/hackloop/metaontic-video/releases/download/v3.20.1/metaontic-video-3.20.1.tgz
```

GitHub mirror:

```text
https://github.com/wxsimon2022/metaontic-video/releases/download/v3.20.1/metaontic-video-3.20.1.tgz
```

Open plugin settings, choose **MetaOntic AI**, enter your API key and save. Select **视频创作助手** in a conversation to begin; **宣传视频助手** is also available for product, brand or event content. Both assistants share the production workflow. Standard mode remains general-purpose.

[Online user guide](https://ai.mybfs.cn) · [Report an issue](https://github.com/wxsimon2022/metaontic-video/issues) · [Changelog](./CHANGELOG.md) · [Development](./docs/engineering/development.md)

See [LICENSE](./LICENSE).
