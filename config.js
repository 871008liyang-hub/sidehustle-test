// ============================================================
// 副业天赋测试 · 站点配置（部署时替换为你的真实值）
// 说明：SUPABASE_URL 与 SUPABASE_ANON_KEY 是「公开安全」的，
//       anon key 本就设计为可暴露在前端，真正的安全由数据库
//       的行级安全（RLS）保证——匿名角色读不到密码表、读不到
//       他人结果。请勿在此填入 service_role 密钥。
// ============================================================
const SITE_CONFIG = {
  // —— Supabase（在 Supabase 后台 Settings → API 获取）——
  SUPABASE_URL: 'https://jcbkzpwpxjphdqcuscwn.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjYmt6cHdweGpwaGRxY3VzY3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NzQ4NTAsImV4cCI6MjEwNzM1MDg1MH0.O4kuMSozfkmd5Jkvd6LOHXG1JcVQsetOXx253j9SxMA',

  // —— 店铺 / 客服 / 返现（好评有礼弹窗用）——
  SHOP_NAME: '你的店铺名称',
  CUSTOMER_SERVICE: '你的客服微信 / QQ（占位）',
  REBATE_RULE: '在店铺完成好评后，联系客服并发送好评截图，即可获得 1 元返现。',

  // 每个密码允许完成的测试次数（需与数据库 max_uses 一致）
  MAX_TESTS: 3,
};

if (typeof module !== 'undefined' && module.exports) module.exports = SITE_CONFIG;
