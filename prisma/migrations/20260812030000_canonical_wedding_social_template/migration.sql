-- Canonical wedding social template
--
-- Preserve the current Charity & Kudzie flagship experience as wedding-scoped
-- data before removing the remaining legacy component fallbacks.  Every row is
-- additive and uses DO NOTHING so a real edit can never be overwritten by this
-- migration.

-- Flagship media roles that were previously implied by repository filenames.
insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-hero-image', w.id, 'hero', 'imageUrl', '/hero-wedding.png', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-family-image', w.id, 'story', 'familyImageUrl', '/couple-silhouette.png', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

-- Gift / registry content that previously lived only inside gift-registry.tsx.
insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-registry-heading', w.id, 'registry', 'heading', 'With Gratitude', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-registry-subtitle', w.id, 'registry', 'subtitle', 'Your presence is the greatest gift. For those who wish to give more, here are a few ways.', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-registry-note', w.id, 'registry', 'culturalNote', 'In Shona tradition, it is customary to bring a small gift for the families. This is entirely optional — your presence is what truly matters.', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-registry-card-0', w.id, 'registry', 'card-0', 'Honeymoon to Victoria Falls & Cape Town', 0,
  json_build_object(
    'icon', 'plane',
    'description', 'Help us start our forever with the adventure of a lifetime.',
    'accent', 'gold',
    'cta', 'Contribute',
    'label', 'Raised so far',
    'raised', 2340,
    'goal', 5000,
    'progress', 47,
    'href', '#rsvp'
  )::text,
  now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-registry-card-1', w.id, 'registry', 'card-1', 'Musarurwa Family Foundation', 1,
  json_build_object(
    'icon', 'heart',
    'description', 'Supporting education for children in rural Zimbabwe — a cause close to our hearts.',
    'accent', 'clay',
    'cta', 'Donate',
    'label', 'Raised so far',
    'raised', 1820,
    'href', '#rsvp'
  )::text,
  now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-registry-card-2', w.id, 'registry', 'card-2', 'Registry at Boardmans & Mr. Price Home', 2,
  json_build_object(
    'icon', 'gift',
    'description', 'For those who prefer to give a tangible gift for our home.',
    'accent', 'sage',
    'cta', 'View Registry',
    'label', '',
    'raised', 0,
    'href', 'https://www.boardmans.co.za'
  )::text,
  now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

