/**
 * wewed — Bridal Party Data
 * ----------------------------------------------------------------------------
 * Enriched profiles for the 8 members of Charity & Kudzie's wedding party.
 * Used by:
 *   - <Guests />               (the wedding-party grid + cultural guide section)
 *   - <BridalProfileModal />   (the rich profile dialog opened from those cards)
 *
 * Bios are written to feel authentic to a Harare wedding — local schools,
 * foods, music, sports, and family culture. Photos are placeholders: the
 * modal renders initials in elegant serif on a coloured gradient.
 */

export type BridalSide = 'bride' | 'groom' | 'family'

export interface BridalPartyMember {
  id: string
  name: string
  /** "Maid of Honor", "Best Man", "Bridesmaid", "Groomsman", "Flower Girl", "Ring Bearer" */
  role: string
  /** bride | groom | family (kids are family) */
  side: BridalSide
  /** 2-letter initials for the avatar */
  initials: string
  /** Tailwind gradient classes for the avatar background, e.g. "from-clay/30 to-plum/30" */
  avatarColor: string
  /** 2-3 sentence bio about who they are */
  bio: string
  /** e.g. "Charity's childhood best friend" */
  relationshipToCouple: string
  /** chips/tags of things they love */
  likes: string[]
  /** a memory they share with the couple */
  favoriteMemory: string
  /** their dance-floor anthem */
  favoriteSong: string
  /** a short toast / message to the couple */
  quote: string
  /** optional social handle e.g. "@tendai_m" */
  socialHandle?: string
  /** kids (flower girl / ring bearer) */
  isKid?: boolean
  /** for Narasora & Norioshona — playful kid fun fact */
  kidFunFact?: string
}

