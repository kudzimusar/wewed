export type ProviderFieldType = 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'checkboxes' | 'boolean'

export type ProviderCategory = {
  value: string
  label: string
  singular: string
  description: string
  featured?: boolean
}

export type ProviderFieldDefinition = {
  key: string
  label: string
  type: ProviderFieldType
  help?: string
  required?: boolean
  options?: readonly string[]
  min?: number
  max?: number
  unit?: string
}

export const PROVIDER_CATEGORIES = [
  { value: 'venue', label: 'Venues', singular: 'Venue', description: 'Gardens, hotels, halls and destination spaces', featured: true },
  { value: 'planning', label: 'Wedding planners', singular: 'Wedding planner', description: 'Planning, coordination and wedding-day management' },
  { value: 'photography', label: 'Photographers', singular: 'Photographer', description: 'Wedding photography and albums', featured: true },
  { value: 'videography', label: 'Videographers & livestreaming', singular: 'Videographer', description: 'Wedding films, livestreaming and aerial coverage' },
  { value: 'florals', label: 'Florists', singular: 'Florist', description: 'Bouquets, installations and floral styling', featured: true },
  { value: 'catering', label: 'Caterers', singular: 'Caterer', description: 'Menus, service teams and dining experiences', featured: true },
  { value: 'cakes', label: 'Wedding cakes & desserts', singular: 'Cake designer', description: 'Wedding cakes, dessert tables and favours', featured: true },
  { value: 'entertainment', label: 'Entertainment', singular: 'Entertainment provider', description: 'DJs, bands, MCs and performers', featured: true },
  { value: 'decor-rentals', label: 'Décor & rentals', singular: 'Décor and rentals provider', description: 'Décor, furniture, linen and event rentals', featured: true },
  { value: 'beauty', label: 'Hair & makeup', singular: 'Hair and makeup provider', description: 'Bridal beauty, grooming and styling' },
  { value: 'attire', label: 'Attire & tailoring', singular: 'Attire provider', description: 'Bridal wear, formalwear and tailoring' },
  { value: 'transport', label: 'Transport & car hire', singular: 'Transport provider', description: 'Wedding transport, shuttles and car hire' },
  { value: 'stationery', label: 'Stationery & signage', singular: 'Stationery provider', description: 'Invitations, menus, signage and printed details' },
  { value: 'officiants', label: 'Officiants & celebrants', singular: 'Officiant or celebrant', description: 'Ceremony officiation and celebrancy' },
  { value: 'jewellery', label: 'Jewellery & accessories', singular: 'Jewellery provider', description: 'Wedding rings, jewellery and accessories' },
  { value: 'accommodation-travel', label: 'Accommodation & travel', singular: 'Accommodation or travel provider', description: 'Guest stays, travel and destination support' },
  { value: 'tents-marquees', label: 'Tents & marquees', singular: 'Tent and marquee provider', description: 'Marquees, tents, flooring and temporary structures' },
  { value: 'lighting-av', label: 'Lighting, sound & AV', singular: 'Lighting and AV provider', description: 'Production, lighting, staging and sound' },
  { value: 'bar-beverages', label: 'Bars & beverages', singular: 'Bar and beverage provider', description: 'Mobile bars, drinks and beverage service' },
  { value: 'photo-booth', label: 'Photo booths', singular: 'Photo booth provider', description: 'Photo booths, props and guest keepsakes' },
  { value: 'content-creation', label: 'Wedding content creators', singular: 'Wedding content creator', description: 'Short-form wedding content and rapid delivery' },
  { value: 'gifts-favours', label: 'Gifts & favours', singular: 'Gift and favour provider', description: 'Guest favours, gifts and personalised items' },
  { value: 'choreography', label: 'Dance & choreography', singular: 'Choreographer', description: 'First-dance lessons and choreography' },
  { value: 'security', label: 'Security', singular: 'Security provider', description: 'Event security, access control and stewarding' },
  { value: 'childcare', label: 'Wedding childcare', singular: 'Wedding childcare provider', description: 'On-site childcare and children’s activities' },
  { value: 'cleaning-sanitation', label: 'Cleaning & sanitation', singular: 'Cleaning and sanitation provider', description: 'Event cleaning, washrooms and sanitation support' },
  { value: 'other', label: 'Other wedding services', singular: 'Wedding service provider', description: 'A wedding service not listed above' },
] as const satisfies readonly ProviderCategory[]