-- Public wedding-party editorial profiles. These are deliberately WeddingContent
-- records, NOT Guest rows: the private invitation/RSVP guest list remains a
-- separate operational data set and can never be surfaced by this section.
insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-party-0', w.id, 'guests', 'party-0', 'Tendai M.', 0,
  json_build_object(
    'id','tendai-m','role','Maid of Honor','side','bride','initials','TM','avatarColor','from-clay/30 via-clay/15 to-plum/20',
    'bio','Charity and Tendai met in primary school in Gweru and have been inseparable ever since — through boarding school, university, and now motherhood. She is the friend who remembers every birthday, shows up at 5am for every flight, and never lets Charity leave the house without earrings. On the wedding day she is the calm in the storm and the loudest cheer when Charity walks down the aisle.',
    'relationshipToCouple','Charity''s childhood best friend since primary school in Gweru',
    'likes',json_build_array('Gospel music','Baking lemon drizzle','Her daughter Tariro','Sunrise runs','Long phone calls'),
    'favoriteMemory','The night Charity called to say she had met "a kind one" — Tendai drove through the night from Gweru to Harare just to meet Kudzie over breakfast at Mugg & Bean, and left knowing her friend was in safe hands.',
    'favoriteSong','"Nzira Dzamusumo" — Oliver Mtukudzi',
    'quote','Charity, I have watched you become a woman, a mother, and now a wife. Kudzie — love her loud, love her well. May your home always be fuller than your plates.',
    'socialHandle','@tendai_m'
  )::text, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-party-1', w.id, 'guests', 'party-1', 'Takudzwa M.', 1,
  json_build_object(
    'id','takudzwa-m','role','Best Man','side','groom','initials','TM','avatarColor','from-sage/30 via-sage/15 to-espresso/20',
    'bio','Kudzie''s older brother by four years and the one who taught him to drive, to braai, and to never arrive at a function empty-handed. Takudzwa took Charity aside the day after lobola negotiations and told her, simply, ''Welcome home, sisi.'' He keeps the speeches running on time and the groom''s nerves in check.',
    'relationshipToCouple','Kudzie''s older brother — the family''s first welcome to Charity',
    'likes',json_build_array('Saturday braais','Chelsea FC','Dad jokes','Single malt','Vintage Land Rovers'),
    'favoriteMemory','Teaching Kudzie to braai the perfect wors at sixteen — Kudzie burnt the first batch, salted the second, and got it right on the third. Takudzwa still tells this story at every family gathering.',
    'favoriteSong','"Neria" — Oliver Mtukudzi',
    'quote','Kudzie, my little brother — you found a woman who laughs at your jokes and rolls her eyes at the same time. That is love. Charity, welcome to the madness. We are loud, we are many, and we are yours now.',
    'socialHandle','@takudzwa_m'
  )::text, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-party-2', w.id, 'guests', 'party-2', 'Rumbidzai C.', 2,
  json_build_object(
    'id','rumbidzai-c','role','Bridesmaid','side','bride','initials','RC','avatarColor','from-plum/25 via-clay/15 to-gold/15',
    'bio','Charity and Rumbidzai shared a tiny room at UZ and survived on two-minute noodles, late-night anatomy flashcards, and one shared kettle. Today Rumbi is a doctor at Parirenyatwa and still the first person Charity texts when anything — medical or emotional — goes wrong.',
    'relationshipToCouple','Charity''s university roommate at UZ, now a doctor in Harare',
    'likes',json_build_array('Trail hiking in Nyanga','Live jazz at Reps Theatre','Her two cats Simba & Nala','Strong coffee','Cookbooks she never cooks from'),
    'favoriteMemory','Final-year exams at UZ — Rumbi quizzed Charity on every gospel song title until 3am to keep her awake through pharmacology. They both passed. Neither has slept properly since.',
    'favoriteSong','"Mhondoro" — Mokoomba',
    'quote','Charity, you married your best friend. Kudzie, you married mine — please handle with care. Wishing you a lifetime of small joys and big laughter.',
    'socialHandle','@dr.rumbi'
  )::text, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-party-3', w.id, 'guests', 'party-3', 'Chiedza K.', 3,
  json_build_object(
    'id','chiedza-k','role','Bridesmaid','side','bride','initials','CK','avatarColor','from-clay/25 via-gold/15 to-plum/20',
    'bio','Charity''s cousin on her mother''s side and the family''s in-house fashion designer. Chiedza designed and stitched Charity''s traditional roora outfit by hand, and has been gently re-cutting the bridesmaid dresses at midnight for the last three weeks. She believes every wedding needs a little drama and a lot of colour.',
    'relationshipToCouple','Charity''s cousin — the family''s fashion designer',
    'likes',json_build_array('Sewing at midnight','Afrobeats on full volume','Plantain chips','Ankara prints','Vintage sewing machines'),
    'favoriteMemory','Fitting Charity''s roora dress at 2am the night before negotiations — Charity was so nervous she could not stand still, so Chiedza pinned the hem while Charity paced. The dress was perfect. The hem stayed.',
    'favoriteSong','"Essence" — Wizkid ft. Tems',
    'quote','Cousin, you wear love beautifully. Kudzie, you married the best dressed woman in the family — we will be checking on her. Joy, joy, joy.',
    'socialHandle','@chiedza.designs'
  )::text, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-party-4', w.id, 'guests', 'party-4', 'Munashe M.', 4,
  json_build_object(
    'id','munashe-m','role','Groomsman','side','groom','initials','MM','avatarColor','from-sage/25 via-gold/15 to-espresso/15',
    'bio','Kudzie and Munashe met on their first day at the same consulting firm in Harare and have been closing deals and braai-ing weekends together ever since. He is the friend who plans the bachelor party down to the minute, then changes the entire plan on the day because the vibe is off.',
    'relationshipToCouple','Kudzie''s best friend from work — the life of every party',
    'likes',json_build_array('Saturday cricket at Harare Sports Club','Long braais','Old school kwaito','Craft beer','Spontaneous road trips to Kariba'),
    'favoriteMemory','A work trip to Victoria Falls that turned into a 48-hour detour — Munashe convinced Kudzie to skip the return flight and drive back through Hwange. They made the Monday meeting. Barely.',
    'favoriteSong','"Ghetto" — Brenda Fassie',
    'quote','Kudzie, you married up. Charity, you married the most loyal man I know — and I have known him a long time. Dance with us tonight, the floor is yours.',
    'socialHandle','@muna_she'
  )::text, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-party-5', w.id, 'guests', 'party-5', 'Kudakwashe N.', 5,
  json_build_object(
    'id','kudakwashe-n','role','Groomsman','side','groom','initials','KN','avatarColor','from-sage/20 via-plum/15 to-gold/15',
    'bio','Kudzie''s oldest friend from Bulawayo — they met at thirteen playing football barefoot on a dust pitch and have stayed brothers through every city and season since. Kuda is quiet until he is on a dance floor, at which point he is the loudest person in the room.',
    'relationshipToCouple','Kudzie''s childhood friend from Bulawayo',
    'likes',json_build_array('Classic cars','Gospel on Sunday mornings','His vintage record collection','Isitshwala & beef stew','Long drives with no destination'),
    'favoriteMemory','The day Kudzie called to say he was going to be a father — Kuda drove through the night from Bulawayo to Harare with a teddy bear on the passenger seat and a record under his arm. Norioshona still has the bear.',
    'favoriteSong','"Scatterlings of Africa" — Johnny Clegg',
    'quote','My brother — you built this family with your hands and your heart. Charity, you completed it. From Bulawayo to Harare, we celebrate you tonight.',
    'socialHandle','@kuda_n'
  )::text, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-party-6', w.id, 'guests', 'party-6', 'Narasora M.', 6,
  json_build_object(
    'id','narasora-m','role','Flower Girl','side','family','initials','NM','avatarColor','from-gold/30 via-clay/15 to-plum/15',
    'bio','Charity and Kudzie''s five-year-old daughter and the chief flower scatterer of the day. Narasora has been practising her walk down the aisle in the lounge for six months — slowly, with petals, with great seriousness — and has informed her parents that she will also be doing a small curtsy at the end.',
    'relationshipToCouple','Charity & Kudzie''s daughter, 5 years old',
    'likes',json_build_array('Butterflies','Her teddy "Mr. Bear"','Dancing to Disney songs','Pink ice cream','Helping mommy pick shoes'),
    'favoriteMemory','The night Daddy proposed — Narasora was supposed to be asleep but crept out in her pyjamas to "see the ring." She got to wear it on her thumb for one minute. She still talks about it.',
    'favoriteSong','"How Far I''ll Go" — Moana',
    'quote','Mommy, you look like a princess. Daddy, you look like a prince. Can we have cake now?',
    'isKid',true,
    'kidFunFact','Narasora has named every butterfly in the Imba Manor garden — her favourite is a small orange one she calls ''Sunshine.'' She plans to invite Sunshine to the wedding.'
  )::text, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-party-7', w.id, 'guests', 'party-7', 'Norioshona M.', 7,
  json_build_object(
    'id','norioshona-m','role','Ring Bearer','side','family','initials','NM','avatarColor','from-gold/25 via-sage/15 to-espresso/15',
    'bio','Charity and Kudzie''s seven-year-old son and the very proud ring bearer. Norioshona takes his duties seriously: he has been carrying the ring box around the house for a week (empty, his parents keep insisting) and has a secret handshake ready for his dad at the altar.',
    'relationshipToCouple','Charity & Kudzie''s son, 7 years old',
    'likes',json_build_array('Football','Dinosaurs (especially T-Rex)','Helping Dad fix things','Sadza & chicken','Reading about space'),
    'favoriteMemory','The day Daddy let him "help" change a tyre — Norioshona held one bolt, very importantly, and was paid in a cream soda. He told everyone at school the next day that he is now a mechanic.',
    'favoriteSong','"Waka Waka" — Shakira',
    'quote','I will carry the rings and not drop them. I promise. Daddy said I can have extra cake if I don''t. I won''t drop them.',
    'isKid',true,
    'kidFunFact','Norioshona can name fifteen dinosaurs in order of size and will correct you if you get it wrong. He is currently negotiating a pet velociraptor.'
  )::text, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

