-- ============================================================
-- 副业天赋测试 · 批量生成测试密码（卡密）
-- 用途：把生成的唯一密码写进 allowed_passwords 表，供测试站校验；
--       同时你把这些密码导出，上传到淘宝/小红书的「卡密自动发货」。
-- 每个密码限 3 次使用（与站点 MAX_TESTS=3 一致）。
--
-- 使用方法：登录 Supabase → SQL Editor → 新建查询 →
--          全选粘贴本文件 → 先改下面的 cnt（数量）→ 点 Run。
-- ============================================================

-- 1) 生成密码（改 cnt 调整数量；label 方便你按批次管理）
do $$
declare
  cnt      int  := 100;                       -- ← 要生成的密码数量
  pw       text;
  chars    text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 去掉易混淆的 0O1Il
  i        int  := 0;
  batch_id text := 'batch-' || to_char(now(), 'YYYYMMDD');
begin
  while i < cnt loop
    -- 生成 12 位由上述字符组成的随机密码
    select string_agg(substr(chars, 1 + floor(random() * length(chars))::int, 1), '')
      into pw
      from generate_series(1, 12);

    -- 查重，保证唯一
    if not exists (select 1 from public.allowed_passwords where password = pw) then
      insert into public.allowed_passwords (password, max_uses, label)
      values (pw, 3, batch_id);
      i := i + 1;
    end if;
  end loop;
  raise notice '已生成 % 个密码，批次标签：%', cnt, batch_id;
end $$;

-- 2) 导出密码清单（复制 password 这一列，上传到平台卡密自动发货）
--    建议上传前先把结果导出保存一份 Excel/CSV 备份。
select password
from public.allowed_passwords
where label = 'batch-' || to_char(now(), 'YYYYMMDD')
order by created_at;

-- ============================================================
-- 常用运维（按需单独执行，不要和上面一起跑）：
--   · 查看各批次剩余可用量：
--       select label, count(*) as total,
--              count(*) filter (where usage_count < max_uses) as usable
--       from allowed_passwords group by label order by label;
--   · 重置某个密码次数： update allowed_passwords set usage_count=0 where password='XXXXXXXXXXXX';
--   · 删除某批次（谨慎）： delete from allowed_passwords where label='batch-YYYYMMDD';
--   · 补生成更多：       把上面的 cnt 改成需要的数量再跑一次即可（自动跳过重复）。
-- ============================================================