export const BRIDAL_PARTY: BridalPartyMember[] = [
  {
    id: 'tendai-m',
    name: 'Tendai M.',
    role: 'Maid of Honor',
    side: 'bride',
    initials: 'TM',
    avatarColor: 'from-clay/30 via-clay/15 to-plum/20',
    bio: 'Charity and Tendai met in primary school in Gweru and have been inseparable ever since — through boarding school, university, and now motherhood. She is the friend who remembers every birthday, shows up at 5am for every flight, and never lets Charity leave the house without earrings. On the wedding day she is the calm in the storm and the loudest cheer when Charity walks down the aisle.',
    relationshipToCouple: "Charity's childhood best friend since primary school in Gweru",
    likes: ['Gospel music', 'Baking lemon drizzle', 'Her daughter Tariro', 'Sunrise runs', 'Long phone calls'],
    favoriteMemory:
      'The night Charity called to say she had met "a kind one" — Tendai drove through the night from Gweru to Harare just to meet Kudzie over breakfast at Mugg & Bean, and left knowing her friend was in safe hands.',
    favoriteSong: '"Nzira Dzamusumo" — Oliver Mtukudzi',
    quote: 'Charity, I have watched you become a woman, a mother, and now a wife. Kudzie — love her loud, love her well. May your home always be fuller than your plates.',
    socialHandle: '@tendai_m',
  },
  {
    id: 'takudzwa-m',
    name: 'Takudzwa M.',
    role: 'Best Man',
    side: 'groom',
    initials: 'TM',
    avatarColor: 'from-sage/30 via-sage/15 to-espresso/20',
    bio: "Kudzie's older brother by four years and the one who taught him to drive, to braai, and to never arrive at a function empty-handed. Takudzwa took Charity aside the day after lobola negotiations and told her, simply, 'Welcome home, sisi.' He keeps the speeches running on time and the groom's nerves in check.",
    relationshipToCouple: "Kudzie's older brother — the family's first welcome to Charity",
    likes: ['Saturday braais', 'Chelsea FC', 'Dad jokes', 'Single malt', 'Vintage Land Rovers'],
    favoriteMemory:
      "Teaching Kudzie to braai the perfect wors at sixteen — Kudzie burnt the first batch, salted the second, and got it right on the third. Takudzwa still tells this story at every family gathering.",
    favoriteSong: '"Neria" — Oliver Mtukudzi',
    quote: 'Kudzie, my little brother — you found a woman who laughs at your jokes and rolls her eyes at the same time. That is love. Charity, welcome to the madness. We are loud, we are many, and we are yours now.',
    socialHandle: '@takudzwa_m',
  },
  {
    id: 'rumbidzai-c',
    name: 'Rumbidzai C.',
    role: 'Bridesmaid',
    side: 'bride',
    initials: 'RC',
    avatarColor: 'from-plum/25 via-clay/15 to-gold/15',
    bio: 'Charity and Rumbidzai shared a tiny room at UZ and survived on two-minute noodles, late-night anatomy flashcards, and one shared kettle. Today Rumbi is a doctor at Parirenyatwa and still the first person Charity texts when anything — medical or emotional — goes wrong.',
    relationshipToCouple: "Charity's university roommate at UZ, now a doctor in Harare",
    likes: ['Trail hiking in Nyanga', 'Live jazz at Reps Theatre', 'Her two cats Simba & Nala', 'Strong coffee', 'Cookbooks she never cooks from'],
    favoriteMemory:
      "Final-year exams at UZ — Rumbi quizzed Charity on every gospel song title until 3am to keep her awake through pharmacology. They both passed. Neither has slept properly since.",
    favoriteSong: '"Mhondoro" — Mokoomba',
    quote: 'Charity, you married your best friend. Kudzie, you married mine — please handle with care. Wishing you a lifetime of small joys and big laughter.',
    socialHandle: '@dr.rumbi',
  },
  {
    id: 'chiedza-k',
    name: 'Chiedza K.',
    role: 'Bridesmaid',
    side: 'bride',
    initials: 'CK',
    avatarColor: 'from-clay/25 via-gold/15 to-plum/20',
    bio: "Charity's cousin on her mother's side and the family's in-house fashion designer. Chiedza designed and stitched Charity's traditional roora outfit by hand, and has been gently re-cutting the bridesmaid dresses at midnight for the last three weeks. She believes every wedding needs a little drama and a lot of colour.",
    relationshipToCouple: "Charity's cousin — the family's fashion designer",
    likes: ['Sewing at midnight', 'Afrobeats on full volume', 'Plantain chips', 'Ankara prints', 'Vintage sewing machines'],
    favoriteMemory:
      "Fitting Charity's roora dress at 2am the night before negotiations — Charity was so nervous she could not stand still, so Chiedza pinned the hem while Charity paced. The dress was perfect. The hem stayed.",
    favoriteSong: '"Essence" — Wizkid ft. Tems',
    quote: 'Cousin, you wear love beautifully. Kudzie, you married the best dressed woman in the family — we will be checking on her. Joy, joy, joy.',
    socialHandle: '@chiedza.designs',
  },
  {
    id: 'munashe-m',
    name: 'Munashe M.',
    role: 'Groomsman',
    side: 'groom',
    initials: 'MM',
    avatarColor: 'from-sage/25 via-gold/15 to-espresso/15',
    bio: "Kudzie and Munashe met on their first day at the same consulting firm in Harare and have been closing deals and braai-ing weekends together ever since. He is the friend who plans the bachelor party down to the minute, then changes the entire plan on the day because the vibe is off.",
    relationshipToCouple: "Kudzie's best friend from work — the life of every party",
    likes: ['Saturday cricket at Harare Sports Club', 'Long braais', 'Old school kwaito', 'Craft beer', 'Spontaneous road trips to Kariba'],
    favoriteMemory:
      "A work trip to Victoria Falls that turned into a 48-hour detour — Munashe convinced Kudzie to skip the return flight and drive back through Hwange. They made the Monday meeting. Barely.",
    favoriteSong: '"Ghetto" — Brenda Fassie',
    quote: 'Kudzie, you married up. Charity, you married the most loyal man I know — and I have known him a long time. Dance with us tonight, the floor is yours.',
    socialHandle: '@muna_she',
  },
  {
    id: 'kudakwashe-n',
    name: 'Kudakwashe N.',
    role: 'Groomsman',
    side: 'groom',
    initials: 'KN',
    avatarColor: 'from-sage/20 via-plum/15 to-gold/15',
    bio: "Kudzie's oldest friend from Bulawayo — they met at thirteen playing football barefoot on a dust pitch and have stayed brothers through every city and season since. Kuda is quiet until he is on a dance floor, at which point he is the loudest person in the room.",
    relationshipToCouple: "Kudzie's childhood friend from Bulawayo",
    likes: ['Classic cars', 'Gospel on Sunday mornings', 'His vintage record collection', 'Isitshwala & beef stew', 'Long drives with no destination'],
    favoriteMemory:
      "The day Kudzie called to say he was going to be a father — Kuda drove through the night from Bulawayo to Harare with a teddy bear on the passenger seat and a record under his arm. Norioshona still has the bear.",
    favoriteSong: '"Scatterlings of Africa" — Johnny Clegg',
    quote: 'My brother — you built this family with your hands and your heart. Charity, you completed it. From Bulawayo to Harare, we celebrate you tonight.',
    socialHandle: '@kuda_n',
  },
  {
    id: 'narasora-m',
    name: 'Narasora M.',
    role: 'Flower Girl',
    side: 'family',
    initials: 'NM',
    avatarColor: 'from-gold/30 via-clay/15 to-plum/15',
    bio: "Charity and Kudzie's five-year-old daughter and the chief flower scatterer of the day. Narasora has been practising her walk down the aisle in the lounge for six months — slowly, with petals, with great seriousness — and has informed her parents that she will also be doing a small curtsy at the end.",
    relationshipToCouple: 'Charity & Kudzie\'s daughter, 5 years old',
    likes: ['Butterflies', 'Her teddy "Mr. Bear"', 'Dancing to Disney songs', 'Pink ice cream', 'Helping mommy pick shoes'],
    favoriteMemory:
      'The night Daddy proposed — Narasora was supposed to be asleep but crept out in her pyjamas to "see the ring." She got to wear it on her thumb for one minute. She still talks about it.',
    favoriteSong: '"How Far I\'ll Go" — Moana',
    quote: 'Mommy, you look like a princess. Daddy, you look like a prince. Can we have cake now?',
    isKid: true,
    kidFunFact:
      "Narasora has named every butterfly in the Imba Manor garden — her favourite is a small orange one she calls 'Sunshine.' She plans to invite Sunshine to the wedding.",
  },
  {
    id: 'norioshona-m',
    name: 'Norioshona M.',
    role: 'Ring Bearer',
    side: 'family',
    initials: 'NM',
    avatarColor: 'from-gold/25 via-sage/15 to-espresso/15',
    bio: "Charity and Kudzie's seven-year-old son and the very proud ring bearer. Norioshona takes his duties seriously: he has been carrying the ring box around the house for a week (empty, his parents keep insisting) and has a secret handshake ready for his dad at the altar.",
    relationshipToCouple: 'Charity & Kudzie\'s son, 7 years old',
    likes: ['Football', 'Dinosaurs (especially T-Rex)', 'Helping Dad fix things', 'Sadza & chicken', 'Reading about space'],
    favoriteMemory:
      'The day Daddy let him "help" change a tyre — Norioshona held one bolt, very importantly, and was paid in a cream soda. He told everyone at school the next day that he is now a mechanic.',
    favoriteSong: '"Waka Waka" — Shakira',
    quote: "I will carry the rings and not drop them. I promise. Daddy said I can have extra cake if I don't. I won't drop them.",
    isKid: true,
    kidFunFact:
      "Norioshona can name fifteen dinosaurs in order of size and will correct you if you get it wrong. He is currently negotiating a pet velociraptor.",
  },
]

/** Convenience helper — get a member by id. Returns undefined if not found. */
export function getBridalMemberById(id: string): BridalPartyMember | undefined {
  return BRIDAL_PARTY.find((m) => m.id === id)
}

/** Convenience helper — cycle to the next member (wraps around). */
export function getNextBridalIndex(index: number): number {
  return (index + 1) % BRIDAL_PARTY.length
}

/** Convenience helper — cycle to the previous member (wraps around). */
export function getPrevBridalIndex(index: number): number {
  return (index - 1 + BRIDAL_PARTY.length) % BRIDAL_PARTY.length
}
