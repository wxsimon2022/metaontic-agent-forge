import { resolve } from 'node:path';
/** tools/results：从宿主入口拆出的独立职责模块。 */
import { formatSeconds } from '../utils/files.js';

function previewInstruction(value) {
  const latest = (value?.segments || []).filter((segment) => segment.status === 'succeeded').at(-1);
  const target = latest?.localPath || value?.videoPath || latest?.videoUrl || value?.videoUrl;
  return `【下一步：先展示本段视频，等待用户预览】请立即在用户可见正文用可点击链接展示本次完成的分段：${target || '见本次分段结果'}。`
    + `正文附上 ${artifactLink('观看本段视频', latest?.localPath || value?.previewPath || value?.videoPath, latest?.videoUrl || value?.videoUrl)}。`
    + '不要调用 present：交付卡片只登记最终成片，中途登记分段会把成片挤到后面。'
    + '不能只说“生成成功”或只列任务ID。展示后询问“先看这段，效果可以吗？确认后再继续下一段。”并结束本轮等待回复。'
    + '用户首次授权制作不等于已看过本段，不得自动resume或调用其他生成工具绕过预览；链接不可用时给出可点击视频路径或播放链接，仍须等待明确确认。';
}

export function artifactLink(label, localPath, videoUrl) {
  const target = localPath ? resolve(localPath) : videoUrl;
  if (!target) return '';
  return `[${label}](<${String(target).replace(/</g, '%3C').replace(/>/g, '%3E')}>)`;
}

/** 多段成果逐项交付；只引用真实完成的文件，不将最后一段当作合并成片。 */
export function deliveryInstruction(value) {
  const segments = value?.segments || [];
  const completed = segments.filter(segment => segment.status === 'succeeded' && (segment.localPath || segment.videoUrl));
  const multiPart = segments.length > 1 || (value?.paused && (value?.remainingSeconds || 0) > 0);
  if (!completed.length && !value?.videoPath && !value?.videoUrl) return '';
  const linkRule = '正文里每项都要有 Markdown 可点击链接：[观看视频](<绝对文件路径或真实播放URL>)。不能用反引号路径或普通文本路径代替链接；卡片未验证时不得声称上方卡片可直接播放。已有文件直接交付，不重新生成。';
  const cardRule = '交付卡片只登记最终成片：宿主的卡片按本轮首次出现顺序排列、超过四个还会折叠，中途登记脚本、分镜、参考图、分段预览或部分合并会把成片挤到后面，事后补发也挪不回来——这些过程材料只用正文（内嵌图片或链接）交付。';
  // 只有「整条生成结束 + 成片在本机合并成功」才是最终交付，才允许登记卡片。
  const final = value?.status === 'succeeded' && !value?.paused && !value?.partial;
  if (!multiPart) {
    const segment = completed[0];
    const film = value?.videoPath || segment?.localPath || '';
    const parts = ['【视频交付：正文必须有可点击链接】', artifactLink('观看视频', film, segment?.videoUrl || value?.videoUrl)];
    parts.push(film && final
      ? '正文链接发完后，用 present 登记一次卡片：files 只放这条成片，不登记脚本、分镜、参考图等过程材料。'
      : film
        ? '这次还不是最终交付（暂停、部分交付或还没出结果）：不要调用 present，先用正文链接把这条视频交付给用户。'
        : '只有上游链接、没有本地文件时不要调用 present，正文给可点击播放链接即可。');
    parts.push(linkRule, cardRule);
    return parts.join('\n');
  }
  const labels = ['第一段', '第二段', '第三段'];
  const items = completed.map((segment, i) => {
    const index = segment.index || i + 1;
    const label = labels[index - 1] || `第${index}段`;
    return `${label}：${segment.localPath || segment.videoUrl}\n${artifactLink(label, segment.localPath, segment.videoUrl)}`;
  });
  const mergedPath = completed.length > 1 && value?.merged && value?.videoPath
    && !completed.some(segment => segment.localPath === value.videoPath) ? value.videoPath : '';
  if (mergedPath) items.unshift(artifactLink('打开合并视频', mergedPath, ''), `${value.paused || value.partial || value.status !== 'succeeded' ? '已完成部分合并视频' : '合并后完整视频'}：${mergedPath}`);
  else if (completed.length > 1) items.push('合并结果尚未交付：如实说明未合并、合并失败或等待交付，不将最后一段当作完整成片。');
  const tail = !final
    ? '这次还不是最终交付（还有分段没做完，或成片还没合并）：不要调用 present，交付卡片只登记最终成片。先用正文链接把已完成的部分交付给用户，等整条视频生成结束、成片合并成功后再登记一次卡片。'
    : mergedPath
      ? '请实际使用 present/文件展示工具登记交付卡片：files 数组第一个必须是合并成片，其后才按段号放分段；不要登记脚本、分镜、参考图、中间预览或部分合并。顺序不对、漏掉成片或带了中间产物，插件都会拦下这次 present，按提示改好顺序重发即可，不得因此省略成片或分段。'
      : '没有合并成片时不要调用 present：按段号在正文里交付真实分段即可，等成片合并成功后再登记卡片。';
  return ['【交付清单：每个分段与合并结果分别展示】', ...items, linkRule, cardRule, tail].join('\n');
}

