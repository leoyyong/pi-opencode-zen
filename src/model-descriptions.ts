/**
 * Human-readable descriptions for the free OpenCode Zen models.
 *
 * Source: the official Zen documentation (https://opencode.ai/docs/zen/),
 * fetched 2026-10-08. The live `/zen/v1/models` list decides which models are
 * exposed; this map only annotates the ones we know about, so descriptions
 * silently degrade to a generic fallback when upstream adds a new `-free`
 * model.
 *
 * Kept dependency-free (no pi-ai imports) so it can be unit-tested with plain
 * Node, like `free-models.ts`.
 */

/** Structured description of one free model. */
export interface FreeModelDescription {
  /** One-line introduction: what the model is and who makes it. */
  summary: string;
  /** What the model is best used for. */
  bestFor: string;
  /** Privacy or availability caveats, when there are any. */
  notes?: string;
}

/**
 * Curated descriptions keyed by model id. Only free-tier models belong here;
 * paid Zen models are out of scope for this provider.
 */
export const MODEL_DESCRIPTIONS: Readonly<Record<string, FreeModelDescription>> = {
  "big-pickle": {
    summary: "隐身模型（身份未公开），限时免费",
    bestFor: "日常问答、探索性编码、非敏感的副线任务",
    notes: "免费期内收集的数据可能被用于改进模型",
  },
  "space-bunny-free": {
    summary: "隐身模型，其服务商执行零留存策略",
    bestFor: "对隐私有要求但仍想免费用的通用编码任务",
    notes: "零留存、不用于训练，是免费档里隐私最稳妥的选择之一",
  },
  "longcat-2.5-preview-free": {
    summary: "美团 LongCat 2.5 预览版，零留存策略",
    bestFor: "长上下文与通用代理任务试用",
    notes: "零留存、不用于训练；预览版能力可能随时变化",
  },
  "exo-free": {
    summary: "限时免费，团队借免费期收集反馈",
    bestFor: "模型评测对比、非关键的副线任务",
    notes: "免费期内收集的数据可能被用于改进模型",
  },
  "fledge-alpha-free": {
    summary: "Alpha 阶段模型，限时免费",
    bestFor: "快速原型、实验性任务",
    notes: "Alpha 阶段，稳定性未经保证；数据可能被用于训练",
  },
  "mimo-v2.6-flash-free": {
    summary: "小米 MiMo V2.6 Flash，低延迟快速档",
    bestFor: "高频小任务：补全、commit message、小修小改、并行子代理",
    notes: "免费期内收集的数据可能被用于改进模型",
  },
  "mimo-v2.5-free": {
    summary: "小米 MiMo 上一代（V2.5）",
    bestFor: "V2.6 Flash 不可用时的备胎，同样适合轻量高频任务",
    notes: "实测上游可能返回 401；数据可能被用于训练",
  },
  "ling-3.1-flash-free": {
    summary: "蚂蚁 Ling 3.1 Flash，快速档",
    bestFor: "快速编码、批量并行的低风险子任务",
    notes: "免费期内收集的数据可能被用于改进模型",
  },
  "ling-3.0-flash-fin-free": {
    summary: "蚂蚁 Ling 3.0 Flash 金融领域特化版",
    bestFor: "金融/数据类代码、报表与对账逻辑、分析脚本",
    notes: "免费期内收集的数据可能被用于改进模型；实测偶发 400/503",
  },
  "nemotron-3-ultra-free": {
    summary: "NVIDIA Nemotron 3 Ultra 免费端点",
    bestFor: "推理较重的任务（较长链路分析、结构化输出）",
    notes: "NVIDIA 试用条款：禁止提交机密或个人数据，日志用于安全与产品改进",
  },
  "nemotron-3.5-lightning-free": {
    summary: "NVIDIA Nemotron 3.5 Lightning 轻量档免费端点",
    bestFor: "低延迟的结构化输出、分类、信息提取",
    notes: "NVIDIA 试用条款：禁止提交机密或个人数据，日志用于安全与产品改进",
  },
  "muse-spark-1.3-contributor-free": {
    summary: "Meta Muse Spark 1.3 Contributor 层，以数据换免费额度",
    bestFor: "非私有代码的探索性任务；走 openai-responses 通道",
    notes: "prompt 与回复会被用于训练 Meta 模型，私有代码勿用；可能受地区限制",
  },
  "jev-1.13-free": {
    summary: "TypeSafe AI Jev，结构化判定模型（非文本生成）",
    bestFor: "yes/no、多选、评分等结构化决策，如工单分类、情绪打分、路由",
    notes: "不是聊天模型，本扩展会排除它，不作为聊天模型暴露",
  },
};

/** Generic text used when the live list contains a `-free` model we do not know. */
export const UNKNOWN_FREE_MODEL_DESCRIPTION =
  "OpenCode Zen 限时免费模型（未收录具体介绍，可能处于灰度/测试期）";

const LOOKS_FREE = /free$/i;

/** Structured description for a model id, or `undefined` when unknown. */
export function describeFreeModel(id: string): FreeModelDescription | undefined {
  return MODEL_DESCRIPTIONS[id];
}

/**
 * Single-line description attached to the model object exposed by the
 * provider. Unknown `-free` models get a generic fallback; ids that do not
 * follow the `-free` convention and are not curated get nothing.
 */
export function modelDescription(id: string): string | undefined {
  const entry = MODEL_DESCRIPTIONS[id];
  if (entry) return formatDescription(entry);
  return LOOKS_FREE.test(id) ? UNKNOWN_FREE_MODEL_DESCRIPTION : undefined;
}

/** `${summary}；适合：${bestFor}；⚠️ ${notes}` — one line, safe for UI labels. */
export function formatDescription(entry: FreeModelDescription): string {
  const parts = [entry.summary, `适合：${entry.bestFor}`];
  if (entry.notes) parts.push(`⚠️ ${entry.notes}`);
  return parts.join("；");
}
