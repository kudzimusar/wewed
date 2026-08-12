-- Scope wedding social-channel configuration to WeddingContent so reusable
-- wedding components never carry another couple's channel identity.

insert into "WeddingContent" (
  "id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt"
)
select
  'canon-charity-telegram-url',
  w.id,
  'social',
  'telegramUrl',
  'https://t.me/wewedcharitykudzie',
  0,
  null,
  now()
from "Wedding" w
where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" (
  "id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt"
)
select
  'canon-charity-telegram-handle',
  w.id,
  'social',
  'telegramHandle',
  '@wewedcharitykudzie',
  0,
  null,
  now()
from "Wedding" w
where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;
