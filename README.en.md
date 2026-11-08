<img src="./logo.svg" width="240" alt="MetaOnticVideo" />

# MetaOnticVideo

[简体中文](./README.md)

A DeepSeek Harness plugin focused on two goals: helping beginners start creating videos quickly, and providing a low-cost workflow for longer videos.

## Highlights

- **Start creating videos quickly**: describe your idea and follow the assistant through the script and production steps, without first learning prompting or editing workflows.
- **A low-cost long-video workflow**: generate and continue segments, review each result before proceeding, and merge them locally. Completed segments are kept for reuse.

## Quick start

1. Paste the online installation URL below into Harness → Plugins → Add plugin.
2. Open plugin settings, choose **MetaOntic AI**, enter your own API key and save. See the [user guide](https://ai.mybfs.cn) for setup.
3. Select **视频创作助手** in the session mode selector. Describe your idea, duration, aspect ratio and resolution (480P or 720P). If duration is missing, choose 15, 30, 45 or 60 seconds, or enter a custom length.

Online installation URL:

```text
https://gitee.com/hackloop/metaontic-video/releases/download/v3.20.1/metaontic-video-3.20.1.tgz
```

GitHub mirror (same stable package):

```text
https://github.com/wxsimon2022/metaontic-video/releases/download/v3.20.1/metaontic-video-3.20.1.tgz
```

Select “视频创作助手” to begin, or “宣传视频助手” for product, brand and event promos. Bring your own API key; model calls are billed by the chosen provider.

## Workflow

Choose the concept and optional character reference → review the full script, storyboard and estimated cost → approve the script → confirm generation cost → generate and preview.

- Videos beyond the model limit use multiple segments. Review each result and confirm the next segment’s cost before continuing. FFmpeg merges the completed video locally; source segments are kept.
- Images and videos can be previewed in tool result cards. Original links remain available; resume saved progress to avoid duplicate submissions.
- Character images and reference conversions require separate consent, billing and result review. Completed segments are reused; new segments are still billed.
- Upstream generation, local download and merging have separate completion states. Query errors do not establish generation failure. Save upstream results promptly.
- The video-only scope applies to **视频创作助手** and **宣传视频助手** modes. Standard mode supports other tasks. Change API keys and models in plugin settings.

## Documentation and support

- [Online user guide](https://ai.mybfs.cn)
- [Changelog](./CHANGELOG.md) · [Report an issue](https://github.com/wxsimon2022/metaontic-video/issues)
- [Development and release instructions](./docs/engineering/development.md) · [Platform compatibility](./docs/engineering/platform-compatibility.md)

Check for the latest stable release in plugin settings and confirm before installing. Updates are not automatic. If installation or updating fails, preserve your settings and tasks and consult the guide before uninstalling.

## License

See [LICENSE](./LICENSE).