-- Preserve the existing flagship cultural guide as public editorial content.
insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-guide-heading', w.id, 'guests', 'guideHeading', 'Cultural Guide', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-guide-subtitle', w.id, 'guests', 'guideSubtitle', 'For our guests joining from near and far — a warm introduction to Zimbabwean wedding traditions.', 0, null, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-guide-0', w.id, 'guests', 'guide-0', 'Shona Wedding Traditions', 0,
  json_build_object('content','A traditional Shona wedding includes the roora (bridewealth) process, where the groom''s family presents gifts to the bride''s family as a sign of respect and gratitude. The magumo (gifts) are negotiated between families and symbolise the joining of two families, not just two people. The ceremony often includes traditional dancing, singing, and the sharing of food as a communal celebration of love and unity.')::text, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-guide-1', w.id, 'guests', 'guide-1', 'What to Wear', 1,
  json_build_object('content','The dress code is Formal / Black Tie Optional. Traditional Zimbabwean attire is warmly welcomed — for women, this might include elegant African-print dresses or wraps; for men, a smart safari suit or traditional shirt. Harare weddings tend to be stylish affairs — think bold colours, beautiful fabrics, and expressive personal style. Comfortable shoes are recommended as there will be dancing!')::text, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-guide-2', w.id, 'guests', 'guide-2', 'Zimbabwean Cuisine', 2,
  json_build_object('content','The menu will feature a blend of traditional and contemporary dishes. Expect sadza (maize meal porridge, a Zimbabwean staple) served with nyama (meat — beef, chicken, or goat), madora (dried caterpillars, a local delicacy), muriwo (leafy green vegetables), and peanut butter dishes. Vegetarian and international options will also be available. The wedding cake is a centrepiece — often a rich fruit cake symbolising prosperity and fertility.')::text, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;

insert into "WeddingContent" ("id", "weddingId", "section", "field", "value", "order", "metadata", "updatedAt")
select 'canon-charity-guide-3', w.id, 'guests', 'guide-3', 'Useful Shona Phrases', 3,
  json_build_object('content','Mangwanani — Good morning | Masikati — Good afternoon | Maita basa — Thank you for the work (a deep expression of gratitude) | Makorokoto — Congratulations | Munhu wese munhu — Every person is a person (unity) | Tine base — We have work/a role (encouragement) | Kumbirai ruregerero — Please forgive me | Ndatenda — Thank you. Don''t worry about perfect pronunciation — your effort to try will be deeply appreciated!')::text, now()
from "Wedding" w where w.slug = 'charity-and-kudzie'
on conflict ("weddingId", "section", "field") do nothing;