export const PROVIDER_CATEGORY_VALUES = new Set(PROVIDER_CATEGORIES.map((category) => category.value))

export const SERVICE_AREA_OPTIONS = [
  'Harare',
  'Bulawayo',
  'Mutare',
  'Gweru',
  'Masvingo',
  'Victoria Falls',
  'Zimbabwe nationwide',
  'Southern Africa',
  'Regional / destination',
] as const

export const LANGUAGE_OPTIONS = ['English', 'Shona', 'Ndebele', 'French', 'Portuguese', 'Afrikaans', 'Other'] as const
export const PAYMENT_METHOD_OPTIONS = ['Cash', 'Bank transfer', 'Card', 'Mobile money', 'Payment plan', 'Other'] as const
export const WEDDING_STYLE_OPTIONS = ['Modern', 'Classic', 'Romantic', 'Luxury', 'Garden', 'Traditional', 'Minimalist', 'Destination', 'Cultural', 'Rustic', 'Editorial', 'Bohemian'] as const

const YES_NO = ['Yes', 'No'] as const

export const PROVIDER_SERVICE_FIELDS: Record<string, readonly ProviderFieldDefinition[]> = {
  venue: [
    { key: 'seatedCapacity', label: 'Maximum seated capacity', type: 'number', min: 1, max: 10000, required: true, unit: 'guests' },
    { key: 'standingCapacity', label: 'Maximum standing capacity', type: 'number', min: 1, max: 15000, unit: 'guests' },
    { key: 'spaces', label: 'Available spaces', type: 'checkboxes', options: ['Indoor ceremony', 'Outdoor ceremony', 'Reception hall', 'Garden', 'Rooftop', 'Bridal suite', 'Groom suite', 'Accommodation'] },
    { key: 'venueAmenities', label: 'Amenities and infrastructure', type: 'checkboxes', options: ['Parking', 'Accessible entrance', 'Accessible washroom', 'Backup power', 'Security', 'Furniture', 'Kitchen', 'Bar', 'Wi-Fi', 'Air conditioning'] },
    { key: 'cateringPolicy', label: 'Catering policy', type: 'select', options: ['In-house only', 'Approved caterers', 'External caterers allowed', 'Flexible / by agreement'] },
    { key: 'barPolicy', label: 'Bar and beverage policy', type: 'select', options: ['In-house only', 'Corkage applies', 'External bar allowed', 'Alcohol-free venue', 'Flexible / by agreement'] },
    { key: 'curfew', label: 'Event curfew', type: 'text', help: 'Example: 11:00 PM or no fixed curfew.' },
    { key: 'weatherPlan', label: 'Wet-weather contingency', type: 'textarea' },
    { key: 'setupWindow', label: 'Supplier setup window', type: 'text' },
  ],
  planning: [
    { key: 'planningTypes', label: 'Planning services', type: 'checkboxes', options: ['Full planning', 'Partial planning', 'Month-of coordination', 'Wedding-day coordination', 'Consultation', 'Destination planning'] },
    { key: 'completedWeddings', label: 'Weddings completed', type: 'number', min: 0, max: 10000 },
    { key: 'supportedBudgets', label: 'Supported wedding budgets', type: 'multiselect', options: ['Under USD 5,000', 'USD 5,000–15,000', 'USD 15,000–30,000', 'USD 30,000–75,000', 'USD 75,000+', 'By consultation'] },
    { key: 'consultationProcess', label: 'Consultation process', type: 'textarea' },
    { key: 'feeModel', label: 'Fee model', type: 'select', options: ['Fixed package', 'Percentage of budget', 'Hourly / consultation', 'Custom proposal'] },
    { key: 'teamStructure', label: 'Team structure', type: 'textarea' },
    { key: 'referencesAvailable', label: 'Client references available', type: 'select', options: YES_NO },
  ],
  photography: [
    { key: 'photographyStyles', label: 'Photography styles', type: 'checkboxes', options: ['Documentary', 'Editorial', 'Fine art', 'Traditional', 'Candid', 'Film-inspired', 'Flash photography'] },
    { key: 'coverageHours', label: 'Maximum coverage hours', type: 'number', min: 1, max: 48, unit: 'hours' },
    { key: 'shooters', label: 'Photographers included', type: 'number', min: 1, max: 20 },
    { key: 'editedImages', label: 'Typical edited image count', type: 'number', min: 1, max: 10000 },
    { key: 'turnaround', label: 'Typical delivery time', type: 'text' },
    { key: 'deliverables', label: 'Available deliverables', type: 'checkboxes', options: ['Online gallery', 'USB / drive', 'Prints', 'Album', 'Same-day preview', 'Engagement session', 'Drone stills'] },
    { key: 'rawFilePolicy', label: 'RAW file policy', type: 'select', options: ['Not supplied', 'Available at extra cost', 'Included in selected packages', 'By agreement'] },
    { key: 'backupEquipment', label: 'Backup equipment available', type: 'select', options: YES_NO },
  ],
  videography: [
    { key: 'filmStyles', label: 'Film styles', type: 'checkboxes', options: ['Cinematic', 'Documentary', 'Short highlight', 'Full ceremony', 'Same-day edit', 'Social-first vertical content'] },
    { key: 'coverageHours', label: 'Maximum coverage hours', type: 'number', min: 1, max: 48, unit: 'hours' },
    { key: 'cameraOperators', label: 'Camera operators included', type: 'number', min: 1, max: 20 },
    { key: 'turnaround', label: 'Typical delivery time', type: 'text' },
    { key: 'livestreaming', label: 'Livestreaming available', type: 'select', options: YES_NO },
    { key: 'drone', label: 'Drone coverage available', type: 'select', options: ['Yes, subject to permissions', 'No'] },
    { key: 'audioCoverage', label: 'Audio coverage', type: 'checkboxes', options: ['Ceremony vows', 'Speeches', 'Ambient audio', 'External recorder', 'Wireless microphones'] },
  ],
  florals: [
    { key: 'flowerTypes', label: 'Flower types', type: 'checkboxes', options: ['Fresh', 'Dried', 'Artificial', 'Locally grown', 'Imported', 'Mixed'] },
    { key: 'floralServices', label: 'Floral services', type: 'checkboxes', options: ['Bouquets', 'Buttonholes', 'Centrepieces', 'Ceremony arch', 'Large installations', 'Aisle styling', 'Cake flowers', 'Setup', 'Teardown'] },
    { key: 'minimumSpend', label: 'Minimum floral spend', type: 'number', min: 0, max: 10000000 },
    { key: 'consultations', label: 'Design consultations', type: 'select', options: ['Included', 'Paid consultation', 'Virtual only', 'In-person and virtual'] },
    { key: 'seasonalSubstitution', label: 'Seasonal substitution policy', type: 'textarea' },
    { key: 'leadTime', label: 'Recommended booking lead time', type: 'text' },
  ],
  catering: [
    { key: 'cuisines', label: 'Cuisine specialities', type: 'multiselect', options: ['Zimbabwean', 'Southern African', 'Pan-African', 'European', 'Indian', 'Middle Eastern', 'Asian', 'Fusion', 'Other'] },
    { key: 'serviceStyles', label: 'Service styles', type: 'checkboxes', options: ['Buffet', 'Plated', 'Family-style', 'Canapés', 'Food stations', 'Braai', 'Drop-off catering'] },
    { key: 'dietarySupport', label: 'Dietary support', type: 'checkboxes', options: ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Nut-aware', 'Halal', 'Kosher by arrangement', 'Allergy-managed menus'] },
    { key: 'minimumGuests', label: 'Minimum guest count', type: 'number', min: 1, max: 10000 },
    { key: 'maximumGuests', label: 'Maximum guest count', type: 'number', min: 1, max: 20000 },
    { key: 'tastings', label: 'Menu tastings', type: 'select', options: ['Included', 'Paid', 'Available after booking', 'Not available'] },
    { key: 'includedEquipment', label: 'Equipment and staffing', type: 'checkboxes', options: ['Service staff', 'Chefs', 'Crockery', 'Cutlery', 'Glassware', 'Table linen', 'Mobile kitchen', 'Beverage service'] },
    { key: 'foodSafety', label: 'Food-safety certification', type: 'select', options: ['Verified', 'Available for review', 'In progress', 'Not provided'] },
  ],
  cakes: [
    { key: 'cakeStyles', label: 'Cake styles', type: 'checkboxes', options: ['Classic tiered', 'Modern', 'Rustic', 'Buttercream', 'Fondant', 'Naked / semi-naked', 'Sculpted', 'Cupcake tower', 'Dessert table'] },
    { key: 'tierRange', label: 'Tier range', type: 'text', help: 'Example: 1–6 tiers.' },
    { key: 'servingMinimum', label: 'Minimum servings', type: 'number', min: 1, max: 10000 },
    { key: 'servingMaximum', label: 'Maximum servings', type: 'number', min: 1, max: 20000 },
    { key: 'flavours', label: 'Popular flavours', type: 'multiselect', options: ['Vanilla', 'Chocolate', 'Red velvet', 'Carrot', 'Lemon', 'Fruit cake', 'Coconut', 'Coffee', 'Custom flavours'] },
    { key: 'dietaryOptions', label: 'Dietary and allergy options', type: 'checkboxes', options: ['Vegan', 'Gluten-free', 'Dairy-free', 'Egg-free', 'Nut-aware', 'Sugar-reduced', 'Alcohol-free'] },
    { key: 'tastings', label: 'Cake tastings', type: 'select', options: ['Included', 'Paid', 'Available after booking', 'Not available'] },
    { key: 'deliverySetup', label: 'Delivery and setup', type: 'checkboxes', options: ['Delivery', 'Venue setup', 'Cake stand hire', 'Fresh flower placement', 'Dessert table setup'] },
    { key: 'pricingMethod', label: 'Pricing method', type: 'select', options: ['Per serving', 'Per tier', 'Design quotation', 'Package pricing'] },
    { key: 'leadTime', label: 'Recommended booking lead time', type: 'text' },
  ],
  entertainment: [
    { key: 'performerTypes', label: 'Entertainment types', type: 'checkboxes', options: ['DJ', 'Live band', 'MC', 'Solo musician', 'Choir', 'Traditional performers', 'Dancers', 'Comedian', 'Other'] },
    { key: 'groupSize', label: 'Typical group size', type: 'text' },
    { key: 'performanceDuration', label: 'Performance duration', type: 'text' },
    { key: 'equipment', label: 'Equipment supplied', type: 'checkboxes', options: ['PA system', 'Microphones', 'DJ console', 'Lighting', 'Stage', 'Generator / backup power', 'Instruments'] },
    { key: 'playlistRequests', label: 'Playlist or repertoire requests', type: 'select', options: ['Welcome', 'Limited', 'Curated with the couple', 'Fixed repertoire'] },
    { key: 'overtime', label: 'Overtime availability', type: 'select', options: ['Available', 'Not available', 'By agreement'] },
    { key: 'technicalRequirements', label: 'Stage, power and sound requirements', type: 'textarea' },
  ],
  'decor-rentals': [
    { key: 'inventory', label: 'Inventory categories', type: 'checkboxes', options: ['Tables', 'Chairs', 'Linen', 'Tableware', 'Backdrops', 'Arches', 'Lighting', 'Dance floor', 'Lounge furniture', 'Props', 'Signage', 'Tents'] },
    { key: 'designServices', label: 'Design and styling services', type: 'checkboxes', options: ['Concept design', 'Mood boards', 'Venue styling', 'Setup', 'Teardown', 'Custom fabrication'] },
    { key: 'deliveryRadius', label: 'Standard delivery radius', type: 'number', min: 0, max: 5000, unit: 'km' },
    { key: 'damageDeposit', label: 'Damage deposit policy', type: 'textarea' },
    { key: 'replacementPolicy', label: 'Loss and replacement policy', type: 'textarea' },
    { key: 'minimumOrder', label: 'Minimum order value', type: 'number', min: 0, max: 10000000 },
  ],
  beauty: [
    { key: 'beautyServices', label: 'Beauty services', type: 'checkboxes', options: ['Bridal makeup', 'Bridesmaid makeup', 'Hair styling', 'Natural hair', 'Wig installation', 'Barbering', 'Grooming', 'Nails', 'Touch-up service'] },
    { key: 'teamCapacity', label: 'Maximum people served per booking', type: 'number', min: 1, max: 100 },
    { key: 'trials', label: 'Trials', type: 'select', options: ['Included', 'Paid', 'Available after booking', 'Not offered'] },
    { key: 'mobileService', label: 'On-location service', type: 'select', options: YES_NO },
    { key: 'products', label: 'Product and allergy notes', type: 'textarea' },
  ],
  attire: [
    { key: 'attireTypes', label: 'Attire types', type: 'checkboxes', options: ['Wedding gowns', 'Bridesmaid dresses', 'Suits', 'Tuxedos', 'Traditional attire', 'Accessories', 'Shoes', 'Veils'] },
    { key: 'services', label: 'Services', type: 'checkboxes', options: ['Made-to-measure', 'Ready-to-wear', 'Rental', 'Alterations', 'Styling consultation'] },
    { key: 'leadTime', label: 'Typical production or alteration lead time', type: 'text' },
    { key: 'sizeRange', label: 'Size range', type: 'text' },
    { key: 'fittings', label: 'Fitting process', type: 'textarea' },
  ],
  transport: [
    { key: 'vehicleTypes', label: 'Vehicle types', type: 'checkboxes', options: ['Luxury cars', 'Classic cars', 'SUVs', 'Minibuses', 'Coaches', 'Shuttles', 'Horse carriage', 'Other'] },
    { key: 'fleetSize', label: 'Fleet size', type: 'number', min: 1, max: 1000 },
    { key: 'driverIncluded', label: 'Professional driver included', type: 'select', options: YES_NO },
    { key: 'passengerCapacity', label: 'Maximum passenger capacity per booking', type: 'number', min: 1, max: 5000 },
    { key: 'coverageArea', label: 'Travel coverage and transfer limits', type: 'textarea' },
    { key: 'decorationPolicy', label: 'Vehicle decoration policy', type: 'textarea' },
  ],
  stationery: [
    { key: 'stationeryTypes', label: 'Stationery products', type: 'checkboxes', options: ['Save-the-dates', 'Invitations', 'Menus', 'Place cards', 'Seating charts', 'Welcome signs', 'Thank-you cards', 'Digital invitations'] },
    { key: 'services', label: 'Services', type: 'checkboxes', options: ['Custom design', 'Template customisation', 'Printing', 'Calligraphy', 'Assembly', 'Delivery', 'Digital files'] },
    { key: 'minimumOrder', label: 'Minimum order quantity', type: 'number', min: 1, max: 100000 },
    { key: 'turnaround', label: 'Typical turnaround time', type: 'text' },
    { key: 'proofing', label: 'Proofing and revision policy', type: 'textarea' },
  ],
  officiants: [
    { key: 'ceremonyTypes', label: 'Ceremony types', type: 'checkboxes', options: ['Civil', 'Religious', 'Interfaith', 'Cultural', 'Humanist', 'Vow renewal', 'Symbolic ceremony'] },
    { key: 'legalRegistration', label: 'Legal marriage registration support', type: 'select', options: ['Yes', 'No', 'Referral available'] },
    { key: 'languages', label: 'Ceremony languages', type: 'multiselect', options: LANGUAGE_OPTIONS },
    { key: 'premaritalSessions', label: 'Premarital or ceremony planning sessions', type: 'select', options: ['Included', 'Optional', 'Not offered'] },
    { key: 'customisation', label: 'Ceremony customisation approach', type: 'textarea' },
  ],
  jewellery: [
    { key: 'jewelleryTypes', label: 'Products', type: 'checkboxes', options: ['Engagement rings', 'Wedding bands', 'Custom jewellery', 'Bridal jewellery', 'Groom accessories', 'Repairs and resizing'] },
    { key: 'materials', label: 'Materials', type: 'checkboxes', options: ['Gold', 'Platinum', 'Silver', 'Diamonds', 'Gemstones', 'Lab-grown stones', 'Alternative metals'] },
    { key: 'customDesign', label: 'Custom design available', type: 'select', options: YES_NO },
    { key: 'leadTime', label: 'Typical lead time', type: 'text' },
    { key: 'warranty', label: 'Warranty and aftercare', type: 'textarea' },
  ],
  'accommodation-travel': [
    { key: 'serviceTypes', label: 'Services', type: 'checkboxes', options: ['Hotel rooms', 'Guest houses', 'Lodges', 'Room blocks', 'Airport transfers', 'Travel planning', 'Honeymoon planning', 'Destination wedding logistics'] },
    { key: 'roomCapacity', label: 'Maximum room or guest capacity', type: 'number', min: 1, max: 10000 },
    { key: 'groupRates', label: 'Group rates available', type: 'select', options: YES_NO },
    { key: 'bookingPolicy', label: 'Group booking and cancellation policy', type: 'textarea' },
  ],
  'tents-marquees': [
    { key: 'structureTypes', label: 'Structures', type: 'checkboxes', options: ['Pole tents', 'Frame tents', 'Clear-span marquees', 'Stretch tents', 'Clear roofs', 'Pagodas', 'Flooring', 'Sidewalls'] },
    { key: 'maximumCapacity', label: 'Maximum guest capacity', type: 'number', min: 1, max: 50000 },
    { key: 'siteInspection', label: 'Site inspection', type: 'select', options: ['Included', 'Paid', 'Required before quotation', 'Not offered'] },
    { key: 'includedServices', label: 'Included services', type: 'checkboxes', options: ['Delivery', 'Installation', 'Dismantling', 'Flooring', 'Lighting', 'Engineering documents', 'Weather monitoring'] },
    { key: 'groundRequirements', label: 'Ground and access requirements', type: 'textarea' },
  ],
  'lighting-av': [
    { key: 'productionServices', label: 'Production services', type: 'checkboxes', options: ['Ambient lighting', 'Stage lighting', 'Sound system', 'Microphones', 'LED screens', 'Projection', 'Staging', 'Generators', 'Technical operators'] },
    { key: 'eventCapacity', label: 'Maximum event capacity supported', type: 'number', min: 1, max: 100000 },
    { key: 'siteSurvey', label: 'Technical site survey', type: 'select', options: ['Included', 'Paid', 'Required for large events', 'Not offered'] },
    { key: 'powerRequirements', label: 'Power and venue requirements', type: 'textarea' },
  ],
  'bar-beverages': [
    { key: 'serviceTypes', label: 'Bar and beverage services', type: 'checkboxes', options: ['Mobile bar', 'Cocktails', 'Mocktails', 'Wine service', 'Coffee bar', 'Juice bar', 'Bartenders', 'Glassware', 'Ice service'] },
    { key: 'guestCapacity', label: 'Maximum guest capacity', type: 'number', min: 1, max: 20000 },
    { key: 'alcoholSupply', label: 'Alcohol supply model', type: 'select', options: ['Provider supplies', 'Client supplies', 'Either', 'Alcohol-free only'] },
    { key: 'licensing', label: 'Licensing or permit status', type: 'select', options: ['Verified', 'Available for review', 'Venue-dependent', 'Not applicable'] },
    { key: 'packageBasis', label: 'Package basis', type: 'select', options: ['Per guest', 'Per hour', 'Consumption', 'Custom proposal'] },
  ],
  'photo-booth': [
    { key: 'boothTypes', label: 'Booth types', type: 'checkboxes', options: ['Open booth', 'Enclosed booth', '360 booth', 'Mirror booth', 'GIF / boomerang', 'Roaming booth'] },
    { key: 'includedItems', label: 'Included items', type: 'checkboxes', options: ['Attendant', 'Props', 'Printed photos', 'Digital gallery', 'Guest book', 'Custom backdrop', 'Custom templates'] },
    { key: 'operatingHours', label: 'Standard operating hours', type: 'number', min: 1, max: 24 },
    { key: 'spaceRequirements', label: 'Space and power requirements', type: 'textarea' },
  ],
  'content-creation': [
    { key: 'contentTypes', label: 'Content types', type: 'checkboxes', options: ['Vertical video', 'Behind the scenes', 'Guest interviews', 'Same-day reels', 'Ceremony clips', 'Reception clips', 'Photo content'] },
    { key: 'coverageHours', label: 'Coverage hours', type: 'number', min: 1, max: 48 },
    { key: 'deliverySpeed', label: 'Delivery speed', type: 'select', options: ['Same day', '24 hours', '48 hours', 'Up to 7 days'] },
    { key: 'rawContent', label: 'Raw content included', type: 'select', options: YES_NO },
    { key: 'platforms', label: 'Platform optimisation', type: 'checkboxes', options: ['Instagram', 'TikTok', 'YouTube Shorts', 'Facebook', 'Private cloud gallery'] },
  ],
  'gifts-favours': [
    { key: 'productTypes', label: 'Products', type: 'checkboxes', options: ['Guest favours', 'Welcome gifts', 'Bridal party gifts', 'Personalised items', 'Packaging', 'Corporate-style gifts'] },
    { key: 'personalisation', label: 'Personalisation available', type: 'select', options: YES_NO },
    { key: 'minimumOrder', label: 'Minimum order quantity', type: 'number', min: 1, max: 100000 },
    { key: 'leadTime', label: 'Typical production lead time', type: 'text' },
    { key: 'samples', label: 'Samples available', type: 'select', options: ['Free', 'Paid', 'After deposit', 'Not available'] },
  ],
  choreography: [
    { key: 'lessonTypes', label: 'Lessons', type: 'checkboxes', options: ['First dance', 'Bridal party', 'Traditional dance', 'Flash mob', 'Private lessons', 'Group lessons'] },
    { key: 'lessonFormat', label: 'Lesson format', type: 'checkboxes', options: ['Studio', 'At home', 'Online', 'Venue rehearsal'] },
    { key: 'recommendedSessions', label: 'Recommended number of sessions', type: 'number', min: 1, max: 100 },
    { key: 'musicEditing', label: 'Music editing included', type: 'select', options: YES_NO },
  ],
  security: [
    { key: 'securityServices', label: 'Security services', type: 'checkboxes', options: ['Access control', 'Guest list checking', 'Parking control', 'VIP protection', 'Crowd management', 'Overnight security', 'CCTV'] },
    { key: 'teamCapacity', label: 'Maximum personnel available', type: 'number', min: 1, max: 5000 },
    { key: 'licensed', label: 'Business licensing', type: 'select', options: ['Verified', 'Available for review', 'In progress'] },
    { key: 'riskAssessment', label: 'Event risk assessment', type: 'select', options: ['Included', 'Paid', 'Required for large events'] },
  ],
  childcare: [
    { key: 'ageGroups', label: 'Age groups supported', type: 'checkboxes', options: ['Infants', 'Toddlers', 'Ages 4–7', 'Ages 8–12', 'Teenagers'] },
    { key: 'maximumChildren', label: 'Maximum children per booking', type: 'number', min: 1, max: 1000 },
    { key: 'services', label: 'Services', type: 'checkboxes', options: ['Supervision', 'Activity area', 'Quiet room', 'Meal support', 'Bedtime support', 'Qualified first aider', 'Mobile crèche'] },
    { key: 'staffChecks', label: 'Staff vetting and qualifications', type: 'textarea' },
    { key: 'parentRequirements', label: 'Parent information and requirements', type: 'textarea' },
  ],
  'cleaning-sanitation': [
    { key: 'services', label: 'Services', type: 'checkboxes', options: ['Pre-event cleaning', 'During-event cleaning', 'Post-event cleaning', 'Washroom attendants', 'Waste removal', 'Portable washrooms', 'Sanitisation'] },
    { key: 'eventCapacity', label: 'Maximum event capacity supported', type: 'number', min: 1, max: 100000 },
    { key: 'equipmentIncluded', label: 'Equipment and supplies included', type: 'select', options: YES_NO },
    { key: 'wastePolicy', label: 'Waste handling and sustainability policy', type: 'textarea' },
  ],
  other: [
    { key: 'serviceDescription', label: 'Describe the service', type: 'textarea', required: true },
    { key: 'requirements', label: 'Important booking requirements', type: 'textarea' },
    { key: 'capacity', label: 'Maximum event or client capacity', type: 'number', min: 1, max: 100000 },
  ],
}

export function providerCategoryLabel(value: string): string {
  return PROVIDER_CATEGORIES.find((category) => category.value === value)?.label ?? value
}

export function providerCategorySingular(value: string): string {
  return PROVIDER_CATEGORIES.find((category) => category.value === value)?.singular ?? 'Wedding service provider'
}

export function providerServiceFields(category: string): readonly ProviderFieldDefinition[] {
  return PROVIDER_SERVICE_FIELDS[category] ?? PROVIDER_SERVICE_FIELDS.other
}
