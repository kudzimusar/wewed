-- Classic wedding presentation recovery
--
-- Move the remaining Charity & Kudzie presentation-only literals from the
-- historic premium renderer into wedding-scoped content. Every insert is
-- conflict-safe: existing couple/planner edits always win.

-- Classic gallery preview assets used when no approved/uploaded media exists.
insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-gallery-preview-0', w.id, 'gallery', 'previewImage0', '/hero-wedding.png', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-gallery-preview-1', w.id, 'gallery', 'previewImage1', '/couple-silhouette.png', 1, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-gallery-preview-2', w.id, 'gallery', 'previewImage2', '/ornament-frame.png', 2, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-gallery-preview-3', w.id, 'gallery', 'previewImage3', '/icon-512.png', 3, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-gallery-heading', w.id, 'gallery', 'heading', 'Moments That Matter', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-gallery-subtitle', w.id, 'gallery', 'subtitle', 'Every glance, every laugh, every dance — preserved forever.', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

-- Classic Memory Capsule editorial state. The original component was a staged
-- recording interaction; this keeps its displayed count/copy wedding-scoped.
insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-memory-heading', w.id, 'memory', 'heading', 'Memory Time Capsule', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-memory-subtitle', w.id, 'memory', 'subtitle', 'Leave a 10-second video message for Charity & Kudzie. We’ll play them at the reception and keep them forever.', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-memory-count', w.id, 'memory', 'messageCount', '47', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-memory-duration', w.id, 'memory', 'recordDuration', '10', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

-- The historic public cultural guide is editorial wedding-site content, not the
-- private Guest table. Keep it scoped to Charity & Kudzie's public site.
insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-guide-heading', w.id, 'guests', 'guideHeading', 'Cultural Guide', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-guide-subtitle', w.id, 'guests', 'guideSubtitle', 'For our guests joining from near and far — a warm introduction to Zimbabwean wedding traditions.', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-guide-0', w.id, 'guests', 'guide-0', 'Shona Wedding Traditions', 0,
  json_build_object('content', 'A traditional Shona wedding includes the roora (bridewealth) process, where the groom''s family presents gifts to the bride''s family as a sign of respect and gratitude. The magumo (gifts) are negotiated between families and symbolise the joining of two families, not just two people. The ceremony often includes traditional dancing, singing, and the sharing of food as a communal celebration of love and unity.')::text,
  now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-guide-1', w.id, 'guests', 'guide-1', 'What to Wear', 1,
  json_build_object('content', 'The dress code is Formal / Black Tie Optional. Traditional Zimbabwean attire is warmly welcomed — for women, this might include elegant African-print dresses or wraps; for men, a smart safari suit or traditional shirt. Harare weddings tend to be stylish affairs — think bold colours, beautiful fabrics, and expressive personal style. Comfortable shoes are recommended as there will be dancing!')::text,
  now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-guide-2', w.id, 'guests', 'guide-2', 'Zimbabwean Cuisine', 2,
  json_build_object('content', 'The menu will feature a blend of traditional and contemporary dishes. Expect sadza (maize meal porridge, a Zimbabwean staple) served with nyama (meat — beef, chicken, or goat), madora (dried caterpillars, a local delicacy), muriwo (leafy green vegetables), and peanut butter dishes. Vegetarian and international options will also be available. The wedding cake is a centrepiece — often a rich fruit cake symbolising prosperity and fertility.')::text,
  now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-guide-3', w.id, 'guests', 'guide-3', 'Useful Shona Phrases', 3,
  json_build_object('content', 'Mangwanani — Good morning | Masikati — Good afternoon | Maita basa — Thank you for the work (a deep expression of gratitude) | Makorokoto — Congratulations | Munhu wese munhu — Every person is a person (unity) | Tine base — We have work/a role (encouragement) | Kumbirai ruregerero — Please forgive me | Ndatenda — Thank you. Don''t worry about perfect pronunciation — your effort to try will be deeply appreciated!')::text,
  now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

-- Classic vendor showcase. These rows describe the exact editorial cards that
-- were previously embedded in vendor-marketplace.tsx. They are intentionally
-- public WeddingContent, not operational Provider relationships.
insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-vendor-heading', w.id, 'vendors', 'heading', 'The Makings of a Perfect Day', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-vendor-subtitle', w.id, 'vendors', 'subtitle', 'The talented hands behind our celebration — and available for yours.', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-vendor-0', w.id, 'vendors', 'vendor-0', 'Imba Manor', 0,
  json_build_object('category','Venue','location','Harare, Zimbabwe','description','An estate where elegance meets African warmth — where our forever begins.','rating',5,'featured',true,'icon','trees','accent','gold','email','celebrations@imbamanor.co.zw')::text,
  now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-vendor-1', w.id, 'vendors', 'vendor-1', 'Tendai Photography', 1,
  json_build_object('category','Photographer','description','Capturing love stories across Zimbabwe for over a decade.','rating',5,'featured',false,'icon','camera','accent','clay','email','hello@tendaiphotography.com')::text,
  now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-vendor-2', w.id, 'vendors', 'vendor-2', 'Sage & Bloom', 2,
  json_build_object('category','Florist','description','Botanical artistry for the modern romantic — every stem, a story.','rating',5,'featured',false,'icon','flower','accent','sage','email','studio@sageandbloom.co.zw')::text,
  now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-vendor-3', w.id, 'vendors', 'vendor-3', 'Rhythm & Soul DJ', 3,
  json_build_object('category','Entertainment','description','From ceremony to last dance, we keep the celebration moving.','rating',5,'featured',false,'icon','disc','accent','plum','email','bookings@rhythmandsoul.co.zw')::text,
  now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

-- After-wedding editorial copy from the approved classic experience.
insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-after-heading', w.id, 'after', 'heading', 'The Day We Said Forever', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-after-subtitle', w.id, 'after', 'subtitle', 'Relive the magic of December 23, 2026.', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'classic-charity-after-thanks', w.id, 'after', 'thankYou', 'To everyone who made our day so beautiful — thank you. Your love, laughter, and presence made December 23, 2026 a day we will carry in our hearts forever.', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;