function recoveryInstruction(value, toolName) {
  if (!value?.resumeDir) return '';
  if (value.deliveryError || value.ffmpegMissing) return `生成进度已保存。交付尚未完成，请用 ${toolName} 的 resume="${value.resumeDir}" 重试下载或合并，不会重新生成或重复扣费。`;
  if (value.pendingTaskId) return `任务 ${value.pendingTaskId} 已提交。请用 ${toolName} 的 resume="${value.resumeDir}" 查询并接回原进度，不会重新提交本段。`;
  return '';
}

function referenceReview(value, toolName) {
  return [{ type: 'text', text: [
    '【下一步：展示转换图片并等待用户确认，尚未重试视频】',
    ...(value.convertedReferences || []).map((item, index) => `图片${index + 1}（${item.role}）：${artifactLink(`打开图片${index + 1}`, item.localPath, item.imageUrl)}`),
    '先逐张在正文内嵌展示并附可点击原图链接；不要调用 present：交付卡片只登记最终成片，转换图片属于过程材料，卡片里多出来的行会把成片挤到后面。'
    + `确认是非真人且符合风格要求；用户明确同意后再调用 ${toolName}，传 resume="${value.resumeDir}"、referenceImagesReviewed:true。首次转换授权不等于结果确认。图片仍像真人或不满意时停止，不自动再次出图。视频重试另外计费。`,
  ].join('\n') }];
}

export const SEGMENT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    index: { type: 'integer' },
    kind: { type: 'string' },
    seconds: { type: 'integer' },
    taskId: { type: 'string' },
    status: { type: 'string' },
    videoUrl: { type: 'string' },
    localPath: { type: 'string' },
    durationSeconds: { type: 'number' },
    error: { type: 'string' },
  },
};

/** 合并方式的说法（两个工具的结果里都用它）。 */
function mergeModeLabel(mergeMode) {
  if (mergeMode === 'copy') return '无损拼接';
  if (mergeMode === 'segment') return '这一段暂时按原始分段交付（续做时再和后面的段合并）';
  if (mergeMode === 'single') return '一段直出，无需拼接';
  if (mergeMode === 'seamless') return '直接拼接（旧配置兼容）';
  return '重编码拼接';
}

/** 结果文字里对本次工具的说法：video_generate 是「直出+延长」，video_extend 只有「延长」。 */
const RENDER_WORDING = {
  generate: {
    toolName: 'video_generate',
    segmentLabel: (segment) => (segment.kind === 'extend' ? `延长 +${segment.seconds}s` : `直出 ${segment.seconds}s`),
    pausedHead: '已生成并交付前',
    pausedTail: '每段生成完都会问一次要不要继续；这次先交付到这里',
    success: (value) => {
      const { mode, segments = [] } = value || {};
      if (mode === 'extended') return `视频生成成功：先直出 ${formatSeconds(segments[0]?.seconds)} 秒，再延长 ${segments.length - 1} 段。`;
      return `视频生成成功：一次直出 ${formatSeconds(segments[0]?.seconds)} 秒，没有超过单段上限，不需要延长。`;
    },
    timeout: '任务仍在生成中（已超出单次等待时间）。',
    unknown: '没能确认任务状态（查询失败，不是任务失败）。任务已经提交，可能仍在生成；用 video_status 按下面的任务 ID 复查，不要重新提交。',
    cancelled: '任务已取消。',
    failed: (error) => `视频生成失败${error ? `：${error}` : ''}。`,
    leftover: (resumeDir) => `要接着做就把 resume 原样传回 video_generate（resume="${resumeDir}"），插件会接着已有的分段往下生成，前面几段不会重新生成、也不会重复扣费。`,
    noMergedFile: '没有生成合并文件，请按上面的上游链接自行下载分段。',
  },
  extend: {
    toolName: 'video_extend',
    segmentLabel: (segment) => `+${segment.seconds}s`,
    pausedHead: '已延长并交付前',
    pausedTail: '每段延长完都会问一次要不要继续；这次先交付到这里',
    success: () => '视频延长成功。',
    timeout: '延长任务仍在生成中（已超出单次等待时间）。',
    unknown: '没能确认这段延长任务的状态（查询失败，不是任务失败）。任务已经提交，可能仍在生成；用 video_status 按任务 ID 复查，不要重新提交。',
    cancelled: '延长任务已取消。',
    failed: (error) => `视频延长失败${error ? `：${error}` : ''}。`,
    leftover: (resumeDir) => `要接着做就把 resume="${resumeDir}" 传回 video_extend（prompt 可以省略，其余参数照旧）：前面几段不会重新生成、不会重复扣费。`,
    noMergedFile: '',
  },
};

