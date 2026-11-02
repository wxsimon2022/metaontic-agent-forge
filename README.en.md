<img src="./logo.svg" width="300" alt="MetaOnticVideo — AI video creation plugin for DeepSeek Harness">

# MetaOnticVideo: Seedance AI Video Creation for DeepSeek Harness

**Create AI videos longer than 15 seconds using Seedance 2.0 multi-segment video continuation.** Start with a natural-language idea, review the script and storyboard, generate and preview each segment, then merge the results locally with FFmpeg.

[中文](./README.md) · [Installation and user guide (Chinese)](./MetaOnticVideo使用说明书.md) · [Latest release](https://github.com/wxsimon2022/metaontic-video/releases/latest) · [Changelog](./CHANGELOG.md) · [Gitee mirror](https://gitee.com/hackloop/metaontic-video)

## Why MetaOnticVideo?

Seedance 2.0 generates up to 15 seconds per request. MetaOnticVideo plans a longer video as an initial generation followed by video continuation: a 30-second project can use two 15-second segments, and a 60-second project can use four. Preview and approve each segment before continuing; the plugin keeps the source segments and merges a complete local video.

The project planner supports up to 120 seconds and 10 segments. Longer videos require multiple paid model calls. Transitions express the intended continuity; inspect each generated segment to assess the actual result.

## Features

- **Text-to-video and image-to-video:** prompts, reference images, first frames or first/last frames, depending on the model and provider.
- **Script and storyboard review:** review the full script, a local storyboard illustration and cost estimates before confirming production.
- **Video continuation:** describe transitions and extend the previous video while retaining the approved subject, action and audio plan.
- **Segment previews and resume:** review each completed segment and continue using the saved task state; reuse completed segments after an interruption.
- **Local FFmpeg merging:** deliver the merged video first, followed by the original numbered segments.
- **480P and 720P:** confirm resolution during script review; subsequent segments retain that choice.
- **Provider options:** MetaOntic AI, a service-issued key, or direct Volcano Engine access. The current model selector offers Seedance 2.0 Mini and Fast.
- **Optional character design:** for a text-only project, choose whether to generate a stylized character image with Seedream. Image calls are billed separately; review the result before using it for the initial video and all continuations. Declining keeps the text-only workflow.
- **Reference image preparation:** supported relay connections can use Seedream to convert real-person references into a non-photorealistic style, with separate consent, billing and result review.

## Quick start

1. Open [the latest GitHub release](https://github.com/wxsimon2022/metaontic-video/releases/latest) or [Gitee Releases](https://gitee.com/hackloop/metaontic-video/releases). Copy the download link for the `metaontic-video-<version>.tgz` asset and paste it into **DeepSeek Harness → Plugins → Add plugin**. Use the packaged asset rather than a Git repository or Source code archive. Alternatively, download and extract the asset, then install its local `package` directory. On Windows, `ERR_PNPM_GIT_RESOLVE_FAILED` indicates a Git source failed to resolve; switch to the packaged asset without changing global Git settings or disabling supply-chain checks.

2. Open the plugin settings, select **MetaOntic AI**, register at [ai.bileego.com](https://ai.bileego.com/), obtain an API key and save it in the plugin. A shared key must support both selected video and image models; separate keys are also supported.
3. Start a **new conversation** and select **视频创作助手 (Video Creation Assistant)**.
4. Describe your video, including duration, aspect ratio and resolution. Review the script and storyboard, then separately confirm production and costs.

Example:

```text
Create a 30-second video introducing a melon farm, 16:9, 480P.
Start with the farmer introducing himself, then show him gently tapping a ripe melon.
Use Mandarin dialogue and ambient sound, without subtitles.
Show the complete script, storyboard and cost estimate before generating anything.
```

## Requirements and workflow

DeepSeek Harness provides the plugin runtime; Node.js 20+ is required. FFmpeg is needed for local multi-segment merging, and ffprobe is used to inspect media. See the [FFmpeg setup instructions](./README.md#ffmpeg-与设置页).

The storyboard is a locally drawn illustration, not a paid image generation or a preview of the final model output. Reference-image conversion, retries and additional media calls are billed separately. Model and provider capabilities determine which inputs are accepted.

If generation stops or a status query fails, check the original task ID or resume with the saved `resumeDir`. A missing response does not prove that the provider did not create a task; the plugin blocks automatic resubmission until the original request is checked.

## Documentation and support

- [Full Chinese documentation](./README.md)
- [Installation, key configuration and usage guide](./MetaOnticVideo使用说明书.md)
- [User guide PDF](./MetaOnticVideo使用说明书.pdf)
- [Local development and hot reload](./README.md#本地开发热加载)
- [Report an issue](https://github.com/wxsimon2022/metaontic-video/issues)
- [Download release packages](https://github.com/wxsimon2022/metaontic-video/releases)

## License

[MIT](./LICENSE)

Release packages bundle the required host schema library and do not require external runtime npm dependencies. If a previous local-development setup still points to a deleted source directory, correct that local loading path before installing a release package.

Windows users can also download the `MetaOnticVideo-Windows-<version>.zip` release asset, extract it and install its `package` directory. The ZIP includes an illustrated Chinese installation tutorial and the full PDF guide. Do not paste the ZIP or release page URL into the installer.
