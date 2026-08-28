export * from './models.js';
export * from './review.js';

import type { StageWorkDomain } from './models.js';

export function inferStageWorkDomain(name: string): StageWorkDomain {
  const normalized = name.trim().toLowerCase();
  if (/发布|上线|交付|定版|定稿|量产|出厂/.test(normalized)) return 'delivery';
  if (/联调|测试|验证|验收|回归|试用|测评/.test(normalized))
    return 'verification';
  if (/方案|设计|架构|规格|原型/.test(normalized)) return 'design';
  if (/需求|产品|调研|立项|评审/.test(normalized)) return 'product';
  if (
    /开发|研发|实现|编码|拆分|调试|适配|移植|重构|打样|采购|生产|agent|工具/.test(
      normalized,
    )
  )
    return 'implementation';
  return 'other';
}