/**
 * 两个工具共用同一套结果文案：分段清单、交付清单、成片行与状态说明。
 * 只有工具名和少数措辞不同，统一在这里维护，避免两处分叉。
 */
function renderVideoText(value, variant) {
  const wording = RENDER_WORDING[variant] || RENDER_WORDING.generate;
  if (value?.status === 'review_required') return referenceReview(value, wording.toolName);
  const {
    status, segments = [], videoUrl, videoPath, mergeMode, segmentsDir, note, error,
    pendingTaskId, paused, resumeDir, remainingSeconds,
  } = value || {};
  const lines = segments.map((segment) => {
    const head = `第 ${segment.index} 段：${wording.segmentLabel(segment)}（任务 ${segment.taskId}）`;
    if (segment.status !== 'succeeded' || !segment.videoUrl) {
      return `${head} → ${segment.status}${segment.error ? `：${segment.error}` : ''}`;
    }
    return segment.localPath
      ? `${head} → ${segment.videoUrl}\n    本地文件：${segment.localPath}`
      : `${head} → ${segment.videoUrl}`;
  });

  const parts = [deliveryInstruction(value), recoveryInstruction(value, wording.toolName), ...(paused ? [previewInstruction(value)] : [])];
  if (status === 'succeeded') {
    if (paused) {
      const totalSeconds = segments.reduce((sum, item) => sum + (item.seconds || 0), 0);
      parts.push(
        `${wording.pausedHead} ${segments.length} 段（共 ${formatSeconds(totalSeconds)} 秒）：${wording.pausedTail}`
        + '（当前暂停等待预览确认；也可能因停止或超时暂停）。',
      );
    } else {
      parts.push(wording.success(value));
    }
  } else if (status === 'timeout') {
    parts.push(wording.timeout);
  } else if (status === 'unknown') {
    parts.push(wording.unknown);
  } else if (status === 'cancelled') {
    parts.push(wording.cancelled);
  } else {
    parts.push(wording.failed(error));
  }
  // 成片行排在分段逐条列表之前：正文、交付清单与结果卡片统一成片在前。
  if (status === 'succeeded') {
    if (videoPath) {
      parts.push(`成片（本地文件）：${videoPath}（${mergeModeLabel(mergeMode)}）`);
    } else if (segmentsDir) {
      parts.push(`没有合并成一条：分段文件都在 ${segmentsDir}（每段路径见下面的列表）。`);
    } else if (wording.noMergedFile) {
      parts.push(wording.noMergedFile);
    }
  }
  parts.push(...lines);
  if (paused && resumeDir) {
    parts.push(
      `还没生成的部分：还剩 ${formatSeconds(remainingSeconds)} 秒。` + wording.leftover(resumeDir),
    );
  }
  if (videoUrl) parts.push(`最后一段上游链接（约 24 小时内有效）：${videoUrl}`);
  else if (variant === 'extend' && status === 'succeeded') parts.push('最后一段上游链接（约 24 小时内有效）：（无）');
  if (note) parts.push(note);
  if (status === 'timeout' || status === 'unknown') {
    const taskId = pendingTaskId || segments.at(-1)?.taskId || '（未知）';
    parts.push(`可用 video_status 查询任务 ${taskId} 的状态与视频链接。`);
  }
  return [{ type: 'text', text: parts.filter(Boolean).join('\n') }];
}

export function renderResult(value) {
  return renderVideoText(value, 'extend');
}

export function renderVideoResult(value) {
  return renderVideoText(value, 'generate');
}
